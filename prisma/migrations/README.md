# Prisma Migrations Policy

This project currently uses a manual-safe migration workflow because local DB state may not match a full `prisma migrate dev` history.

## Current Rule

- Do **not** run `prisma migrate reset` on shared/dev data unless explicitly approved.
- Prefer additive or targeted SQL migrations executed with:

```bash
npx prisma db execute --file "prisma/migrations/<timestamp_name>/migration.sql" --schema "prisma/schema"
```

- After schema changes, always run:

```bash
npx prisma generate
```

## Naming Convention

- Folder: `prisma/migrations/YYYYMMDDHHMMSS_<short-description>/`
- SQL file: `migration.sql`

Example:

- `prisma/migrations/20260208193000_rename_is_leave_approver_to_is_request_approver/migration.sql`

## Authoring Guidelines

- Write idempotent SQL where possible (`IF EXISTS` guards).
- Keep migrations scoped to one concern.
- Avoid destructive changes without backup and explicit approval.
- For renames, prefer `ALTER TABLE ... RENAME COLUMN` over drop/create when data must be preserved.

## Verification Checklist

1. Execute SQL migration with `prisma db execute`.
2. Run `npx prisma generate`.
3. Run lint/type checks for touched modules.
4. Smoke-test affected routes/actions.
