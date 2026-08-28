import { fileExtension } from "@/lib/file-constraints";
import { TITLE_MAX_LENGTH } from "@/lib/validations/item";

/**
 * A readable item title from an uploaded file's original name.
 *
 * `Q3_report-final.PDF` becomes `Q3 report final`: the extension goes, every
 * run of underscores and dashes becomes one space, and whitespace is collapsed
 * and trimmed. The result is a starting point the user is free to rewrite, so
 * it is deliberately literal — nothing is capitalised or reworded.
 *
 * A dotfile keeps its leading dot — `.gitignore` is the whole name rather than
 * a bare extension, and is a better title than nothing. Returns `""` only when
 * the name reduces to nothing at all (`___.png`), which the caller reads as
 * having no title to offer and leaves what it has alone.
 */
export function titleFromFileName(name: string): string {
  const extension = fileExtension(name);

  // Only the last extension: `archive.tar.gz` keeps its `.tar`.
  const stem = extension ? name.slice(0, -extension.length) : name;

  return stem
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, TITLE_MAX_LENGTH)
    .trim();
}
