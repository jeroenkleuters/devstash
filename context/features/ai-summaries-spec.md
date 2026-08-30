# AI Feature 4 — AI summaries

## Overview

A Sparkles button beside the Description field asks `gpt-5-nano` for a short
summary of the item, offered as an accept-or-dismiss suggestion.

**Almost everything is already built.** Feature 1 gave the client, the wrapper,
the spend ledger and truncation; feature 3 gave the gate preamble, the suggest
component, the upsell member and the budget toast. This feature is a prompt, an
output schema, one action and a mount point.

Reference: @docs/ai-integration-plan.md §5.2. Read
@context/features/ai-auto-tagging-spec.md first — the gate ordering, the `.catch`
rule and the UI states are specified there and are not repeated here.

## Requirements

- No migration, no new dependency, no new component beyond the mount
- Depends on features 1–3
- `npm test`, `npx tsc --noEmit`, `npx eslint src` and `npm run build` clean

## Files to modify

| File | Change |
|---|---|
| `src/actions/ai.ts` | `summarizeItem`, reusing the shared preamble |
| `src/actions/ai.test.ts` | The tests below |
| `src/lib/ai/prompts.ts` | The summary prompt (the constant exists, unused, from feature 1) |
| `src/lib/validations/ai.ts` | `summaryOutputSchema` |
| `src/components/items/item-form-fields.tsx` | Mount the button beside Description |

## The output schema caps at 500, and that is load-bearing

`DESCRIPTION_MAX_LENGTH` is 500 in `itemFields`, and **the destination is the
Description field** — so the schema caps the model's output at the same number,
imported rather than restated.

A summary the model returns that the form then refuses is a worse failure than
one the model was constrained to fit: the first looks like a bug to the user and
wastes a call, the second never happens. This is the same doubled-enforcement
shape `uploadPreferencesSchema` uses.

## It is offered for five types, not seven

**Description does not exist for File, Image and Book.** The file-title feature
gated that field on `uploadKindFor(typeSlug) === undefined`, so a summary has
nowhere to go for the three upload types.

**Use that existing predicate rather than writing a new list.** A fourth parallel
list of slugs is exactly what the constants module has been consolidated to
avoid, and `isCopyableType` already derives from `uploadKindFor` as precedent.

## The call

- Input is title + content, through `truncateForAi`
- `reasoning.effort: "low"`, `text.verbosity: "low"` — it needs to read the item,
  not reason about it
- `prompt_cache_key: "devstash:summary:v1"`
- The prompt asks for two or three sentences describing what the item *is* and
  when it would be useful, not a restatement of its first lines

## It writes nothing

Same as feature 3: the action returns `{ summary: string }`, the user accepts it
into the Description field's local state, and the existing `updateItem` saves it
on the user's own Save.

**Accepting replaces the field's current value**, which is the one behavioural
difference from tags — tags merge, a description does not. So the suggestion is
shown **beside** the current value with the existing text still visible, and
accepting is an explicit click rather than a silent overwrite. Someone who
already wrote a description must be able to see what they are about to lose.

## Testing

Add to `src/actions/ai.test.ts`. The gate tests are parameterised over both
actions rather than duplicated — the preamble is shared, so testing it twice in
full is testing the same code twice.

New assertions specific to this action:

- A 600-character summary fails the output schema
- Exactly 500 passes (the boundary)
- The schema's cap is `DESCRIPTION_MAX_LENGTH`, **imported not restated** —
  assert against the constant so the test cannot drift from the field
- `reasoning.effort` is `"low"`, not the tagging action's `"minimal"`
- `recordSpend` is called with the reported usage

## Verification

`npm test`, `npx tsc --noEmit`, `npx eslint src` and `npm run build` clean.

Worth a browser check: that the button is **absent** on File, Image and Book
items — the type gate is the one thing here that could silently be wrong, since
it is not enforced by a schema.
