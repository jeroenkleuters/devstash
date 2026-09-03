/**
 * What the model is shown, and nothing more.
 *
 * These two build the entire user-supplied half of every AI request. The
 * privacy page names exactly which fields leave the app, so this is the module
 * that has to keep that claim true — which is also why it lives here rather
 * than inside `src/actions/ai.ts`, where it was reachable only by calling an
 * action and could be asserted only through one.
 *
 * Both are sync and pure. Neither reads a session, a row or an environment
 * variable: the caller resolves what to describe, and this decides what of it
 * is sent.
 */

import { EXISTING_TAGS_LABEL } from "@/lib/ai/prompts";
import { truncateForAi } from "@/lib/ai/truncate";

/**
 * The item as the model sees it: what the user wrote, and nothing else.
 *
 * No id, no owner, no collection names, no filename — the privacy page says
 * only the title, description and content are sent, and this is the function
 * that has to keep that true.
 *
 * Existing tags go too, and the prompt tells the model not to repeat them:
 * cheaper than deduping the answer afterwards, and it produces better
 * suggestions than asking blind.
 */
export function describeItem(
  item: {
    title: string;
    description: string | null;
    content: string | null;
    tags: string[];
  },
  budget: number,
): string {
  const parts = [`Title: ${item.title}`];

  if (item.description) {
    parts.push(`Description: ${item.description}`);
  }

  if (item.tags.length > 0) {
    parts.push(`${EXISTING_TAGS_LABEL}: ${item.tags.join(", ")}`);
  }

  if (item.content) {
    parts.push(`Content:\n${item.content}`);
  }

  // Truncated as one block rather than per field, so a huge content field
  // cannot push the title out of what is sent. The budget is the caller's
  // because the two features sharing this helper need different amounts:
  // tagging reads the opening, summarising reads further in.
  return truncateForAi(parts.join("\n\n"), budget);
}

/**
 * The code as the model sees it: the code, and the language hint when the item
 * carries one.
 *
 * No title and no description — an explanation is supposed to come from reading
 * the code, and a title saying what the snippet is for is exactly the thing a
 * model will paraphrase instead of doing the work. The hint goes in because
 * `Item.language` is free text a person chose, and it disambiguates syntax that
 * several languages share.
 *
 * Truncated as one block, so the hint cannot be pushed out by a long file, and
 * `truncateForAi` takes the **head** — a file's imports and top-level structure
 * are where an explanation starts.
 */
export function describeCode(item: { content: string; language: string | null }): string {
  const parts = item.language ? [`Language: ${item.language}`] : [];

  parts.push(`Code:\n${item.content}`);

  return truncateForAi(parts.join("\n\n"));
}
