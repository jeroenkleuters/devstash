# AI latency improvements

> How to make the AI features feel faster without meaningfully raising the OpenAI bill.
> Written 2026-08-31, against the four features in `src/actions/ai.ts` (tags, summary,
> explain, optimize) as they shipped.

---

## Where the time actually goes

Three things, in order of size:

1. **Reasoning tokens.** `gpt-5-nano` is a reasoning model: before it emits a single
   character of answer it generates reasoning tokens, and those are billed at the
   **output** rate. `reasoning.effort` is therefore the one knob that moves latency and
   cost in the same direction.
2. **Nothing is streamed.** Every feature waits for the complete response before showing
   anything, so the visitor stares at a spinner for the full duration even when the first
   sentence was ready in a second.
3. **Prefill.** `AI_CHARACTER_BUDGET` is 24,000 characters (~6,000 tokens) for *every*
   call, including tagging, which needs a fraction of that.

Not a factor, and worth knowing so it is not chased: **prompt caching will not fire.**
It needs a ≥1,024-token static prefix and the observed requests run ~812 input tokens
total. `prompt_cache_key` is plumbed on all four calls and is currently decorative.
Padding a prompt to reach the threshold costs more than it saves.

---

## 1. Drop explain from `effort: "medium"` to `"low"`

**File:** `src/actions/ai.ts:336` · **Effort:** one line · **Cost:** goes *down*

Explain is the only action at `medium`, which makes it the slowest of the four. Because
reasoning tokens bill at the output rate, lowering it is the only change here that is
simultaneously faster and cheaper.

Keep `verbosity: "medium"`. Verbosity governs how much answer is produced; effort governs
how long the model deliberates first. Lowering effort alone shortens the thinking, not the
explanation.

The original reasoning for `medium` was that with explain the answer *is* the product,
where the other features produce a value to accept. That still argues for the higher
**verbosity**; it does not on its own argue for the higher effort on a model this small.

Measure before and after on the same snippet — this is the change most worth a number.

## 2. Stream explain (and optimize)

**Effort:** real work · **Cost:** none at all · **Perceived win:** the largest available

Both produce one long block of text (explain caps at 4,000 characters, the optimized
prompt at ~2,000). Streaming does not make the call finish sooner, but text starts
appearing after roughly a second instead of at the end, which is the difference between
"slow" and "working".

The obstacle is deliberate: `runStructured` is the single call path, and it returns a
parsed object. For explain the schema is one string field (`codeExplanationSchema`) and is
carrying very little — swapping it for plain text via `responses.stream()` is defensible
there. It is **not** defensible for tags or optimize, whose structure is the point.

So this is a second call path beside `runStructured`, not a change to it. Treat it as its
own feature. Note also that the explanation cache (`ItemExplanation`) already makes the
*second* view instant, so this only improves the first.

## 3. Per-feature character budgets

**File:** `src/lib/ai/truncate.ts:20` and the four call sites · **Effort:** one argument
per call · **Cost:** goes *down*

`truncateForAi(content, budget)` already accepts a budget; nothing passes one. A single
24,000-character ceiling means a tagging call sends up to ~6,000 tokens of prefill to
produce eight words.

Rough starting points, to be adjusted by eye:

| Feature  | Suggested budget | Why |
|---|---|---|
| Tags     | ~3,000  | Classification. The opening of an item is enough. |
| Summary  | ~6,000  | Needs to see what the item is, not all of it. |
| Explain  | 24,000 (keep) | Explaining code genuinely wants the whole file. |
| Optimize | 24,000 (keep) | The prompt being rewritten must arrive whole, or the rewrite drops requirements. |

`truncateForAi` takes the **head**, which is the right slice for all four.

## 4. Cache the other three results

**Effort:** a migration plus a lookup · **Cost:** none

`ItemExplanation` makes a repeat explain instant and free. The same shape — a SHA-256
digest of exactly what was sent, plus `AI_MODEL`, as the freshness key — works for tags,
summaries and optimized prompts.

Two rules from building the explain cache that carry over unchanged:

- **Do not key on `Item.updatedAt`.** Prisma bumps it on every write, so favouriting,
  pinning or tagging an item would throw away an answer that is still correct.
- **Consult the cache after the item read but before the rate limiters**, so a free hit
  does not spend one of the caller's hourly attempts.

Lower priority than 1–3: tags and summaries are cheap and fast enough that a second ask is
not painful, and the cost saving is small.

---

## Deliberately rejected

- **Forcing prompt caching.** See above — the prefix is too short and padding it costs
  more than the discount returns.
- **A larger model.** `gpt-5-nano` is already the fastest tier; anything else is slower
  *and* dearer.
- **Prefetching an explanation when the drawer opens.** It would pay for a call on every
  open of every code item, including the ones nobody explains. The click is what makes the
  cost proportional to the value — and, per the privacy page, what makes the send
  consented to.
- **Raising `maxRetries` above 1.** Every retry is a second full-price call, and the SDK
  retries on 429, which is exactly when retrying is wrong.
- **Lowering the 30s `timeout`.** It is a ceiling, not a wait; nothing waits longer
  because of it.

---

## Recommended order

1. **§1 now** — one line, cheaper, faster, no test touched.
2. **§3 with it** — one argument per call site, same properties.
3. **§2 as its own feature**, once §1 has been measured and the remaining wait is known.
4. **§4 if repeat asks turn out to be common** — check before building it.
