import OpenAI from "openai";

import { statementImportJsonSchema } from "../server/db/schema";

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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  const client = new OpenAI({ apiKey });

  const response = await client.chat.completions.create({
    model: "gpt-5.4-mini",
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
