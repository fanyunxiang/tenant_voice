# TenantVoice Platform

TenantVoice is a tenant-experience platform that pairs a React/Next.js front end with a Supabase + PostgreSQL backend, and targets Vercel for hosting. This repo now treats the UI and business logic as first-class, separate workspaces so teams can iterate on each surface independently.

## Tech Stack

- **Frontend:** Next.js 15 (App Router) + React 19 RC, Chakra UI, ApexCharts, pnpm
- **Backend:** Supabase client SDK, Zod validation, custom service layer written in TypeScript
- **Database:** Supabase-managed PostgreSQL (single source of truth for tenant + notification data)
- **Deployment:** Vercel (frontend) + Supabase (database + managed auth) with room for serverless functions or cron jobs

## Repository Structure

```
.
├── backend/        # Supabase/Postgres business logic and domain services
├── docs/           # Functional scope and feature requirement documents
├── frontend/       # Next.js application (app router, Chakra UI components, assets)
└── README.md
```

> The repo is managed as a pnpm workspace. Always run `pnpm install` (and most other commands) from the repository root so dependencies are shared across `frontend/` and `backend/`.

### Frontend (`frontend/`)

| Item | Description |
| --- | --- |
| Entry point | `frontend/src/app` (Next.js App Router) |
| UI system | Chakra UI theme in `frontend/src/theme` + reusable cards/views |
| Data layer | Ready to call Supabase or custom APIs via `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_API_URL` |
| Scripts | `pnpm dev`, `pnpm build`, `pnpm start`, `pnpm lint` |

#### Getting started

```bash
pnpm install                     # installs every workspace package once
cd frontend && cp .env.example .env.local
pnpm --filter tenantvoice dev    # or pnpm dev:frontend from repo root
```

### Backend (`backend/`)

| Item | Description |
| --- | --- |
| Entry point | Service modules under `backend/src/services` |
| Database client | `backend/src/db/supabaseClient.ts` instantiates Supabase using service role credentials |
| Domain example | `notificationsService.ts` shows how to query/update the `notifications` table |
| Scripts | `pnpm install`, `pnpm typecheck`, `pnpm build` |

#### Getting started

```bash
cd backend && cp .env.example .env
pnpm --filter tenantvoice-backend typecheck   # optional sanity check
pnpm --filter tenantvoice-backend build       # emits dist/ for serverless jobs or cron tasks
```

## Environment Variables

| Location | File | Required Keys |
| --- | --- | --- |
| Frontend | `frontend/.env.local` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL` |
| Backend | `backend/.env` | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, optional `SUPABASE_ANON_KEY`, `POSTGRES_CONNECTION_STRING` |

> The backend uses the Supabase **service role** key for privileged operations (marking notifications as read, inserting events). Never expose that key to the browser.

## Recommended Workflow

1. **Design or update business logic** inside `backend/src/services`. Validate with `pnpm typecheck`.
2. **Expose APIs** via Supabase Edge Functions or Next.js route handlers that import the backend services. (`frontend/next.config.js` enables `externalDir`, so frontend routes can import from `../backend` if needed.)
3. **Consume data on the frontend** through server components or client hooks located under `frontend/src/views` and `frontend/src/components`.
4. **Deploy frontend** with `pnpm build` followed by `vercel --prebuilt` or the Vercel dashboard. Supabase handles migrations + seed scripts referenced by backend services.

## Deployment Notes

- **Frontend on Vercel:** connect the `frontend/` directory as the project root, set the build command to `pnpm build`, and output directory to `.next`.
- **Database + Auth:** manage schema changes through Supabase SQL editor or `supabase db push`. The backend service layer assumes a `notifications` table with columns used in `NotificationRecord`.
- **Serverless / Cron:** package anything under `backend/dist` into Supabase Edge Functions, Vercel Cron Jobs, or another worker runtime.

## Testing & Quality Gates

- Run `pnpm lint` in `frontend` to apply ESLint + Next.js rules.
- Backend logic stays type-safe via `pnpm typecheck`. Add domain-specific tests (Vitest/Jest) as the service layer grows.

## Documentation & Requirements

Original scope and feature details live in `docs/TenantVoice Project Scope.docx` and `docs/App Features - TenantVoice.docx`. Update those documents alongside any major product decision so the repo stays aligned with stakeholder expectations.

## Contributing

1. Fork or branch.
2. Update either `backend/` or `frontend/` (keep changes scoped to one side when possible).
3. Run the relevant lint/build commands.
4. Open a PR summarizing user impact, migrations, and deployment notes.

---

© 2022‑2026 Yunxiang Fan. Distributed under the MIT License (see `LICENSE`).
