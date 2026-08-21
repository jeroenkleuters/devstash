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
