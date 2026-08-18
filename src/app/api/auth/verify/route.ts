import { NextResponse } from "next/server";

import { appOrigin } from "@/lib/app-url";
import { consumeVerificationToken } from "@/lib/email-verification";

// The handler spends a single-use token, so a cached response would be wrong
// for every visitor after the first.
export const dynamic = "force-dynamic";

/**
 * The target of the link in the verification email. It does the write and then
 * hands off to `/verify`, which only reports what happened — keeping the
 * mutation in a route handler and the rendering in a page.
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const outcome = token ? await consumeVerificationToken(token) : "invalid";

  return NextResponse.redirect(
    new URL(`/verify?status=${outcome}`, appOrigin(request)),
  );
}
