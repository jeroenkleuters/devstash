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
