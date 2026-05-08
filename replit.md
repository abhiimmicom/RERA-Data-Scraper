# RERA Agents Dashboard

A web scraper and data viewer for RERA-registered real estate agents in Delhi. Scrapes data from the Delhi RERA website and stores it in a PostgreSQL database, displaying it in a searchable, filterable table.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/rera-dashboard run dev` — run the frontend (port 19583)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + axios + cheerio (scraping)
- DB: PostgreSQL + Drizzle ORM
- Frontend: React + Vite + TanStack Query + shadcn/ui
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/db/src/schema/agents.ts` — DB schema for `rera_agents` table
- `artifacts/api-server/src/lib/scraper.ts` — web scraper (axios + cheerio)
- `artifacts/api-server/src/routes/agents.ts` — agents REST API
- `artifacts/api-server/src/routes/scraper.ts` — scraper trigger & status API
- `artifacts/rera-dashboard/src/` — React frontend

## Architecture decisions

- Contract-first: OpenAPI spec drives both Zod validation schemas (server) and React Query hooks (client) via Orval codegen.
- Scraper runs server-side only, triggered by POST /api/scraper/run. It handles pagination via next-page link detection.
- Agents are upserted on registration number to avoid duplicates across scrape runs.
- Cheerio is used for HTML parsing (lightweight, no headless browser needed).
- The scraper respects the RERA site with 1.5s delays between pages.

## Product

- Dashboard: Stats cards showing totals, individuals, companies, active/expired
- Main table: Searchable and filterable by agent type, paginated
- Agent detail page: Full record view with active/expired badge
- "Sync Database" button triggers the scraper; shows progress feedback

## Gotchas

- The RERA website HTML structure may change — scraper uses multiple fallback selectors
- Run codegen after any OpenAPI spec change: `pnpm --filter @workspace/api-spec run codegen`
- Scraper maxPages defaults to 10; increase via query param: POST /api/scraper/run?maxPages=50
- Always push DB schema changes before restarting the API server

## User preferences

- Show data only in tables (no cards for individual records)
