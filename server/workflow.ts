import type { Expense } from "@server/db/schema";
import type { WorkflowEvent } from "cloudflare:workers";

import { WorkflowEntrypoint, WorkflowStep } from "cloudflare:workers";
import OpenAI from "openai";
import { extractText, getDocumentProxy } from "unpdf";

type Params = { file_url: string };

const categories = [
  "Comida",
  "Regalos",
  "Salidas",
  "Rappi/comida en casa",
  "Vivienda",
  "Salud/médicos",
  "Ropa",
  "Mascotas",
  "Servicios",
  "Transporte",
  "Deuda",
  "Viajes",
  "Hobbys",
  "Otros",
] as const;

type CategoryName = (typeof categories)[number];
type ExpenseDraft = Omit<Expense, "id" | "category"> & {
  category: CategoryName;
};
type AIResponse = {
  origin: string | null;
  owner: string | null;
  expenses: ExpenseDraft[];
};

const expenseDraftSchema = {
  name: "expense_list",
  strict: true,
  schema: {
    type: "object",
    properties: {
      card: { type: ["string"], enum: ["visa", "mastercard", "americanexpress"] },
      bank: { type: ["string"], enum: ["santander", "galicia"] },
      owner_first_last_name: { type: ["string"] },
      expenses: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: ["string"] },
            amount: { type: ["number"] },
            currency: { type: ["string"], enum: ["ARS", "USD"] },
            date: { type: ["string"] },
            installments: { type: ["string", "null"] },
            category: {
              type: "string",
              enum: categories,
            },
          },
          required: ["title", "date", "amount", "currency", "installments", "category"],
          additionalProperties: false,
        },
      },
    },
    required: ["card", "bank", "owner_first_last_name", "expenses"],
    additionalProperties: false,
  },
} as const;

export class ProcessFilesWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    const data = await step.do("extract text", async () => {
      const file_url = event.payload.file_url;
      const buffer = await this.env.R2.get(file_url).then((res) => res.arrayBuffer());

      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { totalPages, text } = await extractText(pdf);
      const textJoined = text.join("\n\n");
      const lines = textJoined.split("\n");
      const cutoff = lines.findIndex((line) => line.includes("TOTAL A PAGAR"));
      const statementText = cutoff === -1 ? textJoined : lines.slice(0, cutoff + 1).join("\n");

      await this.env.R2.put("text-" + file_url, statementText);

      return { totalPages, textJoined: statementText };
    });

    const ai_response = await step.do(
      "ai-classify",
      {
        retries: {
          limit: 1, // The total number of attempts
          delay: "10 seconds", // Delay between each retry
          backoff: "exponential", // Any of "constant" | "linear" | "exponential";
        },
        timeout: "5 minutes",
      },

      async () => {
        const response = await this.env.AI.run("@cf/zai-org/glm-4.7-flash", {
          temperature: 0.3,
          response_format: {
            type: "json_schema",
            json_schema: expenseDraftSchema,
          },
          messages: [
            {
              role: "system",
              content:
                "You are an accountant specclient.chat.completions.createialized in credit card statements. Classify each transaction from the statement text.",
            },
            {
              role: "user",
              content: data.textJoined,
            },
          ],
        });

        // const client = new OpenAI({
        //   apiKey: this.env.CLOUDFLARE_GATEWAY_TOKEN,
        //   baseURL: `https://gateway.ai.cloudflare.com/v1/${this.env.CLOUDFLARE_ACCOUNT_ID}/default/compat`,
        // });
        // const response = await client.chat.completions.create({
        //   model: "google-ai-studio/gemini-3.1-flash",
        //   temperature: 0.3,
        //   response_format: {
        //     type: "json_schema",
        //     json_schema: expenseDraftSchema,
        //   },
        //   messages: [
        //     {
        //       role: "system",
        //       content:
        //         "You are an accountant specclient.chat.completions.createialized in credit card statements. Classify each transaction from the statement text.",
        //     },
        //     {
        //       role: "user",
        //       content: data.textJoined,
        //     },
        //   ],
        // });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error("AI response was empty");
        }

        return JSON.parse(content) as AIResponse[];
      },
    );

    return ai_response;
  }
}
