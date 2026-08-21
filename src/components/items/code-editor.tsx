"use client";

import Editor, {
  type BeforeMount,
  type EditorProps,
  type Monaco,
  type OnMount,
} from "@monaco-editor/react";
import { Check, Copy } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { languageLabel, monacoLanguageId } from "@/lib/code-language";

/** Tallest the editor grows before it starts scrolling instead. */
const MAX_HEIGHT = 400;
/** A read-only block shrinks to its content; a two-line command stays short. */
const READ_ONLY_MIN_HEIGHT = 72;
/** An edit box opens with room to type into, even for an empty item. */
const EDIT_MIN_HEIGHT = 220;

const LINE_HEIGHT = 21;
const VERTICAL_PADDING = 24;

const THEME = "devstash-dark";

/**
 * The app's dark tokens as literal hex — Monaco parses these itself, so it can
 * read neither the `oklch()` values nor the custom properties they sit in.
 * Kept in step with the `.dark` block in `globals.css` by hand.
 */
const DEVSTASH_DARK: Parameters<Monaco["editor"]["defineTheme"]>[1] = {
  base: "vs-dark",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#171717", // --card
    "editor.foreground": "#fafafa", // --foreground
    "editorLineNumber.foreground": "#525252",
    "editorLineNumber.activeForeground": "#a1a1a1", // --muted-foreground
    "editorGutter.background": "#171717",
    "editor.lineHighlightBorder": "#00000000",
    "editor.lineHighlightBackground": "#ffffff08",
    "editor.selectionBackground": "#ffffff26",
    "editor.inactiveSelectionBackground": "#ffffff14",
    "editorCursor.foreground": "#fafafa",
    "editorIndentGuide.background1": "#ffffff14",
    "editorIndentGuide.activeBackground1": "#ffffff2e",
    "editorWidget.background": "#262626", // --muted
    "editorWidget.border": "#ffffff1a", // --border
    // The scrollbar is Monaco's own DOM; these colour it, and `globals.css`
    // rounds the slider into a pill.
    "scrollbar.shadow": "#00000000",
    "scrollbarSlider.background": "#ffffff1f",
    "scrollbarSlider.hoverBackground": "#ffffff33",
    "scrollbarSlider.activeBackground": "#ffffff4d",
  },
};

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
}: CodeEditorProps) {
  const minHeight = readOnly ? READ_ONLY_MIN_HEIGHT : EDIT_MIN_HEIGHT;

  const [height, setHeight] = useState(() => estimateHeight(value, minHeight));
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const languageId = monacoLanguageId(language, fallbackLanguage);

  useEffect(() => {
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    };
  }, []);

  const handleBeforeMount = useCallback<BeforeMount>((monaco) => {
    monaco.editor.defineTheme(THEME, DEVSTASH_DARK);

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
      fontSize: 13,
      lineHeight: LINE_HEIGHT,
      padding: { top: 12, bottom: 12 },
      minimap: { enabled: false },
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
      wordWrap: "off",
      tabSize: 2,
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
    [readOnly, ariaLabel],
  );

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

  return (
    <div className="code-editor">
      <div className="code-editor-bar">
        <span className="code-editor-dots" aria-hidden>
          <span />
          <span />
          <span />
        </span>

        <span className="code-editor-meta">
          <span className="code-editor-language">
            {languageLabel(languageId)}
          </span>

          <button
            type="button"
            className="code-editor-copy"
            onClick={copy}
            disabled={value === ""}
            data-copied={copied}
            title={copied ? "Copied" : "Copy"}
            aria-label={copied ? "Copied" : "Copy code"}
          >
            {copied ? (
              <Check size={14} aria-hidden />
            ) : (
              <Copy size={14} aria-hidden />
            )}
          </button>
        </span>
      </div>

      <Editor
        height={height}
        language={languageId}
        value={value}
        theme={THEME}
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
  );
}

/**
 * The height to open at, before Monaco reports what its content actually
 * measures. Guessing from the line count rather than starting at the minimum
 * keeps the block from visibly growing on mount, and sizes the read-only
 * fallback correctly for the load that never finishes.
 */
function estimateHeight(value: string, minHeight: number) {
  const lines = value ? value.split("\n").length : 1;

  return Math.min(
    MAX_HEIGHT,
    Math.max(minHeight, lines * LINE_HEIGHT + VERTICAL_PADDING),
  );
}
