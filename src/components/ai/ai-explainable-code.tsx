"use client";

import { useState } from "react";
import { toast } from "sonner";

import { explainCode } from "@/actions/ai";
import { AiSuggestButton } from "@/components/ai/ai-suggest-button";
import { useBilling } from "@/components/billing/billing-provider";
import { CodeEditor } from "@/components/items/code-editor";
import { MarkdownPreview } from "@/components/items/markdown-editor";
import { UNREACHABLE } from "@/constants/messages";

interface AiExplainableCodeProps {
  itemId: string;
  value: string;
  language: string | null;
  fallbackLanguage?: string;
}

/**
 * The read-only code block, plus an Explain button in its title bar and the
 * answer as a second tab in the same frame.
 *
 * **The explanation shares the editor's window rather than sitting under it.**
 * It is another view of the same thing, so it belongs in the same frame — and
 * putting it there means the bar's Copy button can follow whichever tab is
 * showing instead of a second copy affordance appearing below.
 *
 * **The one AI feature with no accept step**: there is no field an explanation
 * belongs in, so nothing is merged, nothing is written and Save is not
 * involved. There is no Dismiss either — switching back to Code is the whole
 * of it, and the tab lives as long as the drawer is open on this item.
 *
 * **Cleared when the drawer closes or a different item opens**, and both come
 * for free rather than from an effect: Radix unmounts `SheetContent` on close,
 * and the caller keys this on the item id, so switching items remounts it.
 *
 * **Not cached** — asking again re-asks and pays again. Deliberate for now; a
 * cache keyed on `item.updatedAt` is the shape if the wait starts to grate.
 *
 * **Deliberately not optimistic**, like the other AI features: there is nothing
 * to be optimistic about when the answer is unknown until the model gives it.
 */
export function AiExplainableCode({
  itemId,
  value,
  language,
  fallbackLanguage,
}: AiExplainableCodeProps) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [showing, setShowing] = useState<"code" | "explanation">("code");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { aiEnabled, setBudgetExceeded } = useBilling();

  async function run() {
    setBusy(true);
    setError(null);

    try {
      // A failed *write* answers `{ success: false }`; a failed *request*
      // rejects. Without this the rejection is unhandled and the button stays
      // busy for good — the defect this project has shipped four times.
      const result = await explainCode({ itemId }).catch(() => null);

      if (!result?.success) {
        if (result && "budgetExceeded" in result && result.budgetExceeded) {
          setBudgetExceeded();
        }

        const message = result?.error ?? UNREACHABLE;

        // Inline *and* a toast: the drawer body scrolls, so an inline error can
        // sit off-screen while the button that caused it does not.
        setError(message);
        toast.error(message);
        return;
      }

      setExplanation(result.data);
      // The answer is what was asked for, so it is what gets shown.
      setShowing("explanation");
    } finally {
      // The other half of the catch: whatever happened, the button works again.
      setBusy(false);
    }
  }

  const onExplanation = explanation !== null && showing === "explanation";

  return (
    <div className="ai-explainable">
      <CodeEditor
        value={value}
        language={language}
        fallbackLanguage={fallbackLanguage}
        readOnly
        // Only once there is something to switch to: before that the frame
        // keeps its traffic lights, which is what the tabs displace.
        tabs={
          explanation !== null ? (
            <span className="code-editor-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={showing === "code"}
                onClick={() => setShowing("code")}
              >
                Code
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={onExplanation}
                onClick={() => setShowing("explanation")}
              >
                Explain
              </button>
            </span>
          ) : undefined
        }
        // Stays on both tabs, so the explanation can be re-asked from either.
        barExtra={
          aiEnabled ? (
            <AiSuggestButton
              label="AI code explanations"
              title="Explain what this code does"
              action="Explain"
              busy={busy}
              onSuggest={run}
            />
          ) : undefined
        }
        altView={
          onExplanation ? (
            <div className="ai-explanation">
              {/* Through `MarkdownPreview`, which refuses raw HTML. Model
                  output is untrusted content from a remote service, and this
                  is the one place a paragraph of it is rendered rather than
                  put in an input's value — do not add `rehype-raw` here to
                  make some formatting work. */}
              <MarkdownPreview value={explanation} />
            </div>
          ) : undefined
        }
        copyValue={onExplanation ? (explanation ?? "") : undefined}
      />

      {error && <p className="ai-suggestions-error">{error}</p>}
    </div>
  );
}
