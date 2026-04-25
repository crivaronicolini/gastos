import type { WorkflowEvent } from "cloudflare:workers";

import { statementImportJsonSchema, statementImportSchema } from "@server/db/schema";
import { WorkflowEntrypoint, WorkflowStep } from "cloudflare:workers";
import { extractText, getDocumentProxy } from "unpdf";

type Params = { callback_url: string; file_url: string; group_id: number; owner_id: number };

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

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
      const cutoff = lines.findIndex((line) => line.includes("TOTAL A PAGAR"));
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
        const response = (await this.env.AI.run("@cf/moonshotai/kimi-k2.5" as keyof AiModels, {
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
          }),
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error(`Upload webhook failed with ${response.status}: ${body}`);
        }
      },
    );

    return ai_response;
  }
}
