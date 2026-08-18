/**
 * Server-side feature switches, read from the environment. Nothing here is
 * exposed to the client bundle — a flag that changes what the browser renders
 * travels on the response that needed it, not in `NEXT_PUBLIC_`.
 */

/** The values that turn a flag off. Anything else — including unset — is on. */
const FALSY = new Set(["false", "0", "off", "no"]);

/**
 * Whether a new email/password account must confirm its address before it can
 * sign in.
 *
 * Defaults to **on**, so an incomplete environment keeps the requirement rather
 * than silently dropping it; switching it off is explicit
 * (`EMAIL_VERIFICATION_ENABLED=false`). Read per call rather than at module
 * load, so the value is the running environment's and not the build's.
 */
export function isEmailVerificationEnabled(): boolean {
  const value = process.env.EMAIL_VERIFICATION_ENABLED?.trim().toLowerCase();

  return !value || !FALSY.has(value);
}
