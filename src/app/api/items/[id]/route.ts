import { NextResponse } from "next/server";

import { getItemDetail } from "@/lib/db/items";
import { getCurrentUserId } from "@/lib/db/user";

// Reads the session and one user's row, so there is nothing here to cache.
export const dynamic = "force-dynamic";

/**
 * The item detail the drawer fetches when a card is clicked.
 *
 * Deliberately outside the proxy's matcher: the proxy answers an unauthenticated
 * request with a redirect to the sign-in page, which is the right thing for a
 * navigation and useless to a `fetch` — it would arrive as an opaque 200 of
 * HTML. The check lives here instead, and says 401 so the caller can tell.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/items/[id]">,
) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id } = await params;
  const item = await getItemDetail(userId, id);

  // Also what another account's item looks like from here — see `getItemDetail`.
  if (!item) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }

  return NextResponse.json(item);
}
