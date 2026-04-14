import { db } from "@server/db";
import { users } from "@server/db/schema";
import { Hono } from "hono";

export const usersRoute = new Hono().get("/", async (c) => {
  const rows = await db.select().from(users);
  return c.json({ users: rows });
});
