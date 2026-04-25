import type { AppEnv } from "@server/app";

import { zValidator } from "@hono/zod-validator";
import { groupMembers, groups, usageTargets, users } from "@server/db/schema";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

export const groupsRoute = new Hono<AppEnv>()
  .get("/", async (c) => {
    const db = c.get("db");
    const [groupRows, memberRows, targetRows, userRows] = await Promise.all([
      db.select().from(groups),
      db.select().from(groupMembers),
      db.select().from(usageTargets),
      db.select().from(users),
    ]);

    const usersById = new Map(userRows.map((user) => [user.id, user]));

    return c.json({
      groups: groupRows.map((group) => {
        const members = memberRows
          .filter((member) => member.group === group.id)
          .map((member) => {
            const user = member.user == null ? null : usersById.get(member.user);
            return user ? { ...member, user } : null;
          })
          .filter((member) => member != null);
        const fallbackName = members.map((member) => member.user.name).join(" & ");

        return {
          ...group,
          members,
          name: group.name.trim() || fallbackName || group.name,
          usageTargets: targetRows.filter((target) => target.group === group.id),
        };
      }),
    });
  })
  .patch(
    "/:id{[0-9]+}",
    zValidator(
      "json",
      z.object({
        name: z.string().trim().min(1).max(120),
      }),
    ),
    async (c) => {
      const db = c.get("db");
      const id = Number.parseInt(c.req.param("id"));
      const { name } = c.req.valid("json");

      const [group] = await db.update(groups).set({ name }).where(eq(groups.id, id)).returning();
      if (!group) {
        return c.notFound();
      }

      return c.json({ group });
    },
  );
