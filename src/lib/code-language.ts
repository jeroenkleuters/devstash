/**
 * Resolves an item's free-text `language` hint to a Monaco language id, and
 * that id to the label the code editor's header shows.
 *
 * The hint is whatever was typed into the item form, so "TS", " ts " and
 * "typescript" all have to land on the same id — Monaco silently renders an
 * unrecognised id as plain text, which would look like the highlighting is
 * broken rather than like the hint was spelled differently.
 */

/** The Monaco id used when an item names no language. */
export const DEFAULT_LANGUAGE = "plaintext";

/**
 * Hints that are not already Monaco ids, mapped to the id they mean. Anything
 * absent is passed through, since Monaco knows far more ids than are worth
 * listing here and only the aliases need translating.
 *
 * A `Map` rather than an object literal because the hint is free text: a plain
 * object would answer `"constructor"` with a function off the prototype.
 */
const ALIASES = new Map([
  ["c#", "csharp"],
  ["c++", "cpp"],
  ["cc", "cpp"],
  ["cjs", "javascript"],
  ["cs", "csharp"],
  ["console", "shell"],
  ["fish", "shell"],
  ["golang", "go"],
  ["htm", "html"],
  ["js", "javascript"],
  ["jsx", "javascript"],
  ["kt", "kotlin"],
  ["md", "markdown"],
  ["mjs", "javascript"],
  ["ps1", "powershell"],
  ["pwsh", "powershell"],
  ["py", "python"],
  ["rb", "ruby"],
  ["rs", "rust"],
  ["sh", "shell"],
  ["bash", "shell"],
  ["shellscript", "shell"],
  ["terminal", "shell"],
  ["ts", "typescript"],
  ["tsx", "typescript"],
  ["yml", "yaml"],
  ["zsh", "shell"],
]);

/**
 * Display names for the ids whose capitalisation a generic title-case gets
 * wrong. Everything else is title-cased, which is right for the long tail
 * ("rust" → "Rust") and not worth an entry each.
 */
const LABELS = new Map([
  ["cpp", "C++"],
  ["csharp", "C#"],
  ["css", "CSS"],
  ["graphql", "GraphQL"],
  ["html", "HTML"],
  ["ini", "INI"],
  ["javascript", "JavaScript"],
  ["json", "JSON"],
  ["php", "PHP"],
  ["plaintext", "Plain Text"],
  ["powershell", "PowerShell"],
  ["scss", "SCSS"],
  ["sql", "SQL"],
  ["typescript", "TypeScript"],
  ["xml", "XML"],
  ["yaml", "YAML"],
]);

/**
 * The Monaco language id a hint names.
 *
 * `fallback` is what an item with no hint gets — `shell` for a command, whose
 * whole point is that it is one, and plain text for a snippet, which could be
 * anything.
 */
export function monacoLanguageId(
  hint: string | null | undefined,
  fallback: string = DEFAULT_LANGUAGE,
): string {
  const normalized = hint?.trim().toLowerCase() ?? "";

  if (!normalized) return fallback;

  return ALIASES.get(normalized) ?? normalized;
}

/** What the editor header calls a Monaco language id. */
export function languageLabel(id: string): string {
  return LABELS.get(id) ?? id.charAt(0).toUpperCase() + id.slice(1);
}

/**
 * The language ids the item form offers.
 *
 * Deliberately a curated subset rather than everything Monaco knows: the field
 * is a dropdown someone has to scan, and a list of every grammar shipped with
 * the editor is worse at finding TypeScript than a list of forty. Every target
 * in `ALIASES` is present, so no hint the app already translates can name
 * something the list cannot express.
 *
 * Ordered by label rather than by id, since the label is what is read.
 */
const OFFERED_IDS = [
  "bat",
  "c",
  "clojure",
  "coffeescript",
  "cpp",
  "csharp",
  "css",
  "dart",
  "dockerfile",
  "fsharp",
  "go",
  "graphql",
  "html",
  "ini",
  "java",
  "javascript",
  "json",
  "julia",
  "kotlin",
  "less",
  "lua",
  "markdown",
  "objective-c",
  "perl",
  "php",
  "plaintext",
  "powershell",
  "python",
  "r",
  "ruby",
  "rust",
  "scala",
  "scss",
  "shell",
  "sql",
  "swift",
  "typescript",
  "xml",
  "yaml",
];

export interface LanguageOption {
  /** Stored verbatim in `Item.language`; the empty string means no hint. */
  value: string;
  label: string;
}

/**
 * The options a language dropdown shows, given what the item currently holds.
 *
 * `current` is carried through even when the list does not offer it, because
 * `Item.language` has always been free text: an item stored before this was a
 * dropdown may hold `cobol`, or an alias like `ts`. A select that simply
 * omitted it would report the first option as selected and quietly rewrite the
 * value on the next save — so an unrecognised hint becomes its own option
 * instead, kept exactly as stored.
 */
export function languageOptions(
  current?: string | null,
): readonly LanguageOption[] {
  const options = OFFERED_IDS.map((id) => ({
    value: id,
    label: languageLabel(id),
  })).sort((a, b) => a.label.localeCompare(b.label, "en"));

  const hint = current?.trim() ?? "";

  if (hint !== "" && !options.some((option) => option.value === hint)) {
    options.unshift({ value: hint, label: hint });
  }

  return options;
}
