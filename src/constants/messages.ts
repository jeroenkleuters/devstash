/**
 * Copy shared across features, rather than re-declared per component.
 *
 * `UNREACHABLE` is the one that matters: a server action answers a failed
 * *write* with `{ success: false }` but **rejects** when the request itself
 * cannot complete, so every caller needs a `.catch` and something to say. It
 * spent a while declared in seventeen separate files under `src/components/`,
 * `src/hooks/` and `src/lib/` — under three different local names, since
 * nothing forced them to agree — and every one of those now imports this.
 *
 * `src/lib/upload-file.ts` was the odd one out: it *exported* its copy, so
 * removing it meant updating importers rather than deleting a local. Nothing
 * exports this string but this file.
 */
export const UNREACHABLE = "Could not reach the server. Try again.";

/**
 * What every server action says when there is no live account behind the
 * request.
 *
 * A session is not the same as a live account: the row can be gone while the
 * JWT still verifies, which is what `getCurrentUser` / `getCurrentUserId`
 * returning null means. It is also the answer to a write that found no row,
 * since a session whose account disappeared and a request naming someone
 * else's row are not worth telling apart.
 *
 * Was declared verbatim in all eight modules under `src/actions/` — the second
 * instance of the pattern `UNREACHABLE` above describes, and a small enough
 * one to have actually collapsed.
 */
export const SIGNED_OUT = "Your session has ended. Sign in again.";
