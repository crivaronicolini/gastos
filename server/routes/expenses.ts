import type { AppEnv } from "@server/app";

import { zValidator } from "@hono/zod-validator";
import {
  expenses,
  expenseInsertSchema,
  expenseUpdateSchema,
  groupMembers,
  statements,
  usageTargets,
} from "@server/db/schema";
import { and, eq, inArray, isNull, sum } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

async function requireGroupMember(db: AppEnv["Variables"]["db"], groupId: number, userId: number) {
  const [member] = await db
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.group, groupId), eq(groupMembers.user, userId)));
  if (member) return;

  throw new Error(`User ${userId} is not a member of group ${groupId}`);
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

async function findOrCreateExtrasStatement(
  db: AppEnv["Variables"]["db"],
  groupId: number,
  ownerId: number,
  month: string,
) {
  const [existingStatement] = await db
    .select()
    .from(statements)
    .where(
      and(
        eq(statements.group, groupId),
        eq(statements.owner, ownerId),
        eq(statements.month, month),
        eq(statements.card, "extras"),
        isNull(statements.sourceFileKey),
        isNull(statements.jsonFileKey),
      ),
    );

  if (existingStatement) return existingStatement;

  const [statement] = await db
    .insert(statements)
    .values({
      bank: null,
      card: "extras",
      group: groupId,
      jsonFileKey: null,
      month,
      owner: ownerId,
      periodFrom: null,
      periodTo: null,
      sourceFileKey: null,
    })
    .returning();

  if (!statement) {
    throw new Error("Failed to create extras statement");
  }

  return statement;
}

export const expenseRoute = new Hono<AppEnv>()
  .get("/", async (c) => {
    const db = c.get("db");
    const rows = await db.select().from(expenses);
    console.log(rows);
    return c.json({ expenses: rows });
  })
  .get("/total-spent", async (c) => {
    const db = c.get("db");
    const total = await db
      .select({ currency: expenses.currency, total: sum(expenses.amount) })
      .from(expenses)
      .groupBy(expenses.currency);
    return c.json({ total });
  })
  .post("/", zValidator("json", expenseInsertSchema), async (c) => {
    const db = c.get("db");
    const expense = c.req.valid("json");
    const ret = await db.insert(expenses).values(expense).returning();
    c.status(201);
    return c.json(ret);
  })
  .post(
    "/insert-relative",
    zValidator(
      "json",
      z.object({
        anchorExpenseId: z.number().int().positive(),
        groupId: z.number().int().positive(),
        ownerId: z.number().int().positive(),
        position: z.enum(["above", "below"]),
      }),
    ),
    async (c) => {
      const db = c.get("db");
      const { anchorExpenseId, groupId, ownerId } = c.req.valid("json");

      const [anchorExpense] = await db
        .select()
        .from(expenses)
        .where(eq(expenses.id, anchorExpenseId));
      if (!anchorExpense || anchorExpense.statement == null) {
        return c.json({ error: "Anchor expense not found" }, 404);
      }

      const [anchorStatement] = await db
        .select()
        .from(statements)
        .where(eq(statements.id, anchorExpense.statement));
      if (!anchorStatement || anchorStatement.group !== groupId || !anchorStatement.month) {
        return c.json({ error: "Anchor statement not found" }, 404);
      }

      await requireGroupMember(db, groupId, ownerId);
      const usageTargetId = await findUsageTargetIdForUser(db, groupId, ownerId);
      const extrasStatement = await findOrCreateExtrasStatement(
        db,
        groupId,
        ownerId,
        anchorStatement.month,
      );

      const [expense] = await db
        .insert(expenses)
        .values({
          amount: null,
          category: null,
          currency: "ARS",
          date: null,
          installments: null,
          origin: "extras",
          statement: extrasStatement.id,
          title: "",
          usedByTarget: usageTargetId,
        })
        .returning();

      return c.json({ expense });
    },
  )
  .post(
    "/bulk-delete",
    zValidator(
      "json",
      z.object({
        ids: z.array(z.number().int().positive()).min(1),
      }),
    ),
    async (c) => {
      const db = c.get("db");
      const { ids } = c.req.valid("json");
      const deleted = await db.delete(expenses).where(inArray(expenses.id, ids)).returning();
      return c.json({ deleted });
    },
  )
  .get("/:id{[0-9]+}", async (c) => {
    const db = c.get("db");
    const id = Number.parseInt(c.req.param("id"));
    const expense = await db.select().from(expenses).where(eq(expenses.id, id));
    if (!expense) {
      return c.notFound();
    }
    return c.json({ expense });
  })
  .patch("/:id{[0-9]+}", zValidator("json", expenseUpdateSchema), async (c) => {
    const db = c.get("db");
    const id = Number.parseInt(c.req.param("id"));
    const patch = c.req.valid("json");
    console.log(patch);
    const updated = await db.update(expenses).set(patch).where(eq(expenses.id, id)).returning();
    console.log(updated);
    return c.json(updated);
  })
  .delete("/:id{[0-9]+}", async (c) => {
    const db = c.get("db");
    const id = Number.parseInt(c.req.param("id"));
    const deleted = await db.delete(expenses).where(eq(expenses.id, id)).returning();
    return c.json(deleted);
  });
