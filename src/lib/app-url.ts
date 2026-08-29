/**
 * The origin absolute links should point at. `APP_URL` wins when set, because a
 * request's own URL is only trustworthy when nothing rewrites it on the way in.
 *
 * Next derives that URL's origin from the `Host` header, which the caller sends
 * — so falling back to it means a `POST /api/auth/forgot-password` carrying a
 * spoofed `Host` mails the real owner of the address a link pointing at the
 * attacker's domain. Clicking it hands over a live reset token. The fallback
 * therefore stays for local work and preview deployments only; in production the
 * variable is required, and its absence fails the request rather than quietly
 * trusting the header.
 */
export function appOrigin(request: Request): string {
  const configured = process.env.APP_URL?.trim();

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "APP_URL must be set in production: emailed links would otherwise be built from the request's Host header.",
    );
  }

  return new URL(request.url).origin;
}

/**
 * The origin Stripe's `success_url`, `cancel_url` and `return_url` are built
 * from. `APP_URL` with **no fallback**, in any environment.
 *
 * Separate from `appOrigin` for two reasons. It takes no `Request`, which a
 * server action does not have; and it must never fall back to the request's own
 * origin, because Next derives that from the caller's `Host` header — a spoofed
 * one would send a paying visitor back to the attacker's domain after checkout.
 * That is the exact attack `appOrigin` was written to prevent, so billing gets
 * the stricter half of the rule and `APP_URL` becomes strictly required.
 */
export function configuredOrigin(): string {
  const configured = process.env.APP_URL?.trim();

  if (!configured) {
    throw new Error(
      "APP_URL must be set: billing return URLs cannot be derived from the request's Host header.",
    );
  }

  return configured.replace(/\/+$/, "");
}
