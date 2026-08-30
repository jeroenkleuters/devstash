# AI Feature 1 — Foundation

## Overview

The plumbing every AI feature goes through: the OpenAI client, the call wrapper
that owns error mapping and effort, the spend ledger and its cap, the validation
schemas, and the `aiPreferences` column the off switch will later write.

**Nothing in this feature is user-visible, and nothing calls OpenAI.** No action,
no button, no settings card, no privacy page. Every module lands with its
consumers still absent, so the app builds and behaves identically before and
after.

That is the point of the split, and it is the same one Stripe phase 1 made:
everything here is in `src/lib/`, which is exactly what `vitest.config.mts`
collects, so **all of it can be proven with `npm test`** — where the features
that follow need a real API key and a browser.

Reference: @docs/ai-integration-plan.md — §1, §2, §4, §6, and the schema half of
§3. Code sketches for most files below are in that document.

## Requirements

- `npm install openai` — one runtime dependency
- **One migration**: `User.aiPreferences Json?`
- `OPENAI_API_KEY` and `AI_MONTHLY_BUDGET_USD` in `.env`, documented in
  `.env.example` in the house style where every entry says *why*
- Unit tests for the pure modules (see Testing)
- `npm test`, `npx tsc --noEmit`, `npx eslint src` and `npm run build` clean
- No behaviour change anywhere: `/dashboard`, `/items/*`, `/collections`,
  `/settings` and every create flow work exactly as before

## Before writing code

**Set the budget limit in the OpenAI dashboard.** It is phase 0 in the plan and
takes a minute. It is the only spend control enforced on OpenAI's side of the
wire, so it is the only one that survives a bug in ours — everything this feature
builds is a second line of defence behind it.

## Files to create

| File | Contents |
|---|---|
| `src/lib/openai.ts` | `getOpenAI()`, `AI_MODEL` |
| `src/lib/ai/run.ts` | `runStructured()` — the single call path |
| `src/lib/ai/run.test.ts` | Error mapping, usage accounting, truncation |
| `src/lib/ai/prompts.ts` | The four system prompts as constants (unused until later features) |
| `src/lib/ai/spend.ts` | `checkSpend()`, `recordSpend()`, `costOf()` |
| `src/lib/ai/spend.test.ts` | The cost arithmetic and the cap boundary |
| `src/lib/ai/truncate.ts` | `truncateForAi()` |
| `src/lib/ai/truncate.test.ts` | Head-vs-middle, the marker, the boundary |
| `src/lib/validations/ai.ts` | Request schemas + the four output schemas |
| `src/lib/validations/ai.test.ts` | Output caps, and that a request names an id |
| `src/types/ai.ts` | Result unions, `AiPreferences` — no runtime import |

## Files to modify

| File | Change |
|---|---|
| `prisma/schema.prisma` | `aiPreferences Json?` on `User` |
| `src/lib/db/user.ts` | `aiPreferences` on `CurrentUser`, parsed through the lenient reader |
| `.env.example` | `OPENAI_API_KEY`, `AI_MONTHLY_BUDGET_USD` |

## The client — `src/lib/openai.ts`

Follows `stripe.ts` and `resend.ts` exactly: one instance per process, key read
**lazily** so importing the module cannot crash a build or a request that never
talks to OpenAI.

Three settings that are not the SDK defaults, and each is a decision:

- **`timeout: 30_000`.** The default is 10 minutes, which on a serverless host
  means the platform's own limit fires first and the visitor gets nothing useful.
- **`maxRetries: 1`.** The default is 2, and every retry is a second full-price
  call. The SDK retries on 429 — which for a per-account gate is exactly when
  retrying is wrong.
- **`AI_MODEL` as an exported constant**, not a literal at four call sites.

## The call wrapper — `src/lib/ai/run.ts`

Every feature routes through `runStructured()`, so the things that must be
consistent are written once.

- **Responses API, not Chat Completions** — `openai.responses.parse()` with
  `zodTextFormat`, which gives a typed result from the same zod v4 already in the
  project.
- **`gpt-5-nano` is a reasoning model.** `temperature`, `top_p`,
  `presence_penalty`, `frequency_penalty`, `logprobs`, `logit_bias` and
  `max_tokens` are **unsupported and error** — they are not silently ignored.
  Steering is `reasoning.effort` and `text.verbosity` only. This is the single
  most likely thing to get wrong from memory.
- **The system prompt goes in `instructions`, never concatenated into `input`.**
  It is the static prefix, and mixing varying content into it would destroy any
  cache hit.
- **`prompt_cache_key` per feature**, versioned (`"devstash:tags:v1"`). Bump the
  version when the prompt changes; a stale cache against a new prompt is the
  subtle failure.
- **`response.output_parsed` can be `null`** when the model refuses or the parse
  fails. That is a real branch with its own message, not a crash.
- **Errors are mapped, never rethrown.** The SDK throws `APIConnectionError`,
  `RateLimitError`, `AuthenticationError` and `APIStatusError`. An
  `AuthenticationError` means **our** key is wrong: log it loudly and answer
  generically, because telling the visitor about our API key tells them something
  about our infrastructure and nothing they can act on. Same split
  `startCheckout` already makes for an unconfigured price.
- **Returns usage alongside the data**, so the caller can record spend.

### Effort and verbosity, per feature

| Feature | `reasoning.effort` | `text.verbosity` |
|---|---|---|
| Auto-tag | `minimal` | `low` |
| Summary | `low` | `low` |
| Explain code | `medium` | `medium` |
| Prompt optimizer | `low` | `medium` |

Reasoning tokens bill at the **output** rate, so `minimal` on tagging is the
largest per-call saving available. Starting everything at `medium` and tuning
down later is the expensive default.

## The spend cap — `src/lib/ai/spend.ts`

Read @docs/ai-integration-plan.md §6 in full before implementing this. The
summary:

- **A global monthly ledger in Redis**, one key per calendar month
  (`devstash:ai:spend:2026-08`), holding **integer micro-dollars**. Integers
  because floating-point accumulation over thousands of increments drifts.
- **Global, not per-account**, and deliberately. The requirement is that the
  owner's bill is bounded; a per-account cap does nothing about fifty accounts
  spending a dollar each.
- **`AI_MONTHLY_BUDGET_USD` is an env var**, so the cap changes without a deploy.
- **Check before, increment after.** Cost is not known until the response reports
  its tokens, so the check is against spend *so far* — which means **the cap can
  be overshot by at most one call**. Bounded and tiny given the output caps and
  truncation. State this in a comment; it is a real property, not a rounding
  error to hide.
- **Cost comes from `response.usage`**, never estimated from the input. Prices
  per 1M tokens: input `$0.05`, cached `$0.005`, output `$0.40`.
- **Subtract the cached tokens from the input count before pricing.** They arrive
  under `input_tokens_details.cached_tokens` and are *included* in
  `input_tokens`. Pricing both counts bills them twice at ten times the rate. It
  fails in the safe direction — over-counting, so the cap trips early — which is
  why it could sit unnoticed for a long time. **Test this specifically.**
- **`checkSpend()` fails CLOSED**, and that is a deliberate inconsistency with
  `rateLimit`, which stays failing open and is not changed by this feature. If
  Redis is unreachable the spend is unknown, and spending an unknown amount is
  what the cap exists to prevent. The codebase already has this split:
  `rateLimit` fails open while `webhookSecret()` throws. Put the reasoning in a
  comment on `checkSpend`.
- **The consequence to accept:** an Upstash outage disables AI features entirely
  and nothing else. The message says so rather than implying the model is down.
- **`recordSpend()` never throws.** A ledger write that fails must not turn a
  successful suggestion into an error the user sees — log it and move on. The
  cost is that the failed increment is lost, which is why the dashboard cap is
  the real guarantee.

## Truncation — `src/lib/ai/truncate.ts`

The cost risk here is not the per-call price, it is an unbounded input:
`Item.content` is `@db.Text` and holds whole files.

- A **character budget** (start at 24,000, roughly 6,000 tokens), applied before
  any call.
- A marker appended when content was cut, so the model knows it is seeing part of
  something rather than a complete artifact.
- **Take the head, not the middle.** For Explain especially, a file's imports and
  top-level structure are where an explanation starts.
- Cut on a character count, not a token count — a tokenizer is another dependency
  and the budget is deliberately loose.

## The preferences column

`aiPreferences Json?` on `User`, following `uploadPreferences` exactly:

```ts
export type AiPreferences = { enabled: boolean };
export const DEFAULT_AI_PREFERENCES: AiPreferences = { enabled: true };
```

**`type` and not `interface`.** It goes into a Prisma `Json` column, whose
`InputJsonObject` wants an index signature; TypeScript infers one for an alias
but never for an interface. The build fails otherwise, in a way that looks
unrelated to the cause — the editor-preferences feature records learning this.

Two schemas, as `uploadPreferences` has:

- A **strict** `aiPreferencesSchema` — what a write must satisfy. Not used yet;
  the settings action in feature 2 is its first caller.
- A **lenient** `parseAiPreferences` — reads the column field by field with
  `.catch()` fallbacks, so a value written by a future version, or edited by
  hand, costs that one preference rather than resetting the object.

`getCurrentUser` reads it, so the off-switch check in every later action costs no
query of its own. **It defaults on** — see feature 2 for the full argument.

**Run `npx prisma generate` by hand after `npm run db:migrate`.** The generated
client under `src/generated/prisma` does not always pick up a new column, and
`tsc` then fails on lines that have nothing wrong with them. Two previous
features record this.

## What is deliberately not here

- Any server action. `src/actions/ai.ts` does not exist yet.
- Any component, button or settings card.
- The privacy page.
- The `UpgradeReason` fifth member — it is a visible UI change and belongs with
  the gate that justifies it.
- Rate limit keys. They are one line in the action that uses them.

## Testing

Everything this feature adds is in `src/lib/`, so all of it is collected.
`@/lib/openai` is mocked wholesale — **no test may reach OpenAI.**

### `src/lib/ai/spend.test.ts`

- `costOf` prices input, cached and output at the §1 rates
- **Cached tokens are subtracted from the input count** — a response with 1,000
  input of which 800 cached costs 200 at the input rate plus 800 at the cached
  rate, not 1,000 plus 800
- Zero usage costs zero
- Under the cap allows; at the cap refuses (**the boundary is `>=`**, matching
  `usage-limits`); over the cap refuses
- **An unreachable Redis refuses** — the fail-closed branch, and the one most
  worth having a test for
- `recordSpend` swallows a write failure rather than throwing

**Mutation-check the cached-token subtraction**: remove it and confirm exactly
the one test fails. Revert.

### `src/lib/ai/truncate.test.ts`

- Content under the budget is returned unchanged, with no marker
- Content over the budget is cut to the budget and carries the marker
- The cut takes the head
- Exactly-at-budget is not truncated (the `>` boundary)

### `src/lib/validations/ai.test.ts`

- A request names an item id and nothing else; extra fields are stripped
- The tag output schema caps at 8 and at `TAG_MAX_LENGTH`
- The summary output schema caps at `DESCRIPTION_MAX_LENGTH`
- A model returning 40 tags fails the schema rather than being truncated silently

### `src/lib/ai/run.test.ts`

With the OpenAI client mocked:

- A `null` `output_parsed` maps to its own message, not a throw
- An SDK `AuthenticationError` answers **generically** and logs
- An SDK `RateLimitError` (OpenAI's, not ours) maps to its own message
- A connection error maps to its own message
- The system prompt is passed as `instructions` and **not** concatenated into
  `input`
- **No unsupported parameter is sent** — assert the call carries no
  `temperature`, `top_p` or `max_tokens`

Note `restoreMocks` in `vitest.config.mts` restores `vi.spyOn` spies only, so a
`vi.fn()` keeps its call history across tests. `vi.clearAllMocks()` in
`beforeEach` is what makes the "was not called" assertions mean anything.

## Verification

`npm test` green, `npx tsc --noEmit`, `npx eslint src` and `npm run build` clean.
`npm run db:status` reports the migration applied.

Nothing to check in the browser — no route, component or behaviour changed. The
one thing worth confirming by hand is that **the app still builds and runs with
`OPENAI_API_KEY` unset**, which is what the lazy client exists to guarantee.
