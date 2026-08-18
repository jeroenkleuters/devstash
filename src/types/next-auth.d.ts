import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  /** Returned by `auth()`, `useSession()` and `getSession()`. */
  interface Session {
    user: {
      /** The database id — set from the token in the `session` callback. */
      id: string;
    } & DefaultSession["user"];
  }
}

// Augmenting `next-auth/jwt` — what the Auth.js guide shows — does not merge:
// that module only re-exports `@auth/core/jwt`, so declaring `JWT` against it
// creates a second, unrelated interface and `token.id` stays `unknown` (the
// `Record<string, unknown>` the real `JWT` extends). Target the source module.
declare module "@auth/core/jwt" {
  /** Returned by the `jwt` callback; optional until the sign-in that sets it. */
  interface JWT {
    id?: string;
  }
}
