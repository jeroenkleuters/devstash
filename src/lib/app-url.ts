/**
 * The origin absolute links should point at. `APP_URL` wins when set, because
 * a request's own URL is only trustworthy when nothing rewrites it on the way
 * in; falling back to it keeps preview deployments working unconfigured.
 */
export function appOrigin(request: Request): string {
  const configured = process.env.APP_URL?.trim();

  return configured ? configured.replace(/\/+$/, "") : new URL(request.url).origin;
}
