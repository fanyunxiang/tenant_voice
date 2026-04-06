# Backend Service

TypeScript service layer that encapsulates Supabase/Postgres business logic for TenantVoice.

## Structure

- `src/db` – shared database clients (Supabase, connection pooling helpers).
- `src/services` – domain services (e.g., notifications, tasks) that orchestrate queries.
- `src/types` – shared backend data contracts.
- `dist/` – generated JavaScript after running `pnpm build`.

## Development

```bash
cd backend
pnpm install
pnpm typecheck # optional
pnpm build
```

Create a `.env` (or copy `.env.example`) with the Supabase + Postgres secrets before running any scripts.  
Preferred key names are `SUPABASE_SECRET_KEY` + `SUPABASE_URL` (legacy `SUPABASE_SERVICE_KEY` is still supported).

## Prisma (ORM)

Prisma is configured under `backend/prisma/schema.prisma` with Supabase pooling + direct URLs:

- `DATABASE_URL` (pooler, for app/runtime queries)
- `DIRECT_URL` (direct 5432, for migrations)

Common commands:

```bash
pnpm -C backend prisma:generate
pnpm -C backend prisma:pull
pnpm -C backend prisma:migrate:dev
```
