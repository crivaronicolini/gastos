# Migrations

This project now uses two migration formats at the same time:

- `drizzle/migrations/`
  - Nested Drizzle beta migration folders.
  - Used only as Drizzle's internal history so `drizzle-kit generate` can diff future schema changes correctly.
- `drizzle/d1/`
  - Flat `.sql` files.
  - This is the directory Wrangler reads and applies to D1.

There is also an older flat migration history in `migrations/`.
That directory is kept as the original applied history and is used as input when rebuilding `drizzle/d1/`.

## Why this split exists

Drizzle beta generates nested migration folders like:

```text
drizzle/migrations/20260425015349_slimy_mentor/
  migration.sql
  snapshot.json
```

Wrangler D1 does not use that format in this repo's workflow. Wrangler expects flat `.sql` files in the directory configured by `migrations_dir`.

Because of that:

- Drizzle writes to `drizzle/migrations/`
- a sync step flattens migrations into `drizzle/d1/`
- Wrangler applies `drizzle/d1/`

## Current config

Drizzle config:

- [drizzle.config.ts](/home/marco/Documents/projectos/gastos/drizzle.config.ts)
  - `schema: "./server/db/*.ts"`
  - `out: "./drizzle/migrations"`

Wrangler config:

- [wrangler.jsonc](/home/marco/Documents/projectos/gastos/wrangler.jsonc)
  - `migrations_dir: "./drizzle/d1"`

Sync script:

- [scripts/sync-d1-migrations.mjs](/home/marco/Documents/projectos/gastos/scripts/sync-d1-migrations.mjs)

## Commands

Generate Better Auth schema:

```bash
bun run auth:generate
```

Generate DB migrations and sync them for Wrangler:

```bash
bun run db:generate
```

That command does two things:

1. Runs `drizzle-kit generate`
2. Runs `bun run db:sync`

Run the sync step manually:

```bash
bun run db:sync
```

Apply migrations locally:

```bash
wrangler d1 migrations apply gastos-db --local
```

Apply migrations remotely:

```bash
wrangler d1 migrations apply gastos-db --remote
```

## Workflow for a new migration

1. Change the schema in `server/db/`
2. If the auth schema changed, run:

```bash
bun run auth:generate
```

3. Generate DB migrations:

```bash
bun run db:generate
```

4. Check the outputs:
   - new nested migration in `drizzle/migrations/`
   - new flat SQL file in `drizzle/d1/`

5. Apply locally:

```bash
wrangler d1 migrations apply gastos-db --local
```

6. Apply remotely when ready:

```bash
wrangler d1 migrations apply gastos-db --remote
```

## Important detail: baseline migration

The folder:

- `drizzle/migrations/20260425015349_slimy_mentor/`

is an internal Drizzle baseline.

It exists so Drizzle can compute future diffs from the current schema state. It must not be copied into Wrangler's flat D1 migration directory as a new migration.

The sync script explicitly skips that folder.

If you delete or rename that baseline folder, update:

- [scripts/sync-d1-migrations.mjs](/home/marco/Documents/projectos/gastos/scripts/sync-d1-migrations.mjs)

## Directory roles

- `migrations/`
  - legacy flat migration history already used by this project
- `drizzle/migrations/`
  - nested Drizzle history for diffing
- `drizzle/d1/`
  - flattened Wrangler-ready migration files

## Notes

- Do not point Wrangler directly at `drizzle/migrations/`
- Do not rely on Drizzle beta nested folders being applied directly by Wrangler in this repo
- Use `bun run db:generate`, not raw `drizzle-kit generate`, so the flattening step always runs
