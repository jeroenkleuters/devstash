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
