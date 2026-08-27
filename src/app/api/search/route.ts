import { NextResponse, type NextRequest } from "next/server";

import { searchCollections } from "@/lib/db/collections";
import { searchItems } from "@/lib/db/items";
import { getCurrentUserId } from "@/lib/db/user";
import { MIN_QUERY_LENGTH, searchQuerySchema } from "@/lib/validations/search";
import type { SearchResults } from "@/types/search";

// Reads the session and one user's rows, so there is nothing here to cache.
export const dynamic = "force-dynamic";

/**
 * How many of each the palette shows, browsing or searching.
 *
 * One number for both, so typing does not appear to *shrink* a list that was
 * already showing everything — and a cap rather than no cap at all, because the
 * palette is a list to scan rather than a page to page through.
 */
const RESULT_LIMIT = 30;

/**
 * The command palette's results.
 *
 * Deliberately outside the proxy's matcher, for the reason
 * `api/items/[id]/route.ts` records: the proxy answers an unauthenticated
 * request with a redirect to the sign-in page, which is right for a navigation
 * and useless to a `fetch` — it would arrive as an opaque 200 of HTML. The
 * check lives here instead, and says 401 so the caller can tell.
 */
export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const parsed = searchQuerySchema.safeParse(
    request.nextUrl.searchParams.get("q") ?? "",
  );

  if (!parsed.success) {
    return NextResponse.json({ error: "That query is too long." }, {
      status: 400,
    });
  }

  // Anything shorter than the floor browses rather than searching, which is
  // what the palette shows on opening and while the first letter is typed. A
  // short query is a request for the list, not a bad request.
  const query =
    parsed.data.length >= MIN_QUERY_LENGTH ? parsed.data : null;

  const [items, collections] = await Promise.all([
    searchItems(userId, query, RESULT_LIMIT),
    searchCollections(userId, query, RESULT_LIMIT),
  ]);

  return NextResponse.json({ items, collections } satisfies SearchResults);
}
