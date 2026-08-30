# AI Feature 3 — Auto-tagging

## Overview

The first feature that actually calls OpenAI. A Sparkles button beside the Tags
field in the item drawer's edit mode asks `gpt-5-nano` for tag suggestions, which
appear as chips the user accepts individually or dismisses.

**This is the feature that proves the whole shape**, which is why it goes first
and alone: the gate ordering, the spend accounting, the suggest-and-accept loop,
and the upsell path all land here and every later AI feature reuses them
unchanged. If something about the design is wrong, this is where it is cheapest
to find out.

Reference: @docs/ai-integration-plan.md — §5 (preamble and §5.1), §6, §7, §9.

## Requirements

- No migration, no new dependency, no new ShadCN primitive (`badge` and `button`
  exist)
- Depends on **feature 1** (the client, wrapper, spend ledger, schemas) and
  **feature 2** (the privacy page and the off switch)
- Unit tests for the action (see Testing)
- `npm test`, `npx tsc --noEmit`, `npx eslint src` and `npm run build` clean

## Files to create

| File | Contents |
|---|---|
| `src/actions/ai.ts` | `suggestTags` — the first of four, and the shared preamble |
| `src/actions/ai.test.ts` | The tests below |
| `src/components/ai/ai-suggest-button.tsx` | The Sparkles trigger and its states |
| `src/components/ai/ai-tag-suggestions.tsx` | The chips and accept/dismiss |

## Files to modify

| File | Change |
|---|---|
| `src/components/items/item-form-fields.tsx` | Mount the button beside the Tags field |
| `src/components/billing/upgrade-dialog.tsx` | Fifth `UpgradeReason` member and its copy |
| `src/components/billing/billing-provider.tsx` | Carry `aiEnabled`; hold `budgetExceeded` for the session |
| `src/app/globals.css` | The suggestion chips and the button's hidden-until-hover behaviour |

## The action, and the order of its gates

Every AI action opens identically, and **the order is the security property** —
so the tests assert the *absence* of later calls, not just the presence of the
refusal.

```ts
const user = await getCurrentUser();                    // 1. session
if (!user) return { success: false, error: SIGNED_OUT };

if (!user.aiPreferences.enabled)                        // 2. switched off
  return { success: false, error: AI_TURNED_OFF };

if (!user.isPro) return { success: false, error: AI_PRO_REQUIRED };   // 3. Pro

const parsed = suggestTagsSchema.safeParse(input);      // 4. shape
if (!parsed.success) return { success: false, error: firstIssueMessage(parsed.error) };

const perFeature = await rateLimit(`ai:tags:${user.id}`, 30, HOUR);   // 5. limits
const combined = await rateLimit(`ai:all:${user.id}`, 60, HOUR);
if (!perFeature.success || !combined.success)
  return { success: false, error: tooManyAttemptsMessage(perFeature, combined) };

const budget = await checkSpend();                      // 6. spend cap
if (!budget.allowed)
  return { success: false, error: budget.message, budgetExceeded: true };

const item = await getItemDetail(user.id, parsed.data.itemId);        // 7. ownership
if (!item) return { success: false, error: MISSING };
```

Each position earns itself:

- **The off switch before the Pro check.** Selling an upgrade for a feature
  someone deliberately switched off is nonsense, and it sells at the worst
  possible moment.
- **Pro before the rate limit**, the ordering `POST /api/upload` already
  establishes and comments on: *"a free account should be told it needs Pro
  rather than told to wait for a window that will refuse it again."*
- **Both limits before the spend cap**, because the limiter's own in-memory
  reject cache answers a repeat offender with no round trip at all.
- **The spend cap before the item read**, so a caller in a loop is stopped before
  it costs a database query, let alone an API call.

`getCurrentUser` is `cache()`d, so step 1 is free if anything in the request
already asked — and it carries `aiPreferences`, so step 2 costs no query either.

### The request names an item id, never content

**This is the decision the whole action rests on.** A caller sending content
directly would let any signed-in account spend the OpenAI budget on arbitrary
text — the app becomes a free proxy to a paid API. An id means the content is
read through `getItemDetail(userId, itemId)`, which puts `userId` in the `where`,
so it is provably the caller's own and bounded by what they were already allowed
to store.

Same reasoning `createItem` uses for `typeSlug` over `itemTypeId` and
`startCheckout` for a plan over a price: **the client names a choice, the server
resolves it to a value.**

### The call itself

- Input is title + description + content, through `truncateForAi`
- **Existing tags are sent** and the model is told not to repeat them — cheaper
  than deduping afterwards and produces better suggestions
- `reasoning.effort: "minimal"`, `text.verbosity: "low"` — this is
  classification, and reasoning tokens bill at the output rate
- After a successful call, `recordSpend(usage)` — which never throws

### The output schema

- **Caps at 8 suggestions**, deliberately under the 20-tag ceiling in
  `itemFields`. The item may already carry tags, and a suggestion set that could
  alone overflow the cap would make the merge lossy.
- **Each tag capped at `TAG_MAX_LENGTH` (32)**, already exported. A model
  ignoring the instruction produces a validation failure here rather than a save
  that fails later with a confusing message.
- Model output is a remote service's response and is **validated, not trusted**.
  A 40-tag reply is a failure, not something to silently truncate — truncating
  hides a prompt that has stopped working.

### It writes nothing

`suggestTags` returns `string[]` and touches no row. The user accepts chips into
the form's local state, and the **existing** `updateItem` saves them when they
press Save.

That is not a simplification, it is the design: `updateItem` already owns the
ownership scoping, the payload-field rule and the tag `connectOrCreate` against
`Tag.@@unique([userId, name])`. An AI action that wrote tags would reproduce all
of it and be a second write path to audit. **Zero new write paths.**

Merging on accept goes through the existing `tagsSchema`, which already dedupes
case-sensitively for the `connectOrCreate` reason.

## The UI

### States

```
idle → loading → suggested → (accepted | dismissed)
                    ↓
                  error → idle
```

- **idle** — a `Sparkles` button beside the Tags field. The icon is already the
  prompts type's icon, so the vocabulary exists.
- **loading** — the button goes busy and **the Tags field takes a skeleton**,
  reusing the real element's classes with `height: 1lh` for text placeholders.
  Not a spinner in the middle of nowhere: the placeholder is shaped like the
  answer, which is the pattern the dashboard skeletons established.
- **suggested** — chips **beside the current value, never replacing it**. Each
  chip is individually clickable, so partial acceptance works; accepting three of
  five is the common case and an all-or-nothing button makes the feature
  annoying. A Dismiss clears the set.
- **error** — inline in the `.item-drawer-error` slot **and** a toast. Both: the
  create and edit forms already learned that a long scrolling body can put an
  inline error off-screen while the button is not.
- **accepted** — writes into the form's local state and nothing else. **Save is
  still Save.**

### Optimistic updates are wrong here

`useFlagToggle` is optimistic because a star that waits on a round trip reads as
a click that did not register. **The opposite applies**: there is nothing to be
optimistic about, because the value is unknown until the model answers, and
pretending otherwise would mean inventing tags. A genuine loading state.

### The failure this codebase keeps re-learning

```ts
const result = await suggestTags({ itemId }).catch(() => null);

if (!result?.success) {
  toast.error(result?.error ?? "Could not reach the server. Try again.");
  setState("idle");
  return;
}
```

A failed *write* answers `{ success: false }`; a failed *request* **rejects**.
Without the catch the rejection is unhandled and the button is left permanently
busy. **This has shipped and been fixed four separate times here** — the delete
dialog (found in the browser), the edit form, the create form and the flag
toggle. The `setState("idle")` in a `finally` is the other half.

That string is declared **eight times** across `src/components/auth/` and
`src/components/items/`. This is the ninth — extract it to a shared constant.

### Gating

**Server-side is the rule**; everything below is presentation.

- With **AI off**, the button does not render at all (feature 2).
- For a **free account**, the button renders with `aria-disabled` and a lock
  icon — **never `disabled`**, because a truly disabled button takes no click and
  the upsell would be unreachable. This is the pattern the free-tier gating
  feature established.
- Clicking raises the upsell with a **fifth `UpgradeReason` member**:

  ```ts
  | { kind: "ai"; label: string }   // "AI tag suggestions"
  ```

  The `headline()` switch is exhaustive over the union, so adding a member
  without its copy is a build error rather than a blank dialog.

- **`BENEFITS` in `upgrade-dialog.tsx` lists three things and mentions no AI.**
  Add a line — the marketing pricing section already promises AI features, so the
  upsell omitting them undersells the product.

### The budget toast

A refused call returns `budgetExceeded: true` alongside the standard error, so it
toasts through the path above automatically. The flag earns its place by letting
`BillingProvider` hold it for the rest of the session: once one call comes back
budget-exceeded the AI buttons go inert with a tooltip, so a second click does
not spend a round trip discovering the same thing.

Copy names the number and the reset:

> **AI is paused for this month.** The $5.00 budget has been used. It resets on
> 1 September.

## Testing

`vitest.config.mts` collects `src/actions/**`. Mock `@/lib/prisma`, `@/auth` and
**`@/lib/openai`** — no test may reach OpenAI.

The components are out of scope by configuration, so the `.catch` and the loading
states rest on the browser.

### `src/actions/ai.test.ts`

**The gates, in order** — and assert the *absence* of the later call, which is
what actually tests the ordering:

- Signed out refuses
- AI switched off refuses, **and the Pro check is not reached** (a free account
  with AI off gets the off message, not the upgrade message)
- A free account refuses, **and the limiter mock is not called**
- Rate limited refuses, **and `checkSpend` is not called**
- Over budget refuses with `budgetExceeded: true`, **and `getItemDetail` is not
  called**
- An item id that is not the caller's answers `MISSING` — the same message as a
  missing one, since the query does not tell them apart

**The call:**

- The user id passed to `getItemDetail` comes from the session, never the payload
- Content is truncated before it reaches the client mock
- Existing tags are included in the prompt
- `recordSpend` is called with the usage the response reported
- `recordSpend` throwing does **not** fail the suggestion

**The output:**

- 40 tags fails validation rather than being truncated
- A 200-character tag fails validation
- `output_parsed: null` answers a message rather than throwing
- An SDK `AuthenticationError` answers **generically** and logs

**Mutation-check the ownership scoping**: hardcode a different user id in the
`getItemDetail` call and confirm exactly one test fails. Revert from a copy —
`git checkout` does nothing for an untracked file.

Note `restoreMocks` restores `vi.spyOn` spies only, so a `vi.fn()` keeps its call
history across tests. **`vi.clearAllMocks()` in `beforeEach` is what makes every
"was not called" assertion above mean anything.**

## Verification

`npm test`, `npx tsc --noEmit`, `npx eslint src` and `npm run build` clean.

This is the first feature with a real external call, so a browser pass is worth
it even under the standing "stop at a green build" preference — and specifically:

- A real suggestion round trip against a seeded snippet
- Accepting three of five chips, then Save, and confirming the tags persisted
- Dismissing, and confirming nothing was written
- The free-account path raising the upsell rather than calling
- **A forced failure** via `page.route()` on the server-action POST, confirming
  the button re-enables — the exact check that caught the stranded delete dialog
