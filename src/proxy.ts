import { NextResponse } from "next/server";
import NextAuth from "next-auth";

import authConfig from "@/auth.config";

// Initialized from the edge-safe config only — the Prisma adapter cannot run
// here. The JWT session strategy is what makes the session readable without it.
const { auth } = NextAuth(authConfig);

export const proxy = auth((req) => {
  if (req.auth) {
    return;
  }

  // NextAuth's built-in sign-in page; `callbackUrl` returns the visitor to the
  // page they asked for once GitHub sends them back.
  const signInUrl = new URL("/api/auth/signin", req.nextUrl.origin);
  signInUrl.searchParams.set("callbackUrl", req.nextUrl.href);

  return NextResponse.redirect(signInUrl);
});

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*"],
};
