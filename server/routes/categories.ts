import { db } from "@server/db";
import { categories } from "@server/db/schema";
import { Hono } from "hono";

export const categoriesRoute = new Hono().get("/", async (c) => {
  const rows = await db.select().from(categories);
  return c.json({ categories: rows });
});
