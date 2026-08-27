import { z } from "zod";

/**
 * How short a query may be before searching is not worth a round trip. Two
 * characters, because a single one matches most of a stash and the result list
 * would be the first `take` rows rather than anything the caller meant.
 */
export const MIN_QUERY_LENGTH = 2;

const MAX_QUERY_LENGTH = 100;

/**
 * The `q` parameter `GET /api/search` takes.
 *
 * Trimmed before the length check, so a query of nothing but whitespace is too
 * short rather than a search for a space.
 */
export const searchQuerySchema = z
  .string()
  .trim()
  .min(MIN_QUERY_LENGTH)
  .max(MAX_QUERY_LENGTH);
