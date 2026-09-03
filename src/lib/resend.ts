import { Resend } from "resend";

/**
 * The Resend client, created once per process like the other third-party
 * singletons. The key is read lazily rather than at module load: importing this
 * file must not crash a build or a request that never sends anything.
 */
let client: Resend | null = null;

export function getResend(): Resend {
  if (!client) {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not set");
    }

    client = new Resend(apiKey);
  }

  return client;
}

/**
 * Who verification and password-reset mail comes from.
 *
 * The fallback is a real address on a verified domain rather than Resend's
 * shared `onboarding@resend.dev`, which needs no setup but delivers only to the
 * address owning the Resend account — so an unconfigured environment used to
 * mail one person and silently fail for everyone else. Delivery still depends
 * on this domain staying verified at https://resend.com/domains; if it lapses,
 * `RESEND_FROM` is the override.
 */
export const MAIL_FROM =
  process.env.RESEND_FROM ?? "DevSquirrel <devsquirrel@broadsight.nl>";
