import type { AppEnv } from "@server/app";

import { groupMembers, groups, usageTargets, users } from "@server/db/schema";
import { Hono } from "hono";

export const groupsRoute = new Hono<AppEnv>().get("/", async (c) => {
  const db = c.get("db");
  const [groupRows, memberRows, targetRows, userRows] = await Promise.all([
    db.select().from(groups),
    db.select().from(groupMembers),
    db.select().from(usageTargets),
    db.select().from(users),
  ]);

  const usersById = new Map(userRows.map((user) => [user.id, user]));

  return c.json({
    groups: groupRows.map((group) => ({
      ...group,
      members: memberRows
        .filter((member) => member.group === group.id)
        .map((member) => {
          const user = member.user == null ? null : usersById.get(member.user);
          return user ? { ...member, user } : null;
        })
        .filter((member) => member != null),
      usageTargets: targetRows.filter((target) => target.group === group.id),
    })),
  });
});
