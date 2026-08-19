/**
 * A fixed-window counter held in the process, guarding endpoints that cost
 * something to call: the ones that send mail on demand, registration, changing
 * a password, and sign-in itself.
 *
 * Deliberately small: the state lives in memory, so it resets on restart and
 * every serverless instance keeps its own tally. That makes it a brake on
 * casual abuse rather than a real quota. A shared store (Redis is already
 * pencilled into the stack) is what a production limit would need.
 */
interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

/** Bounds the map when a lot of distinct keys pass through. */
function evictExpired(now: number) {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) {
      windows.delete(key);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the window rolls over, for a `Retry-After` header. */
  retryAfter: number;
}

/**
 * The caller a per-IP window is counted against. `x-forwarded-for` is the only
 * thing a request carries here, and a proxy appends to it, so the first entry
 * is the closest thing to an origin — spoofable, which is another reason this
 * is a brake rather than a quota.
 */
export function callerKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");

  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();

  evictExpired(now);

  const window = windows.get(key);

  if (!window || window.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });

    return { allowed: true, retryAfter: 0 };
  }

  window.count += 1;

  return {
    allowed: window.count <= limit,
    retryAfter: Math.ceil((window.resetAt - now) / 1000),
  };
}

