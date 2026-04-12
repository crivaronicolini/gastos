import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { logger } from "hono/logger";

import { expenseRoute } from "./routes/expenses.ts";

const app = new Hono();

app.use("*", logger());

const apiRoutes = app.basePath("/api").route("/expenses", expenseRoute);

app.use("*", serveStatic({ root: "./frontend/dist" }));
app.get("*", serveStatic({ path: "./sfrontend/dist/index.html" }));

export default app;
export type ApiRoutes = typeof apiRoutes;
