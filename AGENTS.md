# Programming Guidelines

DO NOT USE UseEffect UNLESS ABSOLUTELY NECESSARY. Rely on TanStack Query primitives.
DO NOT USE UseEffect UNLESS ABSOLUTELY NECESSARY.

Git commands require escalation.

## Commits

- Commit only stable checkpoints. Do not commit code that is knowingly broken,
  partially migrated, or still depends on follow-up fixes in the same area.
- Keep commits scoped to one concern when possible. Split provider/runtime
  changes, schema/persistence changes, UI changes, and debug/logging changes
  into separate commits unless they are tightly coupled.
- Do not commit local debugging artifacts such as captured response payloads,
  scratch files, or one-off logs unless the user explicitly asks for them.
- Before committing deploy-critical changes, check the diff for accidental
  config drift, stale fallback paths, and unused bindings.
- Workflow code changes must be verified with a new workflow instance after
  deploy. Do not treat retrying an old workflow instance as valid verification.

## Database and Schemas

`server/db/schema.ts` is the source of truth for database tables, inferred TypeScript
types, and runtime validation schemas.

When data is backed by the database:

- Define the table with Drizzle in `server/db/schema.ts`.
- Derive Zod schemas from that table with `createSelectSchema`, `createInsertSchema`,
  and `createUpdateSchema`.
- Export TypeScript types with `z.infer<typeof schemaName>`.
- Validate external inputs with the exported Zod schemas instead of hand-written
  TypeScript casts.
- Keep shared API/workflow payload schemas in `server/db/schema.ts` when they map
  to database concepts. Build them from DB-derived schemas where possible, then
  extend/refine for fields that do not exist directly in the table.

Avoid duplicating schema-shaped types in route or workflow files. If a route,
workflow, or frontend component needs the shape, import the exported Zod schema
or inferred type from `server/db/schema.ts`.

## Adding a Table

1. Add the Drizzle table in `server/db/schema.ts`.
2. Add `select`, `insert`, and `update` Zod schemas with the Drizzle Zod helpers.
3. Export inferred `Select`, `Insert`, and `Update` types from those schemas.
4. Add relations in the `relations` definition when the table connects to another
   table.
5. Register the table in `server/db/index.ts` so Drizzle knows about it.
6. Run `bun run db:generate` to create and sync migrations.
7. Update routes/workflows to validate with the exported Zod schemas, not with
   local casts.
8. Run `bunx tsc --noEmit`.

## Migrations

This repo uses a split migration workflow:

- `drizzle/migrations/` is Drizzle's nested internal history.
- `drizzle/d1/` is the flattened Wrangler-ready SQL history.
- `migrations/` is the legacy flat history and is still used as sync input.

Use:

- `bun run auth:generate` when Better Auth schema changes.
- `bun run db:generate` after schema changes. This runs Drizzle generate and then
  syncs flat D1 migrations.
- `wrangler d1 migrations apply gastos-db --local`
- `wrangler d1 migrations apply gastos-db --remote`

Do not point Wrangler at `drizzle/migrations/` directly. Keep the Drizzle
baseline folder in `drizzle/migrations/`; future diffs depend on it.

## Adding a Non-Table Payload Schema

Some payloads are not tables themselves but still represent database-backed data,
for example an LLM import payload that later becomes `statements` and `expenses`.
Keep those schemas in `server/db/schema.ts` too.

For those schemas:

- Compose from DB-derived schemas with `.pick()`, `.omit()`, `.extend()`, and
  `.refine()` where possible.
- Export the Zod schema and the inferred type.
- If an LLM needs a JSON Schema, generate it from Zod with `toJSONSchema(...)`
  instead of maintaining a second schema by hand.
- Validate parsed JSON at the boundary before inserting into the database.

## UI Work

- Batch small visual-only tweaks and run validation after the batch, not after
  every one-line class change.
- If a component already exists, first identify whether the task is to replace
  its implementation, extend its data shape, or add a new component. State that
  assumption briefly before editing.
