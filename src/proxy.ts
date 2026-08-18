import { NextResponse } from "next/server";
import NextAuth from "next-auth";

import authConfig, { SIGN_IN_PATH } from "@/auth.config";

// Initialized from the edge-safe config only — the Prisma adapter cannot run
// here. The JWT session strategy is what makes the session readable without it.
const { auth } = NextAuth(authConfig);

export const proxy = auth((req) => {
  if (req.auth) {
    return;
  }

  // The custom sign-in page; `callbackUrl` returns the visitor to the page they
  // asked for once they are through.
  const signInUrl = new URL(SIGN_IN_PATH, req.nextUrl.origin);
  signInUrl.searchParams.set("callbackUrl", req.nextUrl.href);

  return NextResponse.redirect(signInUrl);
});

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*"],
};
