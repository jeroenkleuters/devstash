import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";

import type { NextAuthConfig } from "next-auth";

/**
 * The edge-safe half of the split config: providers only, no adapter.
 *
 * `src/proxy.ts` runs in the edge runtime, where the Prisma client cannot go,
 * so it initializes NextAuth from this file alone. `src/auth.ts` spreads it and
 * adds the adapter for the Node runtime.
 *
 * GitHub reads `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` from the environment.
 */
export default {
  providers: [
    GitHub,
    // Declared here so both runtimes agree on the provider list, but with a
    // placeholder `authorize`: the real one needs Prisma and bcrypt, neither of
    // which runs on the edge. `src/auth.ts` swaps this entry for the real
    // provider, so signing in through this copy always fails.
    Credentials({ authorize: () => null }),
  ],
} satisfies NextAuthConfig;
