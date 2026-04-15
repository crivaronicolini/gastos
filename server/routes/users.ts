import type { AppEnv } from "@server/app";

import { users } from "@server/db/schema";
import { Hono } from "hono";

export const usersRoute = new Hono<AppEnv>().get("/", async (c) => {
  const db = c.get("db");
  const rows = await db.select().from(users);
  return c.json({ users: rows });
});
