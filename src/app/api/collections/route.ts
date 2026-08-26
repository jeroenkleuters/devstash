import { NextResponse } from "next/server";

import { getCollectionOptions } from "@/lib/db/collections";
import { getCurrentUserId } from "@/lib/db/user";

// Reads the session and one user's rows, so there is nothing here to cache.
export const dynamic = "force-dynamic";

/**
 * The collections the item forms' picker lists.
 *
 * Deliberately outside the proxy's matcher, for the reason
 * `api/items/[id]/route.ts` records: the proxy answers an unauthenticated
 * request with a redirect to the sign-in page, which is right for a navigation
 * and useless to a `fetch` — it would arrive as an opaque 200 of HTML. The
 * check lives here instead, and says 401 so the caller can tell.
 */
export async function GET() {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  return NextResponse.json(await getCollectionOptions(userId));
}
