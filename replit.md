# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Operator App — Architecture

Three data-first workflow pages:
- **End-of-Day Review** (`/`) — log sleep, nutrition, activity, tasks, reflection; Claude insight (amber) + OpenAI tomorrow plan (blue)
- **Pre-Day Plan** (`/pre-day`) — tasks + calendar + energy note; OpenAI daily structure + Claude pattern context
- **Pre-Week Plan** (`/pre-week`) — goals + calendar + capacity; OpenAI weekly structure + Claude pattern context
- **History** (`/history`) — three tabs (EOD Reviews, Day Plans, Week Plans) with accordion cards

## DB Schema (lib/db)

Active tables:
- `end_of_day_reviews` — all EOD fields + ai_insight + ai_tomorrow
- `pre_day_plans` — date, tasks_planned, calendar_commitments, energy_note, ai_plan, ai_context
- `pre_week_plans` — week_start_date, goals, calendar_commitments, capacity_note, reflection, ai_plan, ai_context

Legacy tables (still in DB, unused): `daily_checkins`, `weekly_reviews`, `metrics`, `metric_logs`

## API Routes

- `GET/POST /api/eod-reviews` + `GET/DELETE /api/eod-reviews/:id`
- `GET/POST /api/pre-day-plans` + `GET/DELETE /api/pre-day-plans/:id`
- `GET/POST /api/pre-week-plans` + `GET/DELETE /api/pre-week-plans/:id`
- `GET /api/operator/stats`

## AI

- Claude (`claude-sonnet-4-6`, max_tokens 8192) via `@workspace/integrations-anthropic-ai`
- OpenAI (`gpt-4o`, max_completion_tokens 2048) via `@workspace/integrations-openai-ai-server`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
