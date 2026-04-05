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

## Operator App Architecture (Task #4)

The Operator app uses a **user-defined trackables system** (not a fixed form). Key points:

- **Daily Dashboard** (`/`) — dynamic form generated from user's configured trackables, grouped by section (category). Includes an end-of-day reflection section with 4 free-text fields. On submit, saves metric logs + creates AI analysis (daily-checkin).
- **Customize Dashboard** (`/customize`) — CRUD for trackables. Each trackable has: name, type, category/section, unit, targetValue, aiContext (for AI), displayOrder. Supports up/down arrows for reordering within sections.
- **History** (`/history`) — read-only view of past check-ins
- **Navigation** — 3 items: Daily, History, Customize

### Trackable Types
- `number` — numeric input
- `checkbox` — yes/no
- `toggle` — on/off switch
- `text` — free text area
- `duration` — HH:MM two-field input
- `scale` — slider 1–10
- `dropdown` — dropdown from comma-separated options in targetValue

### Database Schema
- `metrics` table — trackable definitions with: `unit`, `aiContext`, `displayOrder` (new in Task #4)
- `metric_logs` table — daily logged values per trackable
- `daily_checkins` table — daily check-in with AI outputs, includes 4 reflection fields: `reflectionFeltGood`, `reflectionFeltOff`, `reflectionGotInWay`, `reflectionAnythingUnusual` (new in Task #4)

### AI Context
The AI (Claude + OpenAI) reads: trackable definitions (name, type, unit, aiContext), logged values, and reflection text to give personalized analysis.

- Claude (`claude-sonnet-4-6`, max_tokens 8192) via `@workspace/integrations-anthropic-ai`
- OpenAI (`gpt-4o`, max_completion_tokens 2048) via `@workspace/integrations-openai-ai-server`


## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
