import { readFileSync, writeFileSync } from "node:fs";

const filePath = new URL("../server/db/auth.schema.ts", import.meta.url);
const source = readFileSync(filePath, "utf8");

const updated = source
  .replace(
    'import { relations, sql } from "drizzle-orm";',
    'import { defineRelations, sql } from "drizzle-orm";',
  )
  .replace(
    /export const userRelations = relations\(user, \(\{ many \}\) => \(\{[\s\S]*?export const accountRelations = relations\(account, \(\{ one \}\) => \(\{[\s\S]*?\}\)\);\n?/,
    `export const relations = defineRelations(
  { user, session, account, verification },
  (r) => ({
    user: {
      sessions: r.many.session({
        from: r.user.id,
        to: r.session.userId,
      }),
      accounts: r.many.account({
        from: r.user.id,
        to: r.account.userId,
      }),
    },
    session: {
      user: r.one.user({
        from: r.session.userId,
        to: r.user.id,
      }),
    },
    account: {
      user: r.one.user({
        from: r.account.userId,
        to: r.user.id,
      }),
    },
  }),
);
`,
  );

writeFileSync(filePath, updated);
