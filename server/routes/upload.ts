import type { AppEnv } from "@server/app";

import {
  categories,
  expenses,
  groupMembers,
  groups,
  statementImportSchema,
  statements,
  uploadWebhookSchema,
  usageTargets,
  users,
} from "@server/db/schema";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";

function parseStatementDate(value: string | null): Date | null {
  if (!value) return null;

  const trimmed = value.trim();
  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
  }

  const short = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (!short) return null;

  const day = Number(short[1]);
  const month = Number(short[2]);
  const rawYear = Number(short[3]);
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;

  return new Date(Date.UTC(year, month - 1, day));
}

async function findCategoryId(db: AppEnv["Variables"]["db"], name: string) {
  const [existing] = await db.select().from(categories).where(eq(categories.name, name));
  if (existing) return existing.id;

  throw new Error(`Unknown category: ${name}`);
}

async function findStatementOwnerId(db: AppEnv["Variables"]["db"], id: number) {
  const [existing] = await db.select().from(users).where(eq(users.id, id));
  if (existing) return existing.id;

  throw new Error(`Unknown statement owner id: ${id}`);
}

async function requireGroupMember(db: AppEnv["Variables"]["db"], groupId: number, userId: number) {
  const [member] = await db
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.group, groupId), eq(groupMembers.user, userId)));
  if (member) return;

  throw new Error(`User ${userId} is not a member of group ${groupId}`);
}

async function findGroupId(db: AppEnv["Variables"]["db"], id: number) {
  const [existing] = await db.select().from(groups).where(eq(groups.id, id));
  if (existing) return existing.id;

  throw new Error(`Unknown group id: ${id}`);
}

async function findUsageTargetIdForUser(
  db: AppEnv["Variables"]["db"],
  groupId: number,
  userId: number,
) {
  const [target] = await db
    .select()
    .from(usageTargets)
    .where(and(eq(usageTargets.group, groupId), eq(usageTargets.user, userId)));
  if (target) return target.id;

  throw new Error(`Missing usage target for user ${userId} in group ${groupId}`);
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export const uploadRoute = new Hono<AppEnv>()
  .get("/status", async (c) => {
    const ids = (c.req.query("ids") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 25);

    if (ids.length === 0) {
      return c.json({ statuses: [] });
    }

    const statuses = await Promise.all(
      ids.map(async (id) => {
        try {
          const instance = await c.env.process_files_WF.get(id);
          const status = await instance.status();
          return { id, ...status };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return {
            error: { message, name: "WorkflowStatusError" },
            id,
            status: "unknown" as const,
          };
        }
      }),
    );

    return c.json({ statuses });
  })
  .post("/:id/retry", async (c) => {
    const id = c.req.param("id");
    const instance = await c.env.process_files_WF.get(id);
    await instance.restart();
    return c.json({ id, ...(await instance.status()) });
  })
  .post("/webhook", async (c) => {
    const body = uploadWebhookSchema.safeParse(await c.req.json());
    if (!body.success) {
      return c.json({ error: "Invalid webhook payload", issues: body.error.issues }, 400);
    }

    const { file_key, group_id, json_key, owner_id } = body.data;
    try {
      const db = c.get("db");
      const jsonObject = await c.env.R2.get(json_key);
      if (!jsonObject) {
        return c.json({ error: `JSON output not found: ${json_key}` }, 404);
      }

      const payload = statementImportSchema.safeParse(JSON.parse(await jsonObject.text()));
      if (!payload.success) {
        return c.json({ error: "Invalid statement JSON", issues: payload.error.issues }, 422);
      }

      const statementImport = payload.data;
      const groupId = await findGroupId(db, group_id);
      const ownerId = await findStatementOwnerId(db, owner_id);
      await requireGroupMember(db, groupId, ownerId);
      const ownerUsageTargetId = await findUsageTargetIdForUser(db, groupId, ownerId);

      const [existingStatement] = await db
        .select()
        .from(statements)
        .where(eq(statements.sourceFileKey, file_key));
      if (existingStatement) {
        const existingExpenses = await db
          .select()
          .from(expenses)
          .where(eq(expenses.statement, existingStatement.id));
        return c.json({
          duplicate: true,
          expenses: existingExpenses,
          statement: existingStatement,
        });
      }

      const [statement] = await db
        .insert(statements)
        .values({
          bank: statementImport.bank,
          card: statementImport.card,
          group: groupId,
          jsonFileKey: json_key,
          month: statementImport.month,
          owner: ownerId,
          periodFrom: parseStatementDate(statementImport.period_from),
          periodTo: parseStatementDate(statementImport.period_to),
          sourceFileKey: file_key,
        })
        .returning();
      if (!statement) {
        throw new Error("Failed to create statement");
      }

      const expenseRows = await Promise.all(
        statementImport.expenses.map(async (expense) => ({
          amount: expense.amount ?? expense.amount_usd,
          category: await findCategoryId(db, expense.category),
          date: parseStatementDate(expense.date),
          installments: expense.installments,
          origin: statementImport.card ?? statementImport.bank ?? "unknown",
          statement: statement.id,
          title: expense.title ?? "Unknown expense",
          usedByTarget: ownerUsageTargetId,
        })),
      );

      const insertedExpenses = [];
      for (const expenseChunk of chunkArray(expenseRows, 10)) {
        insertedExpenses.push(...(await db.insert(expenses).values(expenseChunk).returning()));
      }

      return c.json({
        expenses: insertedExpenses,
        statement,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Upload webhook failed", { error, file_key, json_key });
      if (message.startsWith("Unknown category:")) {
        return c.json({ error: "Invalid statement JSON", message, file_key, json_key }, 422);
      }
      if (
        message.startsWith("Unknown statement owner id:") ||
        message.startsWith("Unknown group id:") ||
        message.includes("is not a member of group") ||
        message.startsWith("Missing usage target")
      ) {
        return c.json({ error: "Invalid statement owner", message, file_key, json_key }, 422);
      }
      return c.json({ error: "Upload webhook failed", message, file_key, json_key }, 500);
    }
  })
  .post("/", async (c) => {
    const body = await c.req.parseBody({ all: true });
    const value = body["file"] ?? body["files"];
    const groupId = Number(body["group_id"]);
    const ownerId = Number(body["owner_id"]);

    const files = Array.isArray(value)
      ? value.filter((item): item is File => item instanceof File)
      : value instanceof File
        ? [value]
        : [];

    if (files.length === 0) {
      return c.json(
        {
          error: "At least one file is required",
          fields: Object.keys(body),
        },
        400,
      );
    }
    if (!Number.isInteger(ownerId) || ownerId <= 0) {
      return c.json({ error: "A valid owner_id is required" }, 400);
    }
    if (!Number.isInteger(groupId) || groupId <= 0) {
      return c.json({ error: "A valid group_id is required" }, 400);
    }

    const db = c.get("db");
    try {
      await findGroupId(db, groupId);
      await findStatementOwnerId(db, ownerId);
      await requireGroupMember(db, groupId, ownerId);
      await findUsageTargetIdForUser(db, groupId, ownerId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ error: "Invalid statement owner", message }, 400);
    }

    const callbackUrl = new URL("/api/upload/webhook", c.req.url).toString();
    const uploads = await Promise.all(
      files.map(async (file) => {
        const id = crypto.randomUUID();
        const upload = await c.env.R2.put(id.slice(0, 5) + "-" + file.name, file);
        if (!upload) {
          throw new Error(`Failed to upload file: ${file.name}`);
        }
        return {
          fileKey: upload.key,
          fileName: file.name,
          groupId,
          ownerId,
          workflow: {
            id,
            params: {
              callback_url: callbackUrl,
              file_url: upload.key,
              group_id: groupId,
              owner_id: ownerId,
            },
          },
        };
      }),
    );

    const instances = await c.env.process_files_WF.createBatch(
      uploads.map((upload) => upload.workflow),
    );

    return c.json(
      {
        uploads: uploads.map((upload, index) => ({
          fileKey: upload.fileKey,
          fileName: upload.fileName,
          groupId: upload.groupId,
          ownerId: upload.ownerId,
          workflowId: instances[index]?.id ?? upload.workflow.id,
        })),
      },
      202,
    );
  });
