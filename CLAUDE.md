## DevStash

A developer knowlege hub for snippets, commands, promps, notes, files, images, links and custom types.

## Context Files

Read the following to get the full context of the project
- @context/project-overwiew.md
- @context/coding-standards.md
- @context/ai-interaction.md
- @context/current-feature.md

## Commands

```bash
npm run dev     # dev server on http://localhost:3000
npm run build   # production build
npm run start   # serve the production build
npm run lint    # bare `eslint` (Next 16 removed `next lint`)
```

No test runner is configured — there is no test script, framework, or test file in the repo. If tests are needed, pick a runner and add the script rather than assuming one exists.

## Stack

Next.js 16.3 (App Router) · React 19.2 · TypeScript strict · Tailwind CSS v4.


## Conventions

Write markup with plain elements and no Tailwind utility classes. Tailwind is installed and available, but the user deliberately keeps the JSX unstyled and decides styling themselves — don't add `className` utility strings unprompted.

Import from `src/` with the `@/*` alias (`@/components/foo`), configured in `tsconfig.json`.
