import type { WorkflowEvent } from "cloudflare:workers";

import { statementImportJsonSchema, statementImportSchema } from "@server/db/schema";
import { WorkflowEntrypoint, WorkflowStep } from "cloudflare:workers";
import OpenAI from "openai";
import { extractText, getDocumentProxy } from "unpdf";

type Params = {
  callback_url: string;
  file_url: string;
  group_id: number;
  owner_id: number;
  statement_month: string;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

const CLOUDFLARE_AI_GATEWAY_BASE_URL =
  "https://gateway.ai.cloudflare.com/v1/b1c2ed4192625d23c2d0266040c63409/default/compat";

async function readWebhookError(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      const payload = (await response.json()) as {
        error?: unknown;
        issues?: Array<{ message?: unknown; path?: unknown[] }>;
        message?: unknown;
      };

      const parts: string[] = [];
      if (typeof payload.error === "string") {
        parts.push(payload.error);
      }
      if (typeof payload.message === "string") {
        parts.push(payload.message);
      }
      if (Array.isArray(payload.issues) && payload.issues.length > 0) {
        const issueText = payload.issues
          .map((issue) => {
            const path = Array.isArray(issue.path) && issue.path.length > 0 ? issue.path.join(".") : null;
            const message = typeof issue.message === "string" ? issue.message : "Validation issue";
            return path ? `${path}: ${message}` : message;
          })
          .join("; ");
        if (issueText) {
          parts.push(issueText);
        }
      }

      if (parts.length > 0) {
        return parts.join(" | ");
      }
    } catch {
      // Fall back to plain text below.
    }
  }

  const body = await response.text();
  return body || `HTTP ${response.status}`;
}

export class ProcessFilesWorkflow extends WorkflowEntrypoint<Env, Params> {
  override async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    const data = await step.do("extract text", async () => {
      const file_url = event.payload.file_url;
      const file = await this.env.R2.get(file_url);
      if (!file) {
        throw new Error(`Uploaded file not found: ${file_url}`);
      }
      const buffer = await file.arrayBuffer();

      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { totalPages, text } = await extractText(pdf);
      const textJoined = text.join("\n\n");
      const lines = textJoined.split("\n");
      const cutoff = lines.findLastIndex((line) => line.includes("TOTAL A PAGAR"));
      const statementText = cutoff === -1 ? textJoined : lines.slice(0, cutoff + 1).join("\n");

      await this.env.R2.put("text-" + file_url, statementText);

      return { file_url, totalPages, textJoined: statementText };
    });

    const ai_response = await step.do(
      "ai-classify",
      {
        retries: {
          limit: 1,
          delay: "10 seconds",
          backoff: "exponential",
        },
        timeout: "5 minutes",
      },

      async () => {
        const aiGatewayToken =
          (this.env as Env & { GEMINI3FLASHTOKEN?: string }).GEMINI3FLASHTOKEN ??
          (this.env as Env & { CF_AIG_TOKEN?: string }).CF_AIG_TOKEN ??
          this.env.CLOUDFLARE_GATEWAY_TOKEN;
        const client = new OpenAI({
          apiKey: aiGatewayToken,
          baseURL: CLOUDFLARE_AI_GATEWAY_BASE_URL,
        });
        const response = (await client.chat.completions.create({
          model: "google-ai-studio/gemini-3.1-flash-lite",
          temperature: 0.3,
          response_format: {
            type: "json_schema",
            json_schema: statementImportJsonSchema,
          },
          messages: [
            {
              role: "system",
              content: [
                "You are an accountant specialized in credit card statements.",
                "Return one JSON object with card, bank, and expenses.",
                "The bank field must be the bank name only, not the card brand, product name, or statement title. Example: 'galicia', 'santander",
                "Use DD-MM-YY format for expense dates, period_from, and period_to. Example: 08-04-26.",
                "Do not repeat card or bank inside expense items.",
                "Each expense item must include title, date, category, amount, and currency.",
                "Use currency ARS for peso amounts and USD for dollar amounts.",
                "If the statement does not explicitly show installments, use installments: null.",
                "Never infer installments from the expense date or statement month.",
              ].join(" "),
            },
            {
              role: "user",
              content: data.textJoined,
            },
          ],
        })) as ChatCompletionResponse;

        const content = response.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error("AI response was empty");
        }

        return statementImportSchema.parse(JSON.parse(content));
      },
    );

    const jsonKey = await step.do("persist-json", async () => {
      const key = "json-" + data.file_url;
      await this.env.R2.put(key, JSON.stringify(ai_response, null, 2), {
        httpMetadata: { contentType: "application/json" },
      });
      return key;
    });

    await step.do(
      "notify-upload-webhook",
      {
        retries: {
          limit: 1,
          delay: "10 seconds",
          backoff: "exponential",
        },
        timeout: "5 minutes",
      },
      async () => {
        const response = await fetch(event.payload.callback_url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            file_key: data.file_url,
            group_id: event.payload.group_id,
            json_key: jsonKey,
            owner_id: event.payload.owner_id,
            statement_month: event.payload.statement_month,
          }),
        });

        if (!response.ok) {
          const details = await readWebhookError(response);
          console.error("Upload webhook failed", {
            callbackUrl: event.payload.callback_url,
            details,
            fileKey: data.file_url,
            groupId: event.payload.group_id,
            ownerId: event.payload.owner_id,
            status: response.status,
          });
          throw new Error(`Upload webhook failed with ${response.status}: ${details}`);
        }
      },
    );

    return ai_response;
  }
}
