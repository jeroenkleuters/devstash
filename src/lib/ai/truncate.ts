/**
 * Bounding what gets sent to the model.
 *
 * The cost risk in these features is not the per-call price — a tagging call is
 * a hundredth of a cent. It is that the input is unbounded: `Item.content` is
 * `@db.Text` and holds whole files, and an uploaded one may be 100 MB. One
 * snippet holding a vendored library would be a single expensive call.
 */

/**
 * The ceiling, and what explain and optimize send: roughly 6,000 tokens, far
 * less than a large file.
 *
 * Those two are the features that genuinely want the whole artifact — an
 * explanation of half a file is an explanation of a different file, and a
 * rewrite that never saw the end of a prompt drops its requirements. The two
 * that do not need it have their own smaller budgets below; every one of them
 * is a bound on the *input*, so a smaller one is faster and cheaper both.
 *
 * Counted in **characters, not tokens**, deliberately: a tokenizer is another
 * dependency and another thing to keep in step with the model, and the budget
 * is loose enough that the approximation costs nothing. The ratio varies by
 * content — minified code runs more characters per token than prose — which is
 * fine for a ceiling and would not be for a billing figure.
 */
export const AI_CHARACTER_BUDGET = 24_000;

/**
 * What tagging sends.
 *
 * Classification: the opening of an item says what it is about, and the eight
 * words that come back cannot use more. Sending the full budget was paying for
 * prefill — in latency as well as in tokens — that could not change the answer.
 */
export const TAG_CHARACTER_BUDGET = 3_000;

/**
 * What summarising sends.
 *
 * Larger than tagging because a summary has to say what the item is *for*,
 * which sometimes only becomes clear past the first screen, and still far short
 * of the ceiling because it is two or three sentences and not a reading of the
 * whole file.
 */
export const SUMMARY_CHARACTER_BUDGET = 6_000;

/** Appended so the model knows it is seeing part of something. */
export const TRUNCATION_MARKER = "\n\n[… truncated]";

/**
 * Cuts content down to the budget, saying so when it did.
 *
 * **Takes the head rather than the middle**, which matters most for explaining
 * code: a file's imports and top-level structure are where an explanation
 * starts, and a window from the middle of one is the least useful slice
 * available. Tagging and summarizing are indifferent, so one rule serves all
 * four rather than each feature choosing.
 *
 * The marker is appended *after* the cut, so the result can exceed the budget
 * by its length. That is intended — the budget bounds the content, and a
 * fifteen-character note about the content is not what makes a call expensive.
 */
export function truncateForAi(
  content: string,
  budget: number = AI_CHARACTER_BUDGET,
): string {
  // `>` and not `>=`: content of exactly the budget fits, and marking it
  // truncated would be a lie about a complete artifact.
  if (content.length > budget) {
    return content.slice(0, budget) + TRUNCATION_MARKER;
  }

  return content;
}
