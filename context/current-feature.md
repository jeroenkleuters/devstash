# Current Feature

**Seed data.** Rewrite `prisma/seed.ts` to populate the database with a demo user, the system item types, and five collections of sample items for development and demos. Spec: @context/features/seed-spec.md

## Status

In Progress

## Goals

- Demo user: `demo@devstash.io` / "Demo User", password `12345678` hashed with bcryptjs (12 rounds), `isPro: false`, `emailVerified` set to now
- The seven system item types (`isSystem: true`) with the icons and colors from the spec table
- Five collections with their items — 18 in total:
  - **React Patterns** — 3 TypeScript snippets (custom hooks, component patterns, utilities)
  - **AI Workflows** — 3 prompts (code review, documentation generation, refactoring)
  - **DevOps** — 1 snippet, 1 command, 2 links (real URLs)
  - **Terminal Commands** — 4 commands (git, docker, process management, package managers)
  - **Design Resources** — 4 links (real URLs: CSS/Tailwind, component libraries, design systems, icons)

## Notes

- The existing seed (system types only, imported from @src/lib/mock-data.ts) can be overwritten wholesale.
- `bcryptjs` is not installed yet — it becomes a runtime dependency, since auth will hash passwords with it too.
- The spec names types in the singular (`snippet`); `ItemType` also needs the `slug` used by `/items/[type]`, so derive the plural slug (`snippets`) and pick a display name.
- Keep the seed idempotent — `npm run db:seed` should be safe to re-run. System types have `userId: null`, and Postgres treats NULLs as distinct, so they need a find-then-write instead of `upsert`.
- Every item needs `contentType` (`TEXT` / `URL` / `FILE`) alongside its type, and links need `url` rather than `content`.
- Verify afterwards with `npm run db:test`, which reports row counts and seeded types.

## History

<!-- Keep this updated. Earliest to latest -->

- **2026-08-06 — Initial Next.js setup.** Scaffolded with `create-next-app`: Next.js 16.3, React 19.2, TypeScript strict, Tailwind CSS v4, ESLint, App Router, `@/*` path alias.
- **2026-08-07 — Project structure cleanup.** Stripped the starter boilerplate down to a minimal `layout.tsx` / `page.tsx`, added the `context/` docs (project overview, coding standards, AI interaction, this template).
- **2026-08-14 — Dashboard UI phase 1: layout shell.** Initialized ShadCN UI (radix base, nova preset; `button` / `input` / `separator`), added `/dashboard` with a sidebar + top bar + scrollable main shell, dark mode by default via `.dark` on `<html>`, and a display-only top bar (search, New Collection, New Item). Sidebar and main are `h2` placeholders. Layout styles live in `globals.css` as semantic classes so the markup carries no Tailwind utility strings. Spec: @context/features/dashboard-phase-1-spec.md
- **2026-08-14 — Dashboard UI phase 2: sidebar.** Replaced the sidebar placeholder with the real navigation, fed by `src/lib/mock-data.ts`: brand, collapsible Types section linking to `/items/[type]`, Collections split into Favorites and Recent, and a user avatar area. Added `SidebarProvider` (client context holding the open state, the mobile backdrop and Escape handling) and a `SidebarToggle` in the top bar. Collapsing on desktop narrows the sidebar to a 3.5rem icon rail; below the breakpoint it is always an overlay drawer, closed by default. Type colors became `--type-*` custom properties in `globals.css`; `src/constants/item-types.ts` maps icon names to lucide components. Top bar action labels hide on mobile so the bar no longer overflows. Spec: @context/features/dashboard-phase-2-spec.md
- **2026-08-14 — Dashboard UI phase 3: main area.** Replaced the `/dashboard` placeholder with the content column, fed by `src/lib/mock-data.ts`: four stats cards (items, collections, favorite items, favorite collections), the 6 most recent collections as a card grid, pinned items, and the 10 most recent items. Added `collection-card` / `collection-grid`, `item-card` / `item-list`, and one component per dashboard section so the page only composes. `ITEM_TYPES_BY_ID` in `src/lib/item-types.ts` resolves type ids; `formatShortDate` moved into `src/lib/utils.ts`. Color coding now flows through a `--type-color` custom property resolved from `data-type`, replacing the sidebar-specific rules from phase 2. Left out the screenshot's "View all" link — `/collections` does not exist yet. Spec: @context/features/dashboard-phase-3-spec.md
- **2026-08-14 — Prisma 7 + Neon PostgreSQL.** Stood up the database layer. Schema in `prisma/schema.prisma` follows the project-overview draft (NextAuth models, `ContentType` enum, cascade deletes, indexes) plus `ItemType.slug` and `@@index([userId, updatedAt])` on Item. Migration `20260814120000_init` applied to the Neon dev branch and verified end to end through the app. `prisma/seed.ts` seeds the seven system item types idempotently. Prisma 7 specifics: `prisma-client` generator (not `prisma-client-js`) outputting TypeScript to `src/generated/prisma` (gitignored, rebuilt by `postinstall`), the mandatory driver adapter (`@prisma/adapter-neon` over `@neondatabase/serverless`) in `src/lib/prisma.ts`, connection URLs moved to `prisma.config.ts`, and dotenv loading `.env.local`/`.env` since v7 no longer reads env files itself. CLI uses `DIRECT_URL` (Neon's pooler cannot hold the schema engine's advisory locks), runtime uses pooled `DATABASE_URL`. Scripts: `db:migrate`, `db:deploy`, `db:status`, `db:seed`, `db:studio`. Spec: @context/features/database-spec.md
