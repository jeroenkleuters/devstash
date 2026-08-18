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
 * Who verification mail comes from. `onboarding@resend.dev` is Resend's shared
 * sender: it needs no domain setup, but it only delivers to the address that
 * owns the Resend account. Point this at a verified domain before anyone else
 * can register.
 */
export const MAIL_FROM = process.env.RESEND_FROM ?? "DevStash <onboarding@resend.dev>";
