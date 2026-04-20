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
6. Add a migration in `migrations/`.
7. Update routes/workflows to validate with the exported Zod schemas, not with
   local casts.
8. Run `bunx tsc --noEmit`.

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
