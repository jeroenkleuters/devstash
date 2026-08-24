import { NextResponse } from "next/server";

import { contentDisposition } from "@/lib/content-disposition";
import { getItemFile } from "@/lib/db/items";
import { getCurrentUserId } from "@/lib/db/user";
import { getFile } from "@/lib/r2";

// Reads the session and one user's row, so there is nothing here to cache.
export const dynamic = "force-dynamic";

/**
 * Serves one item's file from R2 through the app.
 *
 * A proxy rather than a link straight at the bucket: the bucket stays private,
 * the request is same-origin so no CORS configuration is involved, and the
 * item's own ownership check is what decides whether the object may be read at
 * all. `?download` asks for it as an attachment; without it the response is
 * inline, which is what the drawer's image preview loads.
 *
 * Outside the proxy's matcher for the same reason as the rest of `/api/items` —
 * a redirect to the sign-in page is useless to a `fetch` or an `<img>`.
 */
export async function GET(
  request: Request,
  { params }: RouteContext<"/api/items/[id]/file">,
) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id } = await params;
  const file = await getItemFile(userId, id);

  // Covers the item not existing, it not being the caller's, and it having no
  // file at all — see `getItemFile`.
  if (!file) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  let stored;

  try {
    stored = await getFile(file.key);
  } catch (error) {
    console.error("file read failed", error);

    return NextResponse.json(
      { error: "Could not read that file. Try again." },
      { status: 502 },
    );
  }

  // The row names an object the bucket no longer holds. Nothing in the app does
  // that, but the two stores are only kept in step by convention.
  if (!stored) {
    return NextResponse.json(
      { error: "That file is no longer stored." },
      { status: 404 },
    );
  }

  const download = new URL(request.url).searchParams.has("download");

  const headers = new Headers({
    "Content-Type": stored.contentType,
    "Content-Disposition": contentDisposition(
      download ? "attachment" : "inline",
      file.name,
    ),
    // The stored type is authoritative, so nothing here should be sniffed into
    // something else.
    "X-Content-Type-Options": "nosniff",
    // An uploaded SVG is script that would otherwise run on this origin if the
    // URL were opened directly. Inside an `<img>` it never executes; this is
    // what covers the navigation.
    "Content-Security-Policy": "default-src 'none'; sandbox",
    // Per-account content behind a session — not something a shared cache may
    // keep.
    "Cache-Control": "private, no-store",
  });

  if (stored.contentLength !== null) {
    headers.set("Content-Length", String(stored.contentLength));
  }

  return new Response(stored.body, { headers });
}
