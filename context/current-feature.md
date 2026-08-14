# Current Feature

**Dashboard UI phase 3: main area.** Fill the `/dashboard` placeholder with the content column — stats cards, recent collections, pinned items and recent items — driven by mock data. Spec: @context/features/dashboard-phase-3-spec.md

## Status

In Progress

## Goals

- The main area to the right
- 4 stats cards at the top: item count, collection count, favorite items, favorite collections (not in the screenshot)
- Recent collections
- Pinned items
- 10 recent items

## Notes

- Data comes straight from @src/lib/mock-data.ts (direct import) until the database exists. The spec references `mock-data.js` — the file is TypeScript.
- Layout reference: @context/screenshots/dashboard-ui-main.png
- Keep the phase 1/2 conventions: semantic classes in `globals.css`, no Tailwind utility strings in the markup.
- Collection cards are color-coded by `primaryTypeId`, item cards by their type — reuse the `--type-*` custom properties added in phase 2.
- The mock data has only 8 items, so "10 recent items" caps out at whatever exists.

## History

<!-- Keep this updated. Earliest to latest -->

- **2026-08-06 — Initial Next.js setup.** Scaffolded with `create-next-app`: Next.js 16.3, React 19.2, TypeScript strict, Tailwind CSS v4, ESLint, App Router, `@/*` path alias.
- **2026-08-07 — Project structure cleanup.** Stripped the starter boilerplate down to a minimal `layout.tsx` / `page.tsx`, added the `context/` docs (project overview, coding standards, AI interaction, this template).
- **2026-08-14 — Dashboard UI phase 1: layout shell.** Initialized ShadCN UI (radix base, nova preset; `button` / `input` / `separator`), added `/dashboard` with a sidebar + top bar + scrollable main shell, dark mode by default via `.dark` on `<html>`, and a display-only top bar (search, New Collection, New Item). Sidebar and main are `h2` placeholders. Layout styles live in `globals.css` as semantic classes so the markup carries no Tailwind utility strings. Spec: @context/features/dashboard-phase-1-spec.md
- **2026-08-14 — Dashboard UI phase 2: sidebar.** Replaced the sidebar placeholder with the real navigation, fed by `src/lib/mock-data.ts`: brand, collapsible Types section linking to `/items/[type]`, Collections split into Favorites and Recent, and a user avatar area. Added `SidebarProvider` (client context holding the open state, the mobile backdrop and Escape handling) and a `SidebarToggle` in the top bar. Collapsing on desktop narrows the sidebar to a 3.5rem icon rail; below the breakpoint it is always an overlay drawer, closed by default. Type colors became `--type-*` custom properties in `globals.css`; `src/constants/item-types.ts` maps icon names to lucide components. Top bar action labels hide on mobile so the bar no longer overflows. Spec: @context/features/dashboard-phase-2-spec.md
