# Current Feature

<!-- Feature name and short description -->

## Status

<!-- Not Started | In Progress | Completed -->

## Goals

<!-- Goals and requirements -->

## Notes

<!--  Any extra notes -->

## History

<!-- Keep this updated. Earliest to latest -->

- **2026-08-06 — Initial Next.js setup.** Scaffolded with `create-next-app`: Next.js 16.3, React 19.2, TypeScript strict, Tailwind CSS v4, ESLint, App Router, `@/*` path alias.
- **2026-08-07 — Project structure cleanup.** Stripped the starter boilerplate down to a minimal `layout.tsx` / `page.tsx`, added the `context/` docs (project overview, coding standards, AI interaction, this template).
- **2026-08-14 — Dashboard UI phase 1: layout shell.** Initialized ShadCN UI (radix base, nova preset; `button` / `input` / `separator`), added `/dashboard` with a sidebar + top bar + scrollable main shell, dark mode by default via `.dark` on `<html>`, and a display-only top bar (search, New Collection, New Item). Sidebar and main are `h2` placeholders. Layout styles live in `globals.css` as semantic classes so the markup carries no Tailwind utility strings. Spec: @context/features/dashboard-phase-1-spec.md
- **2026-08-14 — Dashboard UI phase 2: sidebar.** Replaced the sidebar placeholder with the real navigation, fed by `src/lib/mock-data.ts`: brand, collapsible Types section linking to `/items/[type]`, Collections split into Favorites and Recent, and a user avatar area. Added `SidebarProvider` (client context holding the open state, the mobile backdrop and Escape handling) and a `SidebarToggle` in the top bar. Collapsing on desktop narrows the sidebar to a 3.5rem icon rail; below the breakpoint it is always an overlay drawer, closed by default. Type colors became `--type-*` custom properties in `globals.css`; `src/constants/item-types.ts` maps icon names to lucide components. Top bar action labels hide on mobile so the bar no longer overflows. Spec: @context/features/dashboard-phase-2-spec.md
- **2026-08-14 — Dashboard UI phase 3: main area.** Replaced the `/dashboard` placeholder with the content column, fed by `src/lib/mock-data.ts`: four stats cards (items, collections, favorite items, favorite collections), the 6 most recent collections as a card grid, pinned items, and the 10 most recent items. Added `collection-card` / `collection-grid`, `item-card` / `item-list`, and one component per dashboard section so the page only composes. `ITEM_TYPES_BY_ID` in `src/lib/item-types.ts` resolves type ids; `formatShortDate` moved into `src/lib/utils.ts`. Color coding now flows through a `--type-color` custom property resolved from `data-type`, replacing the sidebar-specific rules from phase 2. Left out the screenshot's "View all" link — `/collections` does not exist yet. Spec: @context/features/dashboard-phase-3-spec.md
