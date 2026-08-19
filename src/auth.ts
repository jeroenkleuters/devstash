import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import authConfig from "@/auth.config";
import { isEmailVerificationEnabled } from "@/lib/feature-flags";
import { passwordFingerprint } from "@/lib/password-fingerprint";
import { prisma } from "@/lib/prisma";
import { callerKey, rateLimit } from "@/lib/rate-limit";
import { signInSchema } from "@/lib/validations/auth";
import { TOO_MANY_ATTEMPTS_CODE, UNVERIFIED_EMAIL_CODE } from "@/types/auth";

import type { Provider } from "next-auth/providers";

const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

/**
 * Per address, so one account cannot be ground through a password list however
 * many clients the attempts are spread across. The spec keys this window on the
 * caller *and* the address together; counting the address alone is strictly
 * tighter, since every pair sharing it now draws from one budget.
 */
const PER_EMAIL_ATTEMPT_LIMIT = 5;

/** Per caller, so one client cannot stuff credentials across many accounts. */
const PER_IP_ATTEMPT_LIMIT = 30;

/**
 * A 12-round hash of a throwaway random string, compared against when no
 * account matches. Hiding the reason in the response is not enough on its own:
 * bcrypt costs ~220ms, so returning early on an unknown email would make a fast
 * rejection mean "no account here". Comparing anyway levels the two paths.
 */
const ABSENT_PASSWORD_HASH =
  "$2b$12$4DEV0NCxVqIE3s94FcGAIOaMLwpXzYaCVhxl9u2Zm4uNT2YKQ.kn.";

/**
 * The one rejection that is worth naming. It is thrown only after the password
 * has already matched, so it tells the visitor nothing they did not just prove
 * they knew — unlike the generic `null`, which has to stay generic.
 */
class UnverifiedEmailError extends CredentialsSignin {
  code = UNVERIFIED_EMAIL_CODE;
}

/**
 * Thrown once an address or a caller has spent its window. bcrypt at 12 rounds
 * is the only friction a password guess meets otherwise, and ~220ms is no
 * obstacle to a botnet running attempts in parallel.
 */
class TooManyAttemptsError extends CredentialsSignin {
  code = TOO_MANY_ATTEMPTS_CODE;
}

/**
 * The real email/password provider, replacing the placeholder in the edge-safe
 * config. Returning `null` for every failure — unknown email, OAuth-only
 * account, wrong password — keeps the sign-in page from revealing which
 * addresses are registered.
 */
const credentialsProvider = Credentials({
  credentials: {
    email: { label: "Email", type: "email" },
    password: { label: "Password", type: "password" },
  },
  authorize: async (credentials, request) => {
    const parsed = signInSchema.safeParse(credentials);

    if (!parsed.success) {
      return null;
    }

    // Ahead of the comparison rather than levelled with it, unlike the checks
    // below: this one costs no bcrypt on purpose, and answering fast leaks
    // nothing, since the window is keyed on the submitted address and fills up
    // the same whether or not an account is behind it.
    const [byEmail, byIp] = await Promise.all([
      rateLimit(
        `sign-in:email:${parsed.data.email}`,
        PER_EMAIL_ATTEMPT_LIMIT,
        ATTEMPT_WINDOW_MS,
      ),
      rateLimit(
        `sign-in:ip:${callerKey(request)}`,
        PER_IP_ATTEMPT_LIMIT,
        ATTEMPT_WINDOW_MS,
      ),
    ]);

    if (!byEmail.success || !byIp.success) {
      throw new TooManyAttemptsError();
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        passwordHash: true,
        emailVerified: true,
      },
    });

    // Runs even when there is nothing to match — an account created through
    // GitHub has no hash, and an unknown email has no row at all — so that
    // every rejection costs the same.
    const passwordMatches = await compare(
      parsed.data.password,
      user?.passwordHash ?? ABSENT_PASSWORD_HASH,
    );

    if (!user?.passwordHash || !passwordMatches) {
      return null;
    }

    // Deliberately after the comparison above rather than before it: an early
    // return here would skip bcrypt for every unverified account and hand back
    // the timing difference the constant hash exists to remove. The flag gates
    // the throw, not the position — both orderings still cost one bcrypt.
    if (isEmailVerificationEnabled() && !user.emailVerified) {
      throw new UnverifiedEmailError();
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      // Travels onto the token, where `getCurrentUser` compares it against the
      // row on every request — a changed password leaves every session that was
      // opened with the old one carrying a marker that no longer matches.
      pwf: passwordFingerprint(user.passwordHash),
    };
  },
});

/**
 * Providers are configured either as a bare function (`GitHub`) or as an
 * already-called config object (`Credentials(...)`); only the latter carries an
 * `id`, so the swap has to skip the functions.
 */
function withRealCredentials(provider: Provider): Provider {
  if (typeof provider === "function") {
    return provider;
  }

  return provider.id === "credentials" ? credentialsProvider : provider;
}

/**
 * The full config, for the Node runtime: the edge-safe providers plus the
 * Prisma adapter, which persists users and their linked OAuth accounts.
 *
 * Sessions are JWTs rather than adapter-backed database rows, because the proxy
 * has to read the session without the adapter. The Credentials provider also
 * requires this strategy — the adapter never issues a session for it.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: authConfig.providers.map(withRealCredentials),
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  callbacks: {
    // The adapter's user id only reaches the token on sign-in; afterwards the
    // token is the only source, so carry it across and hand it to the session.
    jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
        // Absent for a GitHub sign-in, which is correct: that account has no
        // password, so the row's fingerprint is null and the two still agree.
        token.pwf = user.pwf ?? null;
      }

      return token;
    },
    session({ session, token }) {
      if (token.id) {
        session.user.id = token.id;
      }

      session.user.pwf = token.pwf ?? null;

      return session;
    },
  },
});
