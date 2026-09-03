# DevSquirrel

One fast, searchable, AI-enhanced hub for all developer knowledge & resources — snippets, prompts, commands, notes, files, images, links and books, organised into collections.

See [context/project-overview.md](context/project-overview.md) for the full product spec, data model and roadmap.

## Status

Active development. The signed-in experience is complete enough to use daily, and the marketing homepage at `/` is the public entry point.

**Auth** — NextAuth v5 with email/password and GitHub OAuth, plus email verification, password reset, and rate limiting on every auth endpoint backed by Upstash Redis.

**Items** — eight system types (Snippet, Prompt, Command, Note, Link, File, Image, Book), each with a page at `/items/[type]` rendered as a card list, an image gallery or a file list depending on the type. Create from the top bar or a type page, open any card in a right-side drawer to read it, edit it inline, favorite, pin, copy or delete it — with Monaco for code types and a Markdown editor for notes and prompts. File, image and book covers upload straight to Cloudflare R2, including by dropping a batch onto the listing.

**Collections** — `/collections` and `/collections/[id]`, created, renamed, favorited and deleted from either the grid or the detail page, with an item able to sit in any number of them.

**Elsewhere** — a `⌘K` search palette over items and collections, `/favorites` with per-section sorting, pagination on every listing, `/dashboard` for stats and recents, `/profile` for account usage, and `/settings` for password, account deletion, Monaco editor preferences and upload limits.

**Billing** — Stripe subscriptions ($8/mo, $72/yr). The free tier is capped at 50 items and 3 collections, with File, Image and Book as Pro-only types; gated controls open an upgrade dialog rather than failing, and the server enforces the same limits independently. `isPro` is only ever written by the `/api/webhooks/stripe` handler.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16.3 (App Router) · React 19.2 |
| Language | TypeScript (strict) |
| Database | Neon (serverless PostgreSQL) |
| ORM | Prisma 7 with the Neon driver adapter |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Fonts | Geist Sans / Geist Mono via `next/font` |
| Editors | Monaco (code types) · react-markdown (notes & prompts) |
| File storage | Cloudflare R2 (presigned direct-to-bucket uploads) |
| Email | Resend (verification & password reset) |
| Rate limiting | Upstash Redis |
| Payments | Stripe subscriptions |
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

Open [http://localhost:3000](http://localhost:3000).

The seed creates `demo@DevSquirrel.io` (password `12345678`) with the eight system item types and five collections holding 18 items. The demo account is seeded `isPro: true`, since five collections would otherwise sit over the free tier's cap of three.

Only `DATABASE_URL` and `DIRECT_URL` are needed to get the app running. Everything else in `.env.example` unlocks one feature at a time — Resend for the mail flows, R2 for uploads, Upstash for rate limiting, Stripe for billing — and each is documented in place with what breaks when it is absent.

To exercise **billing** locally you also need `npx stripe listen` running in a second terminal, or the upgrade appears to do nothing — see [Billing (Stripe)](#billing-stripe).

## Environment

[.env.example](.env.example) is the authoritative list and explains every value in place. The notes below cover the ones with a real trap in them.

### Database

Both variables point at the same Neon database through different endpoints:

- `DATABASE_URL` — **pooled** endpoint (host contains `-pooler`), used by the app at runtime.
- `DIRECT_URL` — **direct** endpoint, used by the Prisma CLI. Migrations need it because Neon's pooler cannot hold the advisory locks the schema engine takes.
- `SHADOW_DATABASE_URL` — optional, only if the Neon role cannot create its own shadow database for `prisma migrate dev`.

Prisma 7 no longer reads `.env` files itself, so [prisma.config.ts](prisma.config.ts) loads `.env.local` / `.env` via dotenv.

### Origin

`APP_URL` is the origin every outbound link is built from — verification and password-reset mails, and Stripe's checkout return URLs. It is **required in production and required for billing anywhere**: the fallback is the request's own origin, which Next derives from the caller's `Host` header, so a spoofed one would aim a real user's reset link at someone else's domain. `configuredOrigin()` in [src/lib/app-url.ts](src/lib/app-url.ts) has no fallback at all for that reason.

### Email (Resend)

`RESEND_FROM` must be an address on a domain verified at [resend.com/domains](https://resend.com/domains). Resend's shared `onboarding@resend.dev` needs no setup but **only delivers to the address that owns the Resend account**, so registering any other address creates an account that can never be mailed — `EMAIL_VERIFICATION_ENABLED=false` is the escape hatch if you are ever in that position. Accounts registered while it is off are stored as already-verified, so turning it back on does not lock *them* out; an account left unverified from a period when it was **on** still is, and is refused at sign-in as soon as it goes back on.

### Rate limiting (Upstash Redis)

Backs the limits on the auth, upload and password-change endpoints. **Both variables are required for limiting to run at all** — with either missing the limiter fails open and logs, so the app works unconfigured but those endpoints are unguarded.

### Billing (Stripe)

`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and the two `STRIPE_PRICE_ID_*` values. The webhook handler at `/api/webhooks/stripe` **refuses every request without a signing secret** — an unverified webhook is a request from anyone claiming to be Stripe, and what it claims is that an account is now Pro. Locally the secret comes from the CLI:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

A deployment's endpoint has its own, different secret. `STRIPE_PUBLISHABLE_KEY` is unused: checkout is a server-side redirect to a hosted Checkout Session, so no page loads Stripe.js.

**The listener has to be running before you test billing locally.** The Stripe CLI ships as a dependency, so no separate install is needed — run it in its own terminal alongside `npm run dev`:

```bash
npx stripe login                                            # once
npx stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the `whsec_…` it prints into `STRIPE_WEBHOOK_SECRET` and restart the dev server. Without the listener, checkout still completes on Stripe's side but no event ever reaches the app, so `isPro` is never written and the account stays on the free tier — which looks like a broken upgrade rather than a missing terminal. Test cards: `4242 4242 4242 4242` succeeds, `4000 0000 0000 0002` declines; any future expiry, any CVC, any ZIP.

### File uploads (Cloudflare R2)

Files, images and book covers are uploaded **straight from the browser to R2**. The app only
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
npm run db:prune    # delete every user but demo — dry run unless `-- --yes`
npm run db:studio   # prisma studio
```

Never use `prisma db push` or edit the database directly.

`db:test` is a data integrity script against a live database, **not** part of the unit suite — that is `npm test`.

`db:prune` is destructive: it deletes every user except `demo@DevSquirrel.io` and
everything they own, including the `VerificationToken` rows that have no relation
to `User` and so never cascade. It refuses to run when `NODE_ENV=production` or
when the demo account is missing, and it is a **dry run** unless you pass
`--yes`. Note PowerShell swallows the `--` separator, so
`npm run db:prune -- --yes` silently no-ops there — run it from a POSIX shell,
or use `--%`.

## Testing

Vitest, configured in [vitest.config.mts](vitest.config.mts). The scope is deliberately narrow: **server actions and utilities, not components.** Only `src/lib/**/*.test.ts` and `src/actions/**/*.test.ts` are collected, so a test file elsewhere is never run.

Tests are co-located with the module they cover and stay offline — `src/lib/prisma.ts` throws at import time without `DATABASE_URL`, so anything touching `lib/db/` mocks it, and `@/auth` is mocked for action tests. Vitest loads no `.env` file; modules reading `process.env` are exercised with `vi.stubEnv`.

### Browser verification (Playwright)

Anything the unit suite cannot reach — components, route handlers, CSS, drag & drop, dialogs — is checked in a real browser through the **Playwright MCP server**, driven against the running dev server. There is no Playwright dependency in `package.json` and no spec files in the repo: it is an interactive verification pass, not a second test suite, and `npm test` does not run it.

Conventions that pass has settled on:

- Reuse the dev server already running; **never `npm run build` while one is live**, since they share `.next` and the build leaves the dev server's workers corrupted in ways that look exactly like a bug in the code under test.
- Read the DOM (`getComputedStyle`, element counts, computed hrefs) rather than judging by screenshot — it is what makes a result reproducible.
- Never add temporary instrumentation to source files to reach a state. Intercept the request instead.
- Stay read-only against the database: a state the seed cannot produce is "not verifiable", not a reason to run SQL.

Artifacts land in `/.playwright-mcp`, which is gitignored — though **two `.yml` files there are tracked** from before that rule, so clean up untracked files only rather than deleting the folder.

## Project layout

```
prisma/          schema, migrations, seed
scripts/         one-off maintenance scripts (test-db, prune-users)
context/         product spec, coding standards, feature specs, history
prototypes/      standalone HTML mockups (no build step, not part of the app)
src/app/         routes — root layout, (marketing) and (auth) groups, /dashboard,
                 /items/[type], /collections, /favorites, /profile, /settings, api/
src/components/  ui/ (shadcn primitives), layout/, marketing/, dashboard/, items/,
                 collections/, favorites/, search/, billing/, settings/, editor/,
                 auth/, profile/, user/
src/actions/     server actions (+ co-located *.test.ts)
src/lib/         prisma client, utils, db/ query modules, validations/ (+ co-located *.test.ts)
src/hooks/       shared client hooks
src/types/       shared type definitions and action state
src/constants/   item type metadata, Pro-gated slugs, pagination and pricing constants
src/generated/   Prisma client output (gitignored, rebuilt by postinstall)
```

Import from `src/` with the `@/*` alias.

## Conventions

Markup is written with plain elements and semantic class names — layout styles live in [src/app/globals.css](src/app/globals.css) rather than as Tailwind utility strings in the JSX. Tailwind v4 is configured in CSS via `@theme`; there is no `tailwind.config.ts`.

See [context/coding-standards.md](context/coding-standards.md) and [context/ai-interaction.md](context/ai-interaction.md) for the full rules and the per-feature workflow.
