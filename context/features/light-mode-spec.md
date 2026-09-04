# Light Mode

## Overview

The app has been dark-only since the first commit: `src/app/layout.tsx` puts a
hardcoded `className="dark"` on `<html>` and nothing has ever taken it off. This
adds a real theme toggle — light, dark, and follow-the-system — and closes the
gaps that only appear once a light background is actually rendered.

The CSS half is mostly already done and that is worth stating up front, because
it changes where the work is. `globals.css` already defines a **complete light
palette on bare `:root`** (lines 55–100) with the dark values overriding it in
`.dark` (lines 101–134), `@custom-variant dark (&:is(.dark *))` is wired, and
the ~4,500 lines of semantic CSS the whole app is styled with read
`var(--muted)`, `var(--border)`, `var(--card)` and friends. Those surfaces flip
correctly the moment the class comes off.

**The work is entirely in the places that bypassed the tokens** — Monaco, the
seven `--type-*` colors, the marketing page, and a handful of scrims and
shadows. None of them is hard; all of them are invisible until something
actually renders on white.

---

## Decisions to confirm before implementing

These change what gets built, so settle them at `/feature start`.

### 1. Where the preference is stored

**Recommended: `localStorage`, via `next-themes`.** Not the `Json` column on
`User` the editor / upload / AI preferences use, and the difference is not
consistency for its own sake:

- A theme has to be applied **before first paint** or the page flashes the wrong
  one. `next-themes` does that with a blocking inline script reading
  `localStorage`. A database value cannot — `getCurrentUser()` resolves inside
  the request, and `AppShell` is already async, so a server-read theme is
  workable, but a signed-out page (`/`, `/sign-in`, `/privacy`) has no user to
  read and would have no theme at all.
- A theme is reasonably **per device**: a phone in bed and a desktop at noon
  want different answers, where a font size does not.
- It costs **no migration and no server action**.

The cost is that it does not follow an account between devices, and that the
settings card holding it will not look like its four neighbours (no toast, no
optimistic revert — the value is local and cannot fail). Say so in a comment.

`next-themes` was installed and then deliberately uninstalled during the rate
limiting feature, precisely because there was no provider for `sonner.tsx` to
read. It comes back here.

### 2. Does the Monaco theme follow the app theme?

The editor theme is **already a stored user preference** (`vs-dark`, `monokai`,
`github-dark` in `src/lib/validations/editor-preferences.ts`), so it is not
obviously the app theme's to control.

**Recommended: leave the preference in charge, and add light options to it.**
Add `vs` (Monaco's own light theme, needs no definition) and one light custom
theme to `EDITOR_THEMES`, and leave the default at `vs-dark`. A code editor
staying dark on a light page is a normal thing that many editors do on purpose.

The alternative — a `"follow app"` value that resolves at render — is a bigger
change and puts two systems in charge of one colour.

### 3. Does the marketing page get a light mode?

`src/app/(marketing)/` is ~1,180 lines of `globals.css` written dark-only:
radial hero glows, `#fff` on the accent button, and the dashboard and code
editor mockups with hardcoded VS Code colours (`#d4d4d4`, the `.k` / `.f` / `.n`
syntax spans, the `#0098ff` link).

**Recommended: keep the marketing pages permanently dark for now** and scope
this feature to the authenticated app plus the auth pages. Pin `.dark` on the
marketing layout rather than the root, so `/`, `/sign-in`, `/register`,
`/privacy` and the rest keep exactly the look they have today.

Giving it a light variant is a genuine design pass on a page that was built to
one palette, and belongs in its own change.

---

## Part A — The switch

- Install `next-themes`. Mount `ThemeProvider` in `src/app/layout.tsx` with
  `attribute="class"`, `defaultTheme="dark"`, `enableSystem`.
- Remove the hardcoded `dark` from the `<html>` className; add
  `suppressHydrationWarning` to `<html>` (the provider's inline script mutates
  the class before React hydrates, and without it every page logs a mismatch).
- Add `color-scheme: light` to `:root`. `.dark` already sets
  `color-scheme: dark`; its light counterpart is missing, so native controls
  (the `<select>` elements on the settings page, scrollbars, form widgets) would
  keep rendering dark-flavoured on a light page.
- **`src/components/ui/sonner.tsx`**: it is pinned `theme="dark"` with a comment
  saying "until the light-mode toggle lands and gives it a source". Restore the
  CLI's `useTheme()` read. This is the **third** edit to a generated `ui/` file
  (after `sonner` itself and `command.tsx`) — keep the comment explaining why.
- A `settings-appearance.tsx` card on `/settings`, following the existing
  `.settings-row` shape: a three-way control (Light / Dark / System). Place it
  first or second — appearance is the setting most people go looking for.

**Marketing pages keep `.dark`** (per decision 3): put it on
`src/app/(marketing)/layout.tsx` so those routes are unaffected. The `(auth)`
group renders `MarketingNav` inside a `.marketing` wrapper, so check whether
those five pages read acceptably in light — they are mostly the auth card, which
is tokenised, over a nav that is not.

---

## Part B — The token gaps

### B1. Item type colours (the one with real visual consequences)

The nine `--type-*` values at `globals.css:88-98` are fixed hex chosen against a
near-black ground and are **not** redefined in `.dark`, so they are the same in
both themes. Two are unusable on white:

- `--type-note: #fde047` — pale yellow
- `--type-favorite: #facc15` — the favourite star, which is a filled shape and
  the worst case

They are load-bearing across 13 rules in `globals.css` plus the whole
`[data-type]` → `--type-color` map: card left borders, sidebar icons, badge
tints, the gallery fallback icon, the AI panel accents.

Move all nine into the `:root` / `.dark` pair with darker light-mode variants.
Keep the **hue** identical in both — the colour is an identifier, and a note
that is yellow in one theme and orange in the other stops being one. Darkening
the lightness is enough for every case.

Check the `color-mix` tints that build on them (the create picker's selected
radio, the AI panels) — a `color-mix(... 12%, transparent)` reads very
differently over white.

### B2. Monaco

Per decision 2: extend `EDITOR_THEMES` with `vs` and one light custom theme,
extend `MONACO_THEMES` in `src/lib/monaco-themes.ts` accordingly. Both existing
custom themes declare `base: "vs-dark"`; a light one needs `base: "vs"`.

Note the editor frame is `--card` and `vs-dark`'s own background is `#1e1e1e`,
which already produces a visible seam (recorded in the editor-preferences
history entry). A light Monaco theme against a light `--card` has the same
problem in the other direction — worth defining the light theme's `background`
to the light `--card` value rather than accepting `vs`'s `#fffffe`.

`monaco-themes.ts` hex must stay hand-synchronised with `globals.css`; it cannot
read CSS custom properties, since `defineTheme` parses the colours itself.

### B3. Scrims, shadows and one-off colours

Audit these; most degrade acceptably but each wants an eye on white:

- `globals.css:3139` — `rgb(0 0 0 / 50%)`, the image lightbox scrim. Probably
  correct in both themes: a lightbox is a dark room by convention.
- `globals.css:2836` — `color: #fff`, check what it sits on.
- The `oklch(0 0 0 / …%)` box shadows in the marketing block — out of scope if
  marketing stays dark.
- The macOS traffic lights (`#ff5f57` / `#febc2e` / `#28c840`) are correct in
  both themes and want no change; they are the real macOS colours.

### B4. Anything reading `.dark` as an ancestor

`grep -rn "\.dark" src/` before finishing. The markdown preview's own comment
notes it deliberately depends on nothing of the sort; confirm nothing else
picked up the habit.

---

## Out of scope

- The marketing pages and the homepage prototype in `prototypes/homepage/`,
  which is a frozen standalone reference with no build step.
- Syncing the theme to the account across devices.
- A `"follow app theme"` value for the Monaco preference.

---

## Verification

Unit tests cover almost none of this — `vitest.config.mts` collects only
`src/lib/**` and `src/actions/**`, and the diff is a provider, a card and CSS.
If the `--type-*` values move into the theme blocks, nothing importable changes
either. **The suite staying green is what covers it, and the browser is the only
real check.**

Worth walking in light mode specifically:

- `/settings` — the four existing cards, and the **native `<select>`s**, which
  are the control most likely to be wrong if `color-scheme` was missed.
- `/items/notes` and `/favorites` — the two type colours called out in B1.
- The item drawer on a snippet — Monaco against a light frame, plus the AI
  explain and optimize panels, which tint from `--type-color`.
- `/items/images` — the gallery fallback tile and the lightbox scrim.
- A toast (a rate limit is the easiest to provoke) — the sonner fix.
- Reload on each theme, checking for a flash of the wrong one. Then set the OS
  to light and confirm `System` follows it.

Read the built stylesheet back after Lightning CSS as usual, and remember it is
the **largest** `.css` chunk under `.next/static/chunks/`, not the first.

---

## Notes

- **No migration** if decision 1 goes to `localStorage`, and no new dependency
  beyond `next-themes`.
- `next-themes` writes `data-theme` **or** a class depending on `attribute`;
  this app's `@custom-variant` is keyed on the `.dark` **class**, so
  `attribute="class"` is required — `data-theme` would silently apply nothing.
- Do not run `npm run build` while a dev server is live, and confirm the port
  is genuinely free with `netstat` filtered on `LISTENING` rather than trusting
  the task-stop, which reports success while leaving the Next child listening.
