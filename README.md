# DevStash

One fast, searchable, AI-enhanced hub for all developer knowledge & resources — snippets, prompts, commands, notes, files, images and links, organised into collections.

See [context/project-overview.md](context/project-overview.md) for the full product spec, data model and roadmap.

## Status

Early development, but the signed-in experience is real. Authentication is NextAuth v5 with email/password and GitHub OAuth, plus email verification, password reset and a `/profile` page with change-password and delete-account. `/dashboard` renders the signed-in account's own data from Neon — stat cards, the recent collection grid, pinned and recent items, and the sidebar — and `/items/[type]` lists the items of one type. `/collections` is still linked from the sidebar but does not exist yet, and there is no way to create or open an item from the UI: the quick-create drawer is not built.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16.3 (App Router) · React 19.2 |
| Language | TypeScript (strict) |
| Database | Neon (serverless PostgreSQL) |
| ORM | Prisma 7 with the Neon driver adapter |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Fonts | Geist Sans / Geist Mono via `next/font` |
| Unit tests | Vitest (server actions & utilities only) |

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

### File uploads (Cloudflare R2)

Files and images are uploaded **straight from the browser to R2**. The app only
authorises the upload: `POST /api/upload` signs a short-lived PUT URL, the
browser sends the bytes to the bucket, and the item then stores the object key.
Nothing large ever passes through a Next route, which is what allows a 100 MB
cap where a proxied upload would have to fit inside the platform's request-body
limit.

Two consequences worth knowing when setting this up:

- **The bucket needs a CORS policy**, or the browser blocks the PUT before it is
  sent. Set it under *R2 → your bucket → Settings → CORS policy*:

  ```json
  [
    {
      "AllowedOrigins": ["http://localhost:3000", "https://your-domain"],
      "AllowedMethods": ["PUT"],
      "AllowedHeaders": ["Content-Type"],
      "MaxAgeSeconds": 3600
    }
  ]
  ```

  A missing policy fails as an opaque network error rather than as anything that
  names CORS, so it is worth ruling out first when an upload will not go.

- **The size cap is enforced by R2, not by the form.** `Content-Type` and
  `Content-Length` are both signed into the upload URL, so a body of a different
  length or type fails the signature. `createItem` then asks R2 how big the
  stored object actually is and keeps that number, rather than trusting anything
  the browser reported.

`R2_PUBLIC_URL` is unused — downloads are served through
`/api/items/[id]/file`, so the bucket stays private and the stored value is an
object key rather than a URL.

## Scripts

```bash
npm run dev         # dev server on http://localhost:3000
npm run build       # production build
npm run start       # serve the production build
npm run lint        # bare `eslint` (Next 16 removed `next lint`)
npm test            # vitest run — unit suite (server actions & utilities)
npm run test:watch  # vitest in watch mode

npm run db:migrate  # prisma migrate dev — the only way to change the schema
npm run db:deploy   # prisma migrate deploy (production)
npm run db:status   # prisma migrate status — run before committing
npm run db:seed     # prisma db seed
npm run db:test     # integrity checks against the seeded data
npm run db:studio   # prisma studio
```

Never use `prisma db push` or edit the database directly.

`db:test` is a data integrity script against a live database, **not** part of the unit suite — that is `npm test`.

## Testing

Vitest, configured in [vitest.config.mts](vitest.config.mts). The scope is deliberately narrow: **server actions and utilities, not components.** Only `src/lib/**/*.test.ts` and `src/actions/**/*.test.ts` are collected, so a test file elsewhere is never run.

Tests are co-located with the module they cover and stay offline — `src/lib/prisma.ts` throws at import time without `DATABASE_URL`, so anything touching `lib/db/` mocks it, and `@/auth` is mocked for action tests. Vitest loads no `.env` file; modules reading `process.env` are exercised with `vi.stubEnv`.

## Project layout

```
prisma/          schema, migrations, seed
scripts/         one-off maintenance scripts (test-db, prune-users)
context/         product spec, coding standards, feature specs, history
src/app/         routes — root layout, (auth) group, /dashboard, /items/[type], /profile, api/
src/components/  ui/ (shadcn primitives), layout/, dashboard/, collections/, items/, auth/, profile/, user/
src/actions/     server actions (+ co-located *.test.ts)
src/lib/         prisma client, utils, db/ query modules, validations/ (+ co-located *.test.ts)
src/types/       shared type definitions and action state
src/constants/   item type icons and Pro-gated slugs
src/generated/   Prisma client output (gitignored, rebuilt by postinstall)
```

Import from `src/` with the `@/*` alias.

## Conventions

Markup is written with plain elements and semantic class names — layout styles live in [src/app/globals.css](src/app/globals.css) rather than as Tailwind utility strings in the JSX. Tailwind v4 is configured in CSS via `@theme`; there is no `tailwind.config.ts`.

See [context/coding-standards.md](context/coding-standards.md) and [context/ai-interaction.md](context/ai-interaction.md) for the full rules and the per-feature workflow.
