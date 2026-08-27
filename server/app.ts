import type { IncomingRequestCfProperties } from "@cloudflare/workers-types";

import { Hono } from "hono";
import { logger } from "hono/logger";

import { createAuth, type AuthEnv } from "./auth";
import { createDb, type Db } from "./db";
import { categoriesRoute } from "./routes/categories.ts";
import { chatRoute } from "./routes/chat.ts";
import { expenseRoute } from "./routes/expenses.ts";
import { groupsRoute } from "./routes/groups.ts";
import { uploadRoute } from "./routes/upload.ts";
import { usersRoute } from "./routes/users.ts";

type Bindings = AuthEnv & {
  process_files_WF: Workflow;
  R2: R2Bucket;
  pdf_handler: Queue;
  AI: Ai;
};

type AuthInstance = ReturnType<typeof createAuth>;
type AuthSession = Awaited<ReturnType<AuthInstance["api"]["getSession"]>>;
type ResolvedAuthSession = NonNullable<AuthSession>;

type Variables = {
  db: Db;
  WF: Workflow;
  R2: R2Bucket;
  Q: Queue;
  AI: Ai;
  auth: AuthInstance;
  user: ResolvedAuthSession["user"] | null;
  session: ResolvedAuthSession["session"] | null;
};

const app = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

app.use("*", logger());

app.use("*", async (c, next) => {
  const auth = createAuth(
    c.env,
    (c.req.raw.cf ?? {}) as IncomingRequestCfProperties,
    new URL(c.req.url).origin,
  );
  c.set("auth", auth);
  await next();
});

// Handle all auth routes
app.all("/api/auth/*", async (c) => {
  const auth = c.get("auth");
  return auth.handler(c.req.raw);
});

// app.on(["GET", "POST"], "/api/auth/*", (c) => {
//   const auth = createAuth(
//     c.env,
//     (c.req.raw.cf ?? {}) as IncomingRequestCfProperties,
//     c.env.BETTER_AUTH_URL ?? new URL(c.req.url).origin,
//   );
//   return auth.handler(c.req.raw);
// });

app.use("*", async (c, next) => {
  const auth = c.get("auth");
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  c.set("user", session?.user ?? null);
  c.set("session", session?.session ?? null);
  await next();
});

app.use("/api/*", async (c, next) => {
  c.set("db", createDb(c.env.DB));
  await next();
});

app.route("/agents", chatRoute);

const apiRoutes = app
  .basePath("/api")
  .route("/expenses", expenseRoute)
  .route("/categories", categoriesRoute)
  .route("/groups", groupsRoute)
  .route("/users", usersRoute)
  .route("/upload", uploadRoute);

export default app;
export type ApiRoutes = typeof apiRoutes;
export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};
