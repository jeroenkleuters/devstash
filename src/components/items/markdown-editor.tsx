"use client";

import { Check, Copy } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

interface MarkdownEditorProps {
  value: string;
  /** Display mode. Without it the editor is a form control and wants `onChange`. */
  readOnly?: boolean;
  onChange?: (value: string) => void;
  /** Names the source field for screen readers, as the forms' labels do. */
  ariaLabel?: string;
  /**
   * Extra controls for the right of the bar, between the format label and
   * Copy — the same slot `CodeEditor` gives Explain.
   */
  barExtra?: ReactNode;
}

/**
 * A Markdown field in the same window frame the code editor uses: a bar with a
 * copy button, and the content below it.
 *
 * In edit mode the bar carries Write / Preview tabs and opens on Write. In
 * read-only mode there is nothing to write, so the tabs give way to a plain
 * "Preview" label and the rendered output is all there is.
 */
export function MarkdownEditor({
  value,
  readOnly = false,
  onChange,
  ariaLabel,
  barExtra,
}: MarkdownEditorProps) {
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    };
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);

      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // Denied permission, or an insecure origin — the clipboard is the only
      // place this could have gone, so there is no fallback to offer.
      toast.error("Could not copy to clipboard");
    }
  }

  /**
   * The right of the bar, mirroring the code editor's: the format, whatever
   * the caller put in `barExtra`, then Copy.
   *
   * **"Markdown" is not decoration** — the field is a plain textarea until you
   * switch to Preview, so nothing else on screen says that `**bold**` will do
   * anything. It sits where the code frame names its language, for the same
   * reason: the bar is where a frame says what it holds.
   */
  const meta = (
    <span className="markdown-editor-meta">
      <span className="markdown-editor-language">Markdown</span>

      {barExtra}

      <button
        type="button"
        className="markdown-editor-copy"
        onClick={copy}
        disabled={value === ""}
        data-copied={copied}
        title={copied ? "Copied" : "Copy"}
        aria-label={copied ? "Copied" : "Copy"}
      >
        {copied ? (
          <Check size={14} aria-hidden />
        ) : (
          <Copy size={14} aria-hidden />
        )}
        <span className="action-label">{copied ? "Copied" : "Copy"}</span>
      </button>
    </span>
  );

  if (readOnly) {
    return (
      <div className="markdown-editor">
        <div className="markdown-editor-bar">
          <span className="markdown-editor-label">Preview</span>
          {meta}
        </div>

        <MarkdownPreview value={value} />
      </div>
    );
  }

  return (
    <Tabs defaultValue="write" className="markdown-editor">
      <div className="markdown-editor-bar">
        <TabsList className="markdown-editor-tabs">
          <TabsTrigger value="write">Write</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        {meta}
      </div>

      <TabsContent value="write">
        <Textarea
          className="markdown-editor-input"
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          aria-label={ariaLabel}
          spellCheck={false}
        />
      </TabsContent>

      <TabsContent value="preview">
        <MarkdownPreview value={value} />
      </TabsContent>
    </Tabs>
  );
}

/**
 * The rendered output.
 *
 * Raw HTML is left disabled — `react-markdown` ignores it unless `rehype-raw`
 * is added, and it must stay that way: item content is user-authored and
 * stored, so rendering embedded HTML would be a stored-XSS path.
 *
 * Exported because the AI explanation panel renders through it. That refusal
 * is doing more work there than here: a model's answer is untrusted content
 * from a remote service, and it is the one thing in this app rendered as a
 * paragraph of markdown rather than put in an input's value.
 */
export function MarkdownPreview({ value }: { value: string }) {
  if (!value.trim()) {
    return <p className="markdown-editor-empty">Nothing to preview.</p>;
  }

  return (
    <div className="markdown-preview">
      <Markdown remarkPlugins={[remarkGfm]} components={{ a: MarkdownLink }}>
        {value}
      </Markdown>
    </div>
  );
}

/** Markdown links point outward, so they leave the app in their own tab. */
function MarkdownLink({ href, children, ...props }: ComponentProps<"a">) {
  return (
    <a {...props} href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  );
}
