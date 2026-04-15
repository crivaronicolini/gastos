import type { AppEnv } from "@server/app";

import { zValidator } from "@hono/zod-validator";
import { expenses, expenseInsertSchema, expenseUpdateSchema } from "@server/db/schema";
import { sum, eq } from "drizzle-orm";
import { Hono } from "hono";

export const expenseRoute = new Hono<AppEnv>()
  .get("/", async (c) => {
    const db = c.get("db");
    const rows = await db.select().from(expenses);
    console.log(rows);
    return c.json({ expenses: rows });
  })
  .get("/total-spent", async (c) => {
    const db = c.get("db");
    const total = await db.select({ total: sum(expenses.amount) }).from(expenses);
    return c.json({ total });
  })
  .post("/", zValidator("json", expenseInsertSchema), async (c) => {
    const db = c.get("db");
    const expense = c.req.valid("json");
    const ret = await db.insert(expenses).values(expense).returning();
    c.status(201);
    return c.json(ret);
  })
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
