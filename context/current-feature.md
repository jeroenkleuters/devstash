# Current Feature

Dashboard UI — Phase 1: base layout shell at `/dashboard` with ShadCN set up, dark mode by default, and a display-only top bar. Full spec: @context/features/dashboard-phase-1-spec.md

## Status

In Progress

## Goals

Phase 1 of 3 for the dashboard UI layout. Use @context/screenshots/dashboard-ui-main.png as the visual reference.

- Initialize ShadCN UI and install the components needed for this phase
- Dashboard route at `/dashboard`
- Main dashboard layout plus any global styles
- Dark mode by default
- Top bar with search and "new item" button (display only — no behavior yet)
- Placeholder sidebar and main area: just an `h2` with "Sidebar" and "Main" for now

## Notes

- Phases 2 and 3 are specced separately (@context/features/dashboard-phase-2-spec.md, @context/features/dashboard-phase-3-spec.md) — keep this phase to the shell only.
- Mock data lives in @src/lib/mock-data.ts.
- Top bar controls are non-functional in this phase; wiring comes later.

## History

<!-- Keep this updated. Earliest to latest -->

- **2026-08-06 — Initial Next.js setup.** Scaffolded with `create-next-app`: Next.js 16.3, React 19.2, TypeScript strict, Tailwind CSS v4, ESLint, App Router, `@/*` path alias.
- **2026-08-07 — Project structure cleanup.** Stripped the starter boilerplate down to a minimal `layout.tsx` / `page.tsx`, added the `context/` docs (project overview, coding standards, AI interaction, this template).
