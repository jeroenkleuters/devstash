/**
 * Copy shared across features, rather than re-declared per component.
 *
 * `UNREACHABLE` is the one that matters: a server action answers a failed
 * *write* with `{ success: false }` but **rejects** when the request itself
 * cannot complete, so every caller needs a `.catch` and something to say. That
 * string is currently declared in seventeen separate files under
 * `src/components/` and `src/lib/`, which is how it came to be worth naming
 * once. Only new callers use this so far — collapsing the other seventeen is a
 * mechanical change of its own and does not belong inside a feature.
 */
export const UNREACHABLE = "Could not reach the server. Try again.";
