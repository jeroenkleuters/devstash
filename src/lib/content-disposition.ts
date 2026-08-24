/** Whether the browser should show the file or save it. */
export type Disposition = "inline" | "attachment";

/**
 * A `Content-Disposition` header naming a file.
 *
 * The name is given twice: a plain ASCII form every client understands, and the
 * RFC 6266 / RFC 5987 encoding for the names that need more than ASCII. Quotes
 * and backslashes would end the quoted string early and control characters
 * would end the header itself, so neither survives into the ASCII half — the
 * encoded half is what carries the real name.
 *
 * Lives here rather than in the route that uses it because it is the one piece
 * of that handler with rules worth asserting, and `vitest.config.mts` collects
 * nothing under `src/app`.
 */
export function contentDisposition(
  disposition: Disposition,
  name: string,
): string {
  return `${disposition}; filename="${asciiName(name)}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/**
 * The fallback name: printable ASCII only, with everything else standing in as
 * an underscore rather than being dropped, so the name keeps its shape.
 */
function asciiName(name: string): string {
  const ascii = name
    .replace(/["\\]/g, "")
    // Anything outside printable ASCII — control characters, and every
    // non-Latin script, which the encoded half carries instead.
    .replace(/[^\x20-\x7e]/g, "_");

  // A name that was entirely non-ASCII would otherwise leave an empty
  // `filename=""`, which some clients read as "no name" and others as an error.
  return ascii.trim() === "" ? "download" : ascii;
}
