# Current Feature

**Dashboard collections from the database.** Replace the mock collection data in the dashboard's main area with real collections read from Neon through Prisma. Spec: @context/features/dashboard-collections-spec.md

## Status

Completed

## Goals

- New `src/lib/db/collections.ts` holding the collection data-fetching functions
- The dashboard server component fetches collections directly (no API route)
- Card border color derived from the most-used content type within each collection
- Small icons for every type present in a collection
- Collection stats display updated to match the real data
- Keep the existing design — same six recent-collection cards as now

## Notes

- Items under the collections stay on mock data for now; that comes in a later step.
- Reference @context/screenshots/dashboard-ui-main.png if needed, but the layout and styling already exist.
- The seed (from the previous feature) provides the five demo collections to render against.

## History

<!-- Keep this updated. Earliest to latest -->

- **2026-08-06 — Initial Next.js setup.** Scaffolded with `create-next-app`: Next.js 16.3, React 19.2, TypeScript strict, Tailwind CSS v4, ESLint, App Router, `@/*` path alias.
- **2026-08-07 — Project structure cleanup.** Stripped the starter boilerplate down to a minimal `layout.tsx` / `page.tsx`, added the `context/` docs (project overview, coding standards, AI interaction, this template).
- **2026-08-14 — Dashboard UI phase 1: layout shell.** Initialized ShadCN UI (radix base, nova preset; `button` / `input` / `separator`), added `/dashboard` with a sidebar + top bar + scrollable main shell, dark mode by default via `.dark` on `<html>`, and a display-only top bar (search, New Collection, New Item). Sidebar and main are `h2` placeholders. Layout styles live in `globals.css` as semantic classes so the markup carries no Tailwind utility strings. Spec: @context/features/dashboard-phase-1-spec.md
- **2026-08-14 — Dashboard UI phase 2: sidebar.** Replaced the sidebar placeholder with the real navigation, fed by `src/lib/mock-data.ts`: brand, collapsible Types section linking to `/items/[type]`, Collections split into Favorites and Recent, and a user avatar area. Added `SidebarProvider` (client context holding the open state, the mobile backdrop and Escape handling) and a `SidebarToggle` in the top bar. Collapsing on desktop narrows the sidebar to a 3.5rem icon rail; below the breakpoint it is always an overlay drawer, closed by default. Type colors became `--type-*` custom properties in `globals.css`; `src/constants/item-types.ts` maps icon names to lucide components. Top bar action labels hide on mobile so the bar no longer overflows. Spec: @context/features/dashboard-phase-2-spec.md
- **2026-08-14 — Dashboard UI phase 3: main area.** Replaced the `/dashboard` placeholder with the content column, fed by `src/lib/mock-data.ts`: four stats cards (items, collections, favorite items, favorite collections), the 6 most recent collections as a card grid, pinned items, and the 10 most recent items. Added `collection-card` / `collection-grid`, `item-card` / `item-list`, and one component per dashboard section so the page only composes. `ITEM_TYPES_BY_ID` in `src/lib/item-types.ts` resolves type ids; `formatShortDate` moved into `src/lib/utils.ts`. Color coding now flows through a `--type-color` custom property resolved from `data-type`, replacing the sidebar-specific rules from phase 2. Left out the screenshot's "View all" link — `/collections` does not exist yet. Spec: @context/features/dashboard-phase-3-spec.md
- **2026-08-14 — Prisma 7 + Neon PostgreSQL.** Stood up the database layer. Schema in `prisma/schema.prisma` follows the project-overview draft (NextAuth models, `ContentType` enum, cascade deletes, indexes) plus `ItemType.slug` and `@@index([userId, updatedAt])` on Item. Migration `20260814120000_init` applied to the Neon dev branch and verified end to end through the app. `prisma/seed.ts` seeds the seven system item types idempotently. Prisma 7 specifics: `prisma-client` generator (not `prisma-client-js`) outputting TypeScript to `src/generated/prisma` (gitignored, rebuilt by `postinstall`), the mandatory driver adapter (`@prisma/adapter-neon` over `@neondatabase/serverless`) in `src/lib/prisma.ts`, connection URLs moved to `prisma.config.ts`, and dotenv loading `.env.local`/`.env` since v7 no longer reads env files itself. CLI uses `DIRECT_URL` (Neon's pooler cannot hold the schema engine's advisory locks), runtime uses pooled `DATABASE_URL`. Scripts: `db:migrate`, `db:deploy`, `db:status`, `db:seed`, `db:studio`. Spec: @context/features/database-spec.md
- **2026-08-14 — Seed data.** Rewrote `prisma/seed.ts` to populate a demo account and sample content: `demo@devstash.io` / "Demo User" (password `12345678`, bcryptjs 12 rounds, `isPro: false`), the seven system item types (`isSystem: true`, `userId: null`, find-then-write since Postgres treats NULLs as distinct in the unique index), and five collections holding 18 items — React Patterns (3 snippets), AI Workflows (3 prompts), DevOps (snippet + command + 2 links), Terminal Commands (4 commands), Design Resources (4 links). Re-running rebuilds the demo user's content instead of duplicating it. Added `bcryptjs` as a runtime dependency (auth will reuse it). `scripts/test-db.ts` now prints the seeded data and asserts integrity: no orphaned items, TEXT items have `content`, URL items have `url`, and no item carries both. Spec: @context/features/seed-spec.md
- **2026-08-15 — Dashboard collections from the database.** The dashboard's collection grid now reads from Neon instead of `src/lib/mock-data.ts`. New `src/lib/db/collections.ts` holds `getRecentCollections(userId, limit)` — one query ordered by `updatedAt` desc that selects each collection's items down to their `itemType` — and `getCollectionStats(userId)`; a `rankTypes` helper dedupes types most-common-first so `types[0]` drives the card's border color and the icon row shows every type present. `src/lib/db/user.ts` resolves the seeded `demo@devstash.io` account as a stand-in for the session until NextAuth lands. `CollectionsSection` and `StatCards` became async server components fetching directly; `CollectionCard` / `CollectionGrid` are typed on `CollectionSummary` and take the type metadata embedded in the collection instead of going through `ITEM_TYPES_BY_ID`. `/dashboard` is `force-dynamic` so it is not prerendered against build-time data. Item stats and the item lists stay on mock data — those come later. Spec: @context/features/dashboard-collections-spec.md
