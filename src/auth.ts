import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";

import authConfig from "@/auth.config";
import { prisma } from "@/lib/prisma";

/**
 * The full config, for the Node runtime: the edge-safe providers plus the
 * Prisma adapter, which persists users and their linked OAuth accounts.
 *
 * Sessions are JWTs rather than adapter-backed database rows, because the proxy
 * has to read the session without the adapter.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  callbacks: {
    // The adapter's user id only reaches the token on sign-in; afterwards the
    // token is the only source, so carry it across and hand it to the session.
    jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }

      return token;
    },
    session({ session, token }) {
      if (token.id) {
        session.user.id = token.id;
      }

      return session;
    },
  },
});
