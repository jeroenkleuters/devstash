# AI Feature 5 — Explain this code

## Overview

An Explain button in the item drawer asks `gpt-5-nano` what a snippet or command
does, and renders the answer as Markdown in a panel below the code.

**This is the one AI feature with no accept step**, because there is no field the
answer belongs in. It is displayed and optionally copied, never merged into the
item — which also makes it the only one that could later gain streaming without a
redesign.

Reference: @docs/ai-integration-plan.md §5.3. Read
@context/features/ai-auto-tagging-spec.md first — the gate ordering, the `.catch`
rule and the gating pattern are specified there and are not repeated here.

## Requirements

- No migration, no new dependency, no new ShadCN primitive
- Depends on features 1–3
- `npm test`, `npx tsc --noEmit`, `npx eslint src` and `npm run build` clean

## Files to create

| File | Contents |
|---|---|
| `src/components/ai/ai-explanation-panel.tsx` | The result panel — no accept, a Copy button |

## Files to modify

| File | Change |
|---|---|
| `src/actions/ai.ts` | `explainCode` |
| `src/actions/ai.test.ts` | The tests below |
| `src/lib/ai/prompts.ts` | The explain prompt |
| `src/lib/validations/ai.ts` | `explanationOutputSchema` |
| `src/components/items/item-drawer.tsx` | The Explain button and the panel, view mode |
| `src/app/globals.css` | The panel |

## Offered only for code types

`isCodeType(slug)` — snippets and commands. That predicate exists and is what
already decides which types get the Monaco editor. **Explaining a note is not a
feature.**

## It lives in view mode, not edit mode

Unlike tags and summaries, this does not fill a field, so it does not belong in
the form. The button sits in the drawer's view mode beside the code, and the
panel opens under it.

That also means it works on an item the user is only reading, which is the actual
use — you open a snippet you saved six months ago precisely because you no longer
remember what it does.

## Rendering the answer

**Through the existing `MarkdownPreview`**, which already refuses raw HTML:
`rehype-raw` is deliberately absent and there is a comment saying why.

**That refusal is doing real work here.** Model output is untrusted content, and
this is the one AI feature that renders a paragraph of it rather than putting it
in an `<input>` value. Do not relax it, and do not add `rehype-raw` to make some
formatting work.

The output schema caps the explanation at a sane length (8,000 characters) purely
to bound cost — there is no field constraining it.

## The call

- Input is the code, plus the language hint if the item carries one, through
  `truncateForAi` — **taking the head**, since a file's imports and top-level
  structure are where an explanation starts
- `reasoning.effort: "medium"`, `text.verbosity: "medium"` — **the highest of the
  four**, and deliberately: this is the one feature where the answer's quality
  *is* the product. The others produce a value to accept; this produces the thing
  itself
- `prompt_cache_key: "devstash:explain:v1"`
- The prompt asks for what the code does, then anything surprising about it —
  not a line-by-line narration, which is what a naive prompt produces and which
  is worthless to someone who can already read the code

## No streaming in this feature

The plan (§0.1) recommends non-streaming first and measuring. **Keep it that
way here.** Streaming means a route handler with its own 401 outside the proxy
matcher, an SSE reader in the browser and a second error-reporting shape — and
the panel design does not change if streaming is added later, because the result
is displayed rather than merged.

**Record the measured latency** when this is verified. That number is what
decides whether the streaming follow-up is worth building.

## The panel

- Opens under the code block, does not replace it
- A **Copy** button, reusing `copyText` from `src/lib/item-copy.ts` — the shared
  one the drawer and the card already use
- A **loading skeleton** shaped like paragraphs, using `height: 1lh` per line
- **Dismissible**, and cleared when the drawer closes or a different item opens —
  the drawer keeps `summary` on close so the sheet does not blank mid-animation,
  and an explanation left over from the previous item would be worse than blank
- The result is **not cached**; reopening re-asks. Deliberate for now, and the
  first thing to revisit if the cost or the wait annoys — a cache keyed on
  `item.updatedAt` is the shape

## Testing

Add to `src/actions/ai.test.ts`, with the shared gate tests parameterised over
all three actions rather than duplicated.

New assertions specific to this action:

- Refuses a non-code type — a note id answers rather than calling the model
- Truncation takes the **head**, not the middle
- The language hint is included in the prompt when present, and omitted cleanly
  when null
- `reasoning.effort` is `"medium"` — the one action that differs
- A 20,000-character explanation fails the output schema
- `output_parsed: null` answers a message rather than throwing

## Verification

`npm test`, `npx tsc --noEmit`, `npx eslint src` and `npm run build` clean.

In the browser:

- A real explanation on a seeded snippet, and **time it** — that number decides
  the streaming follow-up
- The button absent on notes, prompts, links, files and images
- **A Markdown response containing a raw `<script>` or `<img onerror=…>` renders
  as text, not as HTML** — the `rehype-raw` guarantee, forced via `page.route()`
  rather than by prompting the model into it
- The panel clearing when a different item is opened
