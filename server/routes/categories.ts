import type { AppEnv } from "@server/app";

import { categories } from "@server/db/schema";
import { Hono } from "hono";

export const categoriesRoute = new Hono<AppEnv>().get("/", async (c) => {
  const db = c.get("db");
  const rows = await db.select().from(categories);
  return c.json({ categories: rows });
});
