import type { Monaco } from "@monaco-editor/react";

type ThemeData = Parameters<Monaco["editor"]["defineTheme"]>[1];

/**
 * Monaco ships four themes — `vs`, `vs-dark`, `hc-black` and `hc-light` — so
 * anything else has to be handed to it as a token map. These are the two the
 * theme dropdown offers beyond `vs-dark`, which needs no definition.
 *
 * Colours are literal hex because Monaco parses them itself and can read
 * neither the app's `oklch()` values nor the custom properties holding them.
 * Each editor is a self-contained window, so a theme is free to bring its own
 * background rather than matching the `--card` frame around it.
 */
const MONOKAI: ThemeData = {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "", foreground: "f8f8f2", background: "272822" },
    { token: "comment", foreground: "88846f", fontStyle: "italic" },
    { token: "string", foreground: "e6db74" },
    { token: "string.escape", foreground: "ae81ff" },
    { token: "number", foreground: "ae81ff" },
    { token: "regexp", foreground: "e6db74" },
    { token: "keyword", foreground: "f92672" },
    { token: "operator", foreground: "f92672" },
    { token: "delimiter", foreground: "f8f8f2" },
    { token: "type", foreground: "66d9ef", fontStyle: "italic" },
    { token: "type.identifier", foreground: "66d9ef", fontStyle: "italic" },
    { token: "identifier", foreground: "f8f8f2" },
    { token: "function", foreground: "a6e22e" },
    { token: "variable", foreground: "f8f8f2" },
    { token: "variable.predefined", foreground: "66d9ef" },
    { token: "constant", foreground: "ae81ff" },
    { token: "tag", foreground: "f92672" },
    { token: "attribute.name", foreground: "a6e22e" },
    { token: "attribute.value", foreground: "e6db74" },
    { token: "metatag", foreground: "f92672" },
    { token: "annotation", foreground: "a6e22e" },
  ],
  colors: {
    "editor.background": "#272822",
    "editor.foreground": "#f8f8f2",
    "editorLineNumber.foreground": "#90908a",
    "editorLineNumber.activeForeground": "#f8f8f2",
    "editorGutter.background": "#272822",
    "editor.lineHighlightBackground": "#3e3d32",
    "editor.selectionBackground": "#49483e",
    "editorCursor.foreground": "#f8f8f0",
    "editorIndentGuide.background1": "#464741",
    "editorIndentGuide.activeBackground1": "#767771",
    "editorWidget.background": "#3e3d32",
  },
};

const GITHUB_DARK: ThemeData = {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "", foreground: "c9d1d9", background: "0d1117" },
    { token: "comment", foreground: "8b949e" },
    { token: "string", foreground: "a5d6ff" },
    { token: "string.escape", foreground: "79c0ff" },
    { token: "number", foreground: "79c0ff" },
    { token: "regexp", foreground: "7ee787" },
    { token: "keyword", foreground: "ff7b72" },
    { token: "operator", foreground: "ff7b72" },
    { token: "delimiter", foreground: "c9d1d9" },
    { token: "type", foreground: "ffa657" },
    { token: "type.identifier", foreground: "ffa657" },
    { token: "identifier", foreground: "c9d1d9" },
    { token: "function", foreground: "d2a8ff" },
    { token: "variable", foreground: "ffa657" },
    { token: "variable.predefined", foreground: "79c0ff" },
    { token: "constant", foreground: "79c0ff" },
    { token: "tag", foreground: "7ee787" },
    { token: "attribute.name", foreground: "79c0ff" },
    { token: "attribute.value", foreground: "a5d6ff" },
    { token: "metatag", foreground: "ff7b72" },
    { token: "annotation", foreground: "d2a8ff" },
  ],
  colors: {
    "editor.background": "#0d1117",
    "editor.foreground": "#c9d1d9",
    "editorLineNumber.foreground": "#6e7681",
    "editorLineNumber.activeForeground": "#c9d1d9",
    "editorGutter.background": "#0d1117",
    "editor.lineHighlightBackground": "#161b22",
    "editor.selectionBackground": "#264f78",
    "editorCursor.foreground": "#c9d1d9",
    "editorIndentGuide.background1": "#21262d",
    "editorIndentGuide.activeBackground1": "#30363d",
    "editorWidget.background": "#161b22",
  },
};

/** The themes this app defines, keyed by the name the editor asks for. */
const CUSTOM_THEMES = new Map<string, ThemeData>([
  ["monokai", MONOKAI],
  ["github-dark", GITHUB_DARK],
]);

/**
 * Registers the custom themes. Called before mount, so a theme is defined by
 * the time an editor is told to use it — Monaco falls back to `vs` for a name
 * it does not know, which would light a dark page up.
 */
export function defineEditorThemes(monaco: Monaco): void {
  for (const [name, data] of CUSTOM_THEMES) {
    monaco.editor.defineTheme(name, data);
  }
}
