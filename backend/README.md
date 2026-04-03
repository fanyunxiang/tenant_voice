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
