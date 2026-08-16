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

npm run db:migrate  # prisma migrate dev — the only way to change the schema
npm run db:deploy   # prisma migrate deploy (production)
npm run db:status   # prisma migrate status — run before committing
npm run db:seed     # prisma db seed
npm run db:test     # integrity checks against the seeded data (not a test suite)
npm run db:studio   # prisma studio
```

No test runner is configured — there is no test framework or test file in the repo. `db:test` is not one: it runs `scripts/test-db.ts`, which asserts the seeded data is intact and prints it. If tests are needed, pick a runner and add the script rather than assuming one exists.

## Stack

Next.js 16.3 (App Router) · React 19.2 · TypeScript strict · Tailwind CSS v4.


## Conventions

Write markup with plain elements and no Tailwind utility classes. Tailwind is installed and available, but the user deliberately keeps the JSX unstyled and decides styling themselves — don't add `className` utility strings unprompted.

Import from `src/` with the `@/*` alias (`@/components/foo`), configured in `tsconfig.json`.
