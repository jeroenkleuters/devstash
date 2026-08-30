# AI Feature 2 — Privacy page & the AI off switch

## Overview

The two things that must exist **before anything in this app calls OpenAI**: a
page saying what gets sent and where, and a switch that stops it.

They ship together deliberately. A disclosure that says *"we send your content to
OpenAI"* is a weaker document than one that also says *"and here is the switch
that stops it"* — building the page now and the switch a month later would mean a
month of the weaker version.

**This feature still makes no AI calls.** Feature 1 built the plumbing, this one
builds the disclosure and the control, and feature 3 is the first thing that
actually reaches OpenAI. That ordering is the point: **no call ever precedes the
page describing it.**

The slightly odd consequence, worth naming so it does not look like an oversight:
for one commit the app has a privacy page and a settings switch for features that
do not exist yet. That is the right way round.

Reference: @docs/ai-integration-plan.md §10 and §11.

## Requirements

- **No migration** — `User.aiPreferences` landed in feature 1
- No new dependency, no new ShadCN primitive (`label`, `button` and the
  checkbox-as-switch pattern all exist)
- `/privacy` is public: **not** added to the proxy matcher
- Unit tests for the settings action (see Testing)
- `npm test`, `npx tsc --noEmit`, `npx eslint src` and `npm run build` clean

## Files to create

| File | Contents |
|---|---|
| `src/app/(marketing)/privacy/page.tsx` | The page — a server component, no client code |
| `src/components/settings/settings-ai.tsx` | The settings card |
| `src/actions/ai-preferences.ts` | `saveAiPreferences` |
| `src/actions/ai-preferences.test.ts` | The tests below |

## Files to modify

| File | Change |
|---|---|
| `src/app/(marketing)/page.tsx` (footer) | Restore the Privacy link the homepage feature deleted |
| `src/app/settings/page.tsx` | Mount the card, third after Account and Editor |
| `src/app/globals.css` | Only if the card needs a rule the `.settings-row` shape does not already give |

---

## Part A — the privacy page

### Why it is not a follow-up

These features are **the first thing in this application that sends a user's
stored content to a third party**. Everything before them — Neon, R2, Resend,
Stripe, Upstash — is infrastructure the data sits *in*. OpenAI is the first one
it is *sent to* for processing.

It is also nearly free: the `(marketing)` route group already exists, so this is
a static server component and a footer link.

**It closes an existing gap.** The homepage feature deleted seven footer links,
Privacy among them, rather than point them at 404s — with a note that the link
should come back when the page does. This is when.

### Content

**The copy is drafted at @context/features/privacy-page-content.md**, rewritten
on 2026-08-30 against the code rather than from a template. An earlier draft
described an auto-complete feature that does not exist and claimed uploaded
images were analysed when they are not; both are gone.

Four things must be resolved before the page ships, and they are listed at the
top of that file:

1. **A real contact address.** The draft carries a placeholder.
2. **The OpenAI retention and training claims, verified** against their current
   data-usage terms at the moment of writing — the one part of the page
   describing someone else’s policy, and the part that dates. The draft marks
   the paragraph.
3. **Account deletion does not delete uploaded files, and the page currently has
   to say so.** See below — this is a code defect, not a wording problem.
4. **Review by someone qualified.** DevStash has EU users, so GDPR applies, and
   a rights section is not something to ship from an AI-assisted draft
   unreviewed.

### The deletion gap, found while writing the copy

`deleteAccount` in [src/lib/account.ts](../../src/lib/account.ts) deletes the
`VerificationToken` rows and the `User` row, and Prisma cascades the items,
collections, tag links and sessions. **It never touches Cloudflare R2.**
`deleteItem` deletes an item's object; deleting the whole account does not, so
every file that account uploaded is orphaned in the bucket.

That is two problems at once — a right-to-erasure gap, and storage nothing will
ever reclaim, which since the direct-to-R2 feature can be 100 MB per object.

**Specced separately as @context/features/account-deletion-r2-spec.md**, and it
should land before this page is linked publicly. It is not in scope here: doing
it properly means collecting the account’s object keys before
the cascade removes the rows that name them, and deciding what happens when the
bucket delete fails halfway. That ordering is decided — **the row goes first and
the object sweep is best effort**, so a vendor outage can never block an erasure
request. §7 of the draft is written honestly in the meantime and carries a marker
to rewrite once the fix lands.

The structural requirement the spec fixes, so the page cannot ship missing one:

1. **Which features send content, and which do not.** Nothing is sent in the
   background. Content leaves only when an AI button is clicked, and only for the
   item that button sits on. Browsing, searching, saving and uploading send
   nothing.
2. **What is sent** — the item's title, description and content, truncated to the
   budget. Not the account's email, not other items, not collection names.
3. **Where it goes** — OpenAI, model `gpt-5-nano`, for the duration of the call.
4. **What OpenAI does with it.** API inputs are not used for training by default;
   an abuse-monitoring retention window applies unless zero-retention is
   arranged. **Check this against OpenAI's current data-usage terms at the moment
   of writing rather than copying it from the plan** — it is the one claim on the
   page describing someone else's policy, and it is the one that dates.
5. **How to stop it** — link to `/settings`, naming the switch.
6. **That uploaded files are never sent.** Only a book's metadata could be; the
   cover image itself is not.

If the drafted copy is not ready when the rest of this feature is, ship the page
with headings and the six points in plain sentences rather than blocking — it is
easier to improve a live page than to explain an undisclosed month.

### Shape

- **A server component.** No state, no effects, no `"use client"`.
- Inside `(marketing)`, so it inherits that group's layout and nav.
- **Public** — do not add `/privacy` to the proxy matcher. A visitor deciding
  whether to sign up must be able to read it.
- Plain prose in the app's own type styles. It is not a marketing page and should
  not read like one.

### Not in scope

**A Terms page.** Different document, different content, and the footer can carry
Privacy alone.

---

## Part B — the AI off switch

### Storage

Already built. `User.aiPreferences Json?` with `AiPreferences`,
`DEFAULT_AI_PREFERENCES`, the strict `aiPreferencesSchema` and the lenient
`parseAiPreferences` all landed in feature 1. This feature is that column's first
writer.

### It defaults on, and the argument has a condition attached

**Default `enabled: true`.** Every AI action is user-initiated — a click, never a
background job — so no content leaves without a deliberate act, and **the click
is the consent**. The switch is a standing *"do not even offer it"* rather than
the thing authorising any single call. Defaulting off would also mean a Pro
account paying for a feature that appears broken until they find a setting.

**The counter-argument is real**: a privacy-affecting default that ships on is a
default nobody chose. The reason it does not win is specifically that there is no
background processing.

> **Record this as a comment on `DEFAULT_AI_PREFERENCES`:** if any AI feature
> ever runs without a click — auto-tagging on save, say — this default must be
> revisited in the same change, because the argument above stops holding the
> moment content can leave on its own.

### Enforcement

**Server-side**, in the shared preamble every AI action will use (plan §5),
**before the Pro check**. Someone who deliberately switched a feature off should
not be sold an upgrade for it. There is no action to enforce it in yet; feature 3
adds the first, and the ordering is specified there.

**Client-side**, `BillingProvider` already carries `isPro` down to every gated
control, and `aiEnabled` rides the same path. **With AI off the buttons do not
render at all**, rather than rendering inert — an off switch that leaves disabled
buttons scattered around has not really turned anything off. The server check is
then belt-and-braces for a stale page, which is what it should be.

### The card

Third on `/settings`, after Account and Editor, following the `.settings-row`
shape the settings-layout feature established: title and sub-line left, control
right. The control is the same native checkbox drawn as a switch that the editor
card uses — no new primitive, and the browser keeps its own keyboard and touch
behaviour.

The sub-line is what makes the switch make sense, and it links to Part A:

> **AI features** — Let DevStash send an item's content to OpenAI when you ask
> for tags, a summary or an explanation. Nothing is sent unless you click.
> [What we share](/privacy)

### The action

`saveAiPreferences` in `src/actions/ai-preferences.ts`, following
`saveUploadPreferences` and `saveEditorPreferences` exactly:

- Account from the session, **never** the payload
- Strict schema on the way in
- `{ success, data, error }`, and the caller uses `.catch(() => null)` — a failed
  *write* answers `{ success: false }` but a failed *request* **rejects**, and
  without the catch the control is left mid-transition. This defect has shipped
  and been fixed four times in this project. Do not make it five
- **Not rate limited**, matching the item, collection and editor-preference
  actions rather than the profile ones — those are throttled because each attempt
  costs a bcrypt
- Optimistic on the client with the previous value restored on failure, as the
  upload-preferences card does

## Testing

`vitest.config.mts` collects `src/actions/**`, so the action is reachable. The
page and the card are not, by configuration — the existing suite passing
unchanged is what covers them.

### `src/actions/ai-preferences.test.ts`

- Signed out returns the session-ended message and does not write
- An invalid payload does not touch the database
- **The account comes from the session** — a payload naming `userId` is dropped
  and the write still goes to the session's user
- A partial or unknown-field payload is refused by the strict schema
- A rejected write becomes a message rather than a throw
- A missing row (the JWT verifies, the account is gone) answers rather than
  crashing

**Mutation-check the session scoping**: hardcode a different id and confirm
exactly the one test fails. Revert — and note `git checkout` does nothing for a
file that is still untracked, so restore from a copy.

## Verification

`npm test`, `npx tsc --noEmit`, `npx eslint src` and `npm run build` clean.

Worth checking by hand, since none of it is unit-testable:

- `/privacy` renders signed out — it is public, and that is the point
- The footer link resolves rather than 404ing
- The switch persists across a reload
- Turning it off and reloading `/settings` shows it off
- The card reads correctly at 390px, where `.settings-row` wraps the control
  under the text
