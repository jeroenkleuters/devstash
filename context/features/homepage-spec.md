# Marketing Homepage

## Overview

Turn the static mockup in `prototypes/homepage/` into the real app homepage at `/`,
replacing the `<h1>Devstash</h1>` placeholder in `src/app/page.tsx`. Same sections,
same visual language, rebuilt as React against the app's own tokens and primitives.

The prototype stays where it is — it is the reference, not a thing to delete.

## Placement

- Move the page into a `(marketing)` route group: `src/app/(marketing)/page.tsx` plus
  its own `layout.tsx` for the marketing nav and footer. This is the first of the three
  route groups project overview §7 targets, and the URL stays `/`.
- Public — do **not** add anything to the proxy matcher in `src/proxy.ts`.
- Components live in `src/components/marketing/`.
- Nothing about the authenticated shell moves; `AppShell` is untouched.

## Server / client split

Server components by default. Only these four need `"use client"`, each isolated so the
rest of the page stays static:

| Component | Why |
|---|---|
| `ChaosField` | the `requestAnimationFrame` physics loop, pointer repulsion, `IntersectionObserver` pause |
| `MarketingNav` | the scroll listener that toggles the opaque state |
| `Reveal` | a small wrapper running the `IntersectionObserver` fade-in; used by every section |
| `PricingCards` | the monthly/yearly toggle and the price it swaps |

Everything else — hero copy, the dashboard preview mockup, features grid, AI section,
CTA, footer — is a server component. The footer year is `new Date().getFullYear()` on
the server, so no effect and no hydration mismatch.

The page itself only composes; one component per section, matching how
`src/app/dashboard/page.tsx` is built.

## Styling

- ShadCN primitives where one exists — `Button` for every CTA (`default` / `outline` /
  `ghost`, plus `size="lg"`), `Badge` for the "Pro Feature" and "Most Popular" chips,
  `Separator` where the prototype draws a hairline.
- Everything else is **semantic classes in `src/app/globals.css`**, not Tailwind utility
  strings in the JSX — that is what "like the rest of the project" means here, per
  CLAUDE.md and the whole existing codebase. Port the prototype's rules under a
  `/* ---------- Marketing ---------- */` section.
- Reuse the tokens already in `globals.css`: the seven `--type-*` values, the
  `[data-type]` → `--type-color` map, `--card`, `--muted`, `--border`, `--radius`.
  The prototype re-declares these because it is standalone; the real page must not.
- The prototype's `--accent` / `--accent-light` pair (the snippet blue and a lighter
  blue for gradients) is new and does belong in `globals.css`.
- No new dependency and no new ShadCN primitive if avoidable. There is no `switch`
  primitive — the billing toggle follows the settings page's precedent: a real
  `<input type="checkbox">` drawn with `appearance: none`, so the browser keeps its own
  keyboard and touch behaviour.

## Links

Every `href="#"` in the prototype resolves to a real destination:

| Control | Destination |
|---|---|
| Brand (nav + footer) | `/` |
| Features / Pricing (nav + footer) | `#features` / `#pricing` — anchors on this page |
| Sign In | `/sign-in` |
| Get Started · Get Started Free · Free plan CTA | `/register` |
| Go Pro · final CTA | `/register` |
| See Features | `#features` |

- **The nav is auth-aware.** Read `getCurrentUser()` in the marketing layout: signed out
  shows Sign In + Get Started, signed in shows a single **Dashboard** button to
  `/dashboard`. Sending someone who is already signed in to `/register` is the thing to
  avoid.
- Footer columns that name pages which do not exist (Changelog, Documentation, Keyboard
  shortcuts, Export your data, About, Privacy, Terms) are **not** to be linked to 404s —
  render them as plain muted text, or drop the column. Do not invent routes.
- Anchor links need `scroll-margin-top` on `#features` / `#pricing` so the fixed nav does
  not cover the heading.

## DRY

- One `Reveal` wrapper, used by every section — not a copy of the observer per section.
- One `sections` / `features` / `plans` data array per grid, mapped; no six near-identical
  JSX blocks.
- Icons come from `lucide-react`, as everywhere else in the app. The prototype's inline
  SVG sprite exists only because lucide is unavailable to a standalone file. **Brand
  marks (GitHub, Notion, Slack, VS Code) are the exception** — lucide v1 dropped its brand
  icons, so those stay as local inline SVG components, the way
  `src/components/auth/github-mark.tsx` already does it.
- The dashboard preview mockup is presentational only — grey bars and labels, not real
  data. It must not query the database.

## Behaviour to preserve

- **Chaos field**: 8 icons drifting with wall bounce, independent rotation and scale
  pulse, cursor repulsion with a squared falloff and a hard speed ceiling; the loop stops
  while the field is off-screen or the tab is hidden; the frame delta is clamped so a
  backgrounded tab does not resume with one jump. Port the tuned constants from
  `script.js` rather than re-deriving them.
- **Reduced motion**: the physics loop never starts and the icons take a static scattered
  layout, the arrow and reveals are off, everything is visible immediately. The prototype
  already handles this; keep it.
- **Responsive**: chaos / arrow / preview stack vertically on mobile with the arrow
  rotated 90°, all grids single-column. No horizontal overflow at 390px.

## Out of scope

- A standalone `/pricing` page — the section on this page is enough for now.
- Stripe, checkout, and anything the Go Pro button would eventually do; it goes to
  `/register`.
- Changelog, docs and legal pages.
- Light mode. The root layout still hardcodes `.dark`.

## Verification

- `npm test`, `npx tsc --noEmit`, `npx eslint src` and `npm run build` clean.
- Compare against the prototype side by side at 390px and 1440px.
- Signed-out and signed-in both render the right nav; every button lands on a real route.
