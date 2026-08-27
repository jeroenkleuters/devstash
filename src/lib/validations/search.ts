import { z } from "zod";

/**
 * How long a query has to be before it searches rather than browses.
 *
 * Below this the palette lists everything instead — a single character matches
 * most of a stash, and the type-name match in `searchItems` would make "s" mean
 * "every snippet", so the first letter of a word is not yet a search.
 */
export const MIN_QUERY_LENGTH = 2;

const MAX_QUERY_LENGTH = 100;

/**
 * The `q` parameter `GET /api/search` takes.
 *
 * Deliberately has no minimum: a short or absent query is a request to browse,
 * not a bad request, and the route decides which it is. The trim runs first, so
 * a query of nothing but whitespace browses rather than searching for a space.
 */
export const searchQuerySchema = z.string().trim().max(MAX_QUERY_LENGTH);
