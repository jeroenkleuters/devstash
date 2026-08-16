# DevStash

One fast, searchable, AI-enhanced hub for all developer knowledge & resources — snippets, prompts, commands, notes, files, images and links, organised into collections.

See [context/project-overview.md](context/project-overview.md) for the full product spec, data model and roadmap.

## Status

Early development. The dashboard at `/dashboard` renders live data from Neon: stat cards, the recent collection grid, pinned items and recent items, plus the sidebar navigation. Authentication is not wired up yet — [src/lib/db/user.ts](src/lib/db/user.ts) resolves the seeded demo account as a stand-in for the session until NextAuth lands. The `/items/[type]` and `/collections` routes are linked from the sidebar but do not exist yet.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16.3 (App Router) · React 19.2 |
| Language | TypeScript (strict) |
| Database | Neon (serverless PostgreSQL) |
| ORM | Prisma 7 with the Neon driver adapter |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Fonts | Geist Sans / Geist Mono via `next/font` |

Dark mode is the default, applied as `.dark` on `<html>` in [src/app/layout.tsx](src/app/layout.tsx).

## Getting started

Requires Node.js 20+ and a Neon project.

```bash
npm install                 # also runs `prisma generate` via postinstall
cp .env.example .env.local  # then fill in your Neon connection strings
npm run db:migrate          # apply migrations to your dev branch
npm run db:seed             # demo user + system item types + sample content
npm run dev
```

Open [http://localhost:3000/dashboard](http://localhost:3000/dashboard).

The seed creates `demo@devstash.io` (password `12345678`) with the seven system item types and five collections holding 18 items.

## Environment

Both variables point at the same Neon database through different endpoints:

- `DATABASE_URL` — **pooled** endpoint (host contains `-pooler`), used by the app at runtime.
- `DIRECT_URL` — **direct** endpoint, used by the Prisma CLI. Migrations need it because Neon's pooler cannot hold the advisory locks the schema engine takes.
- `SHADOW_DATABASE_URL` — optional, only if the Neon role cannot create its own shadow database for `prisma migrate dev`.

Prisma 7 no longer reads `.env` files itself, so [prisma.config.ts](prisma.config.ts) loads `.env.local` / `.env` via dotenv.

## Scripts

```bash
npm run dev         # dev server on http://localhost:3000
npm run build       # production build
npm run start       # serve the production build
npm run lint        # bare `eslint` (Next 16 removed `next lint`)

npm run db:migrate  # prisma migrate dev — the only way to change the schema
npm run db:deploy   # prisma migrate deploy (production)
npm run db:status   # prisma migrate status — run before committing
npm run db:seed     # prisma db seed
npm run db:test     # integrity checks against the seeded data
npm run db:studio   # prisma studio
```

Never use `prisma db push` or edit the database directly.

There is no test runner configured — `db:test` is a data integrity script, not a unit test suite.

## Project layout

```
prisma/          schema, migrations, seed
scripts/         one-off maintenance scripts (test-db)
context/         product spec, coding standards, feature specs, history
src/app/         routes — root layout + /dashboard
src/components/  ui/ (shadcn primitives), layout/, dashboard/, collections/, items/
src/lib/         prisma client, utils, db/ query modules
src/constants/   item type icons and Pro-gated slugs
src/generated/   Prisma client output (gitignored, rebuilt by postinstall)
```

Import from `src/` with the `@/*` alias.

## Conventions

Markup is written with plain elements and semantic class names — layout styles live in [src/app/globals.css](src/app/globals.css) rather than as Tailwind utility strings in the JSX. Tailwind v4 is configured in CSS via `@theme`; there is no `tailwind.config.ts`.

See [context/coding-standards.md](context/coding-standards.md) and [context/ai-interaction.md](context/ai-interaction.md) for the full rules and the per-feature workflow.
