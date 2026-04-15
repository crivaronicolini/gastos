import { Hono } from "hono";
import { logger } from "hono/logger";

import { createDb, type Db } from "./db";
import { categoriesRoute } from "./routes/categories.ts";
import { expenseRoute } from "./routes/expenses.ts";
import { usersRoute } from "./routes/users.ts";

type Bindings = {
  DB: D1Database;
};

type Variables = {
  db: Db;
};

const app = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

app.use("*", logger());

app.use("/api/*", async (c, next) => {
  c.set("db", createDb(c.env.DB));
  await next();
});

const apiRoutes = app
  .basePath("/api")
  .route("/expenses", expenseRoute)
  .route("/categories", categoriesRoute)
  .route("/users", usersRoute);

export default app;
export type ApiRoutes = typeof apiRoutes;
export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};
