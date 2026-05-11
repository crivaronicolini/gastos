import OpenAI from "openai";

import { statementImportJsonSchema } from "../server/db/schema";

const CLOUDFLARE_AI_GATEWAY_BASE_URL =
  "https://gateway.ai.cloudflare.com/v1/b1c2ed4192625d23c2d0266040c63409/default/compat";

async function readStdin() {
  if (process.stdin.isTTY) {
    return "";
  }

  const chunks: Uint8Array[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks).toString("utf8").trim();
}

async function main() {
  const inputFromArgs = process.argv.slice(2).join(" ").trim();
  const inputFromStdin = await readStdin();
  const statementText = inputFromArgs || inputFromStdin;

  if (!statementText) {
    throw new Error("Provide statement text as an argument or via stdin.");
  }

  const apiKey =
    process.env.GEMINI3FLASHTOKEN ??
    process.env.CF_AIG_TOKEN ??
    process.env.CLOUDFLARE_GATEWAY_TOKEN;
  if (!apiKey) {
    throw new Error("Missing GEMINI3FLASHTOKEN, CF_AIG_TOKEN, or CLOUDFLARE_GATEWAY_TOKEN.");
  }

  const client = new OpenAI({
    apiKey,
    baseURL: CLOUDFLARE_AI_GATEWAY_BASE_URL,
  });

  const response = await client.chat.completions.create({
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
          "The bank field must be the bank name only, not the card brand, product name, or statement title.",
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
        content: statementText,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("AI response was empty.");
  }

  console.log(content);
}

await main();
