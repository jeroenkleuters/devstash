import { NextResponse, type NextRequest } from "next/server";

import { searchCollections } from "@/lib/db/collections";
import { searchItems } from "@/lib/db/items";
import { getCurrentUserId } from "@/lib/db/user";
import { MIN_QUERY_LENGTH, searchQuerySchema } from "@/lib/validations/search";
import type { SearchResults } from "@/types/search";

// Reads the session and one user's rows, so there is nothing here to cache.
export const dynamic = "force-dynamic";

/** How many of each the palette shows. Small on purpose: the list is scanned. */
const ITEM_LIMIT = 10;
const COLLECTION_LIMIT = 5;

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
    return NextResponse.json(
      { error: `Type at least ${MIN_QUERY_LENGTH} characters to search.` },
      { status: 400 },
    );
  }

  const [items, collections] = await Promise.all([
    searchItems(userId, parsed.data, ITEM_LIMIT),
    searchCollections(userId, parsed.data, COLLECTION_LIMIT),
  ]);

  return NextResponse.json({ items, collections } satisfies SearchResults);
}
