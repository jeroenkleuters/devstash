## DevStash

A developer knowlege hub for snippets, commands, promps, notes, files, images, links and custom types.

## Context Files

Read the following to get the full context of the project
- @context/project-overview.md
- @context/coding-standards.md
- @context/ai-interaction.md
- @context/current-feature.md

## Commands

```bash
npm run dev     # dev server on http://localhost:3000
npm run build   # production build
npm run start   # serve the production build
npm run lint    # bare `eslint` (Next 16 removed `next lint`)

npm test            # vitest run — the unit suite
npm run test:watch  # vitest in watch mode

npm run db:migrate  # prisma migrate dev — the only way to change the schema
npm run db:deploy   # prisma migrate deploy (production)
npm run db:status   # prisma migrate status — run before committing
npm run db:seed     # prisma db seed
npm run db:test     # integrity checks against the seeded data (not a test suite)
npm run db:studio   # prisma studio
```

Testing is Vitest, run with `npm test`. **Scope is server actions and utilities only** — the `include` pattern in `vitest.config.mts` covers `src/lib/**/*.test.ts` and `src/actions/**/*.test.ts` and nothing else, so a component test is not merely discouraged but never collected. Tests sit next to what they test, must not reach the network or the database (mock `@/lib/prisma` and `@/auth`), and get no `.env` loaded — use `vi.stubEnv`.

`npm run db:test` is a different thing and is **not** part of the suite: it runs `scripts/test-db.ts`, which asserts the seeded data in a live database is intact and prints it.

## Stack

Next.js 16.3 (App Router) · React 19.2 · TypeScript strict · Tailwind CSS v4.


## Neon MCP

Every Neon MCP call targets this project and branch unless I name a different one in that same message:

- Project: `devstash` — `silent-forest-61944589` (org `org-solitary-bar-08944384`)
- Branch: `development` — `br-quiet-shape-axtrz8yd`
- Database: `neondb`

Always pass both `projectId` and `branchId` explicitly, on every call, including read-only ones. Omitting `branchId` silently falls back to the project's default branch — which here is **production** (`br-tiny-firefly-ax2s47u4`).

**Never touch production.** Do not read from it, write to it, describe it, migrate it, reset it, or point a tuning/migration tool at it unless I explicitly name production in my request. "Check the database" always means `development`. If a task seems to need production, stop and ask instead of running anything against it. This holds even when a previous message in the conversation authorized a production action — that authorization covers that one action only.

Read-only queries against `development` are fine to run unprompted. Anything that changes data or schema — `INSERT` / `UPDATE` / `DELETE` / `DROP` / `TRUNCATE`, `prepare_database_migration`, branch create / delete / reset — needs my confirmation first, on `development` too. Schema changes go through `npm run db:migrate`, never raw SQL.

## Conventions

Write markup with plain elements and no Tailwind utility classes. Tailwind is installed and available, but the user deliberately keeps the JSX unstyled and decides styling themselves — don't add `className` utility strings unprompted.

Import from `src/` with the `@/*` alias (`@/components/foo`), configured in `tsconfig.json`.
