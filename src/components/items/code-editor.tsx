"use client";

import Editor, {
  type BeforeMount,
  type EditorProps,
  type OnMount,
} from "@monaco-editor/react";
import { Check, Copy } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { useEditorPreferences } from "@/components/editor/editor-preferences-provider";
import { languageLabel, monacoLanguageId } from "@/lib/code-language";
import { defineEditorThemes } from "@/lib/monaco-themes";

/** Tallest the editor grows before it starts scrolling instead. */
const MAX_HEIGHT = 400;
/** A read-only block shrinks to its content; a two-line command stays short. */
const READ_ONLY_MIN_HEIGHT = 72;
/** An edit box opens with room to type into, even for an empty item. */
const EDIT_MIN_HEIGHT = 220;

const VERTICAL_PADDING = 24;

/**
 * Monaco derives a line height from the font size when it is not told one, but
 * the opening-height estimate below needs the number before the editor exists.
 * 1.6 is the ratio the editor was built at (21px against a 13px font).
 */
function lineHeightFor(fontSize: number) {
  return Math.round(fontSize * 1.6);
}

interface CodeEditorProps {
  value: string;
  /** The item's free-text language hint, as typed into the form. */
  language: string | null;
  /** What to highlight as when the item names no language. */
  fallbackLanguage?: string;
  /** Display mode. Without it the editor is a form control and wants `onChange`. */
  readOnly?: boolean;
  onChange?: (value: string) => void;
  /** Names the editor for screen readers, since Monaco has no `<label>` to pair with. */
  ariaLabel?: string;
  /**
   * A tab strip for the left of the bar, taking the traffic lights' place.
   *
   * The dots are decoration and the tabs are a control, so when there is more
   * than one view of this frame the control wins the space rather than the two
   * competing for it.
   */
  tabs?: ReactNode;
  /** Extra controls for the right of the bar, between the language and Copy. */
  barExtra?: ReactNode;
  /**
   * A second view sharing the frame — rendered in place of the editor while it
   * is present. Pass nothing (or `null`) when the editor should show.
   *
   * Monaco is **hidden rather than unmounted**, so switching back neither
   * refetches it from the CDN nor re-runs the opening-height estimate.
   */
  altView?: ReactNode;
  /**
   * What Copy puts on the clipboard, when that is not the editor's own value.
   *
   * Exists so one button can follow whichever view is showing rather than a
   * second one appearing inside `altView`.
   */
  copyValue?: string;
}

/**
 * A code block in a macOS-style window: dots, the language and a copy button in
 * the title bar, Monaco underneath.
 *
 * Monaco is fetched from a CDN by `@monaco-editor/react`'s loader rather than
 * bundled, so nothing here reaches the server bundle and the first render shows
 * `loading` until it arrives. In read-only mode that fallback is the plain code
 * block this component replaced, which means an offline or blocked load still
 * shows the content — an edit box has no such graceful form.
 */
export function CodeEditor({
  value,
  language,
  fallbackLanguage,
  readOnly = false,
  onChange,
  ariaLabel,
  tabs,
  barExtra,
  altView,
  copyValue,
}: CodeEditorProps) {
  const { preferences } = useEditorPreferences();
  const lineHeight = lineHeightFor(preferences.fontSize);

  const minHeight = readOnly ? READ_ONLY_MIN_HEIGHT : EDIT_MIN_HEIGHT;

  const [height, setHeight] = useState(() =>
    estimateHeight(value, minHeight, lineHeight),
  );
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const languageId = monacoLanguageId(language, fallbackLanguage);

  useEffect(() => {
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    };
  }, []);

  const handleBeforeMount = useCallback<BeforeMount>((monaco) => {
    defineEditorThemes(monaco);

    // A stashed snippet is usually a fragment, so every validator would mark it
    // up with errors that say nothing about whether the snippet is any good.
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true,
    });
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true,
    });
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: false,
    });
    monaco.languages.css.cssDefaults.setOptions({ validate: false });
  }, []);

  const handleMount = useCallback<OnMount>(
    (editor) => {
      // Monaco needs an explicit height, so the container follows the content
      // up to the cap and lets the editor scroll past it.
      const applyHeight = () => {
        setHeight(
          Math.min(MAX_HEIGHT, Math.max(minHeight, editor.getContentHeight())),
        );
      };

      editor.onDidContentSizeChange(applyHeight);
      applyHeight();
    },
    [minHeight],
  );

  const options = useMemo<NonNullable<EditorProps["options"]>>(
    () => ({
      readOnly,
      domReadOnly: readOnly,
      ariaLabel,
      automaticLayout: true,
      // Monaco measures the font it is told about; setting the family in CSS
      // instead would drift the cursor away from the text it sits in.
      fontFamily: "var(--font-mono), ui-monospace, monospace",
      fontSize: preferences.fontSize,
      lineHeight,
      padding: { top: 12, bottom: 12 },
      minimap: { enabled: preferences.minimap },
      scrollBeyondLastLine: false,
      folding: false,
      glyphMargin: false,
      lineNumbersMinChars: 3,
      lineDecorationsWidth: 8,
      overviewRulerLanes: 0,
      overviewRulerBorder: false,
      renderLineHighlight: readOnly ? "none" : "line",
      occurrencesHighlight: "off",
      selectionHighlight: !readOnly,
      guides: { indentation: !readOnly },
      stickyScroll: { enabled: false },
      contextmenu: !readOnly,
      cursorBlinking: readOnly ? "solid" : "blink",
      wordWrap: preferences.wordWrap ? "on" : "off",
      tabSize: preferences.tabSize,
      // Autocomplete in a snippet stash is noise, and its popups would be
      // clipped by the window frame's `overflow: hidden` anyway.
      quickSuggestions: false,
      suggestOnTriggerCharacters: false,
      wordBasedSuggestions: "off",
      parameterHints: { enabled: false },
      hover: { enabled: "off" },
      scrollbar: {
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10,
        verticalSliderSize: 6,
        horizontalSliderSize: 6,
        useShadows: false,
        // Without this the editor swallows the wheel and the drawer around it
        // cannot be scrolled past.
        alwaysConsumeMouseWheel: false,
      },
    }),
    [
      readOnly,
      ariaLabel,
      lineHeight,
      preferences.fontSize,
      preferences.minimap,
      preferences.tabSize,
      preferences.wordWrap,
    ],
  );

  /** The visible view's text, so one button serves both tabs. */
  const copyable = copyValue ?? value;

  async function copy() {
    try {
      await navigator.clipboard.writeText(copyable);

      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // Denied permission, or an insecure origin — the clipboard is the only
      // place this could have gone, so there is no fallback to offer.
      toast.error("Could not copy to clipboard");
    }
  }

  return (
    <div className="code-editor">
      <div className="code-editor-bar">
        {tabs ?? (
          <span className="code-editor-dots" aria-hidden>
            <span />
            <span />
            <span />
          </span>
        )}

        <span className="code-editor-meta">
          <span className="code-editor-language">
            {languageLabel(languageId)}
          </span>

          {barExtra}

          <button
            type="button"
            className="code-editor-copy"
            onClick={copy}
            disabled={copyable === ""}
            data-copied={copied}
            title={copied ? "Copied" : "Copy"}
            // Matches the visible label rather than naming the code: with a
            // second view sharing the frame, Copy follows whichever is showing.
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
      </div>

      {/* `hidden` rather than a conditional render: unmounting Monaco to show
          the other view would refetch it from the CDN and re-run the opening
          height estimate on every tab switch. */}
      <div hidden={Boolean(altView)}>
        <Editor
          height={height}
          language={languageId}
          value={value}
          theme={preferences.theme}
          beforeMount={handleBeforeMount}
          onMount={handleMount}
          onChange={(next) => onChange?.(next ?? "")}
          options={options}
          loading={
            readOnly ? (
              <pre className="code-editor-fallback">
                <code>{value}</code>
              </pre>
            ) : (
              <p className="code-editor-loading">Loading editor…</p>
            )
          }
        />
      </div>

      {altView}
    </div>
  );
}

/**
 * The height to open at, before Monaco reports what its content actually
 * measures. Guessing from the line count rather than starting at the minimum
 * keeps the block from visibly growing on mount, and sizes the read-only
 * fallback correctly for the load that never finishes.
 */
function estimateHeight(value: string, minHeight: number, lineHeight: number) {
  const lines = value ? value.split("\n").length : 1;

  return Math.min(
    MAX_HEIGHT,
    Math.max(minHeight, lines * lineHeight + VERTICAL_PADDING),
  );
}
