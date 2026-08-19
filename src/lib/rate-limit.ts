import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

/**
 * Rate limiting for the endpoints that cost something to call: the ones that
 * send mail on demand, registration, changing a password, and sign-in itself.
 *
 * Backed by Upstash Redis over HTTP, so one count is shared by every instance
 * and survives a restart. The in-process counter this replaces kept a separate
 * tally per instance and reset whenever the process did, which made it a brake
 * on casual abuse rather than a limit.
 *
 * Fails open, deliberately: a limiter that refuses sign-ins because Redis is
 * unreachable is worse than one that lets a burst through, so an outage, a
 * timeout and a missing configuration all allow the request.
 */

export interface RateLimitResult {
  /** Whether the request may pass. */
  success: boolean;
  /** How many requests are left in the current window. */
  remaining: number;
  /** Unix ms at which the window frees up; `0` when nothing was counted. */
  reset: number;
}

/** What every fail-open path returns: allowed, and nothing counted. */
const UNLIMITED: RateLimitResult = {
  success: true,
  remaining: Number.POSITIVE_INFINITY,
  reset: 0,
};

/**
 * How long a check may take before the request is let through anyway. Sign-in
 * waits on this, so it is well under the point where a visitor would give up.
 */
const CHECK_TIMEOUT_MS = 2_000;

let redis: Redis | null | undefined;

/** `null` once the configuration has been found missing, so it warns only once. */
function getRedis(): Redis | null {
  if (redis === undefined) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (url && token) {
      redis = new Redis({ url, token });
    } else {
      console.error(
        "Rate limiting is disabled: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are not both set.",
      );
      redis = null;
    }
  }

  return redis;
}

/**
 * One limiter per distinct policy, held for the life of the process. Each keeps
 * an in-memory cache of the identifiers it has already rejected and answers
 * those without a round trip, which only helps if the limiter outlives the
 * request that built it.
 *
 * Worth knowing when testing: a blocked identifier stays blocked in that cache
 * until its window rolls, so deleting the key out of Redis does not unblock it
 * — only waiting or restarting the process does.
 */
const limiters = new Map<string, Ratelimit>();

function getLimiter(limit: number, windowMs: number): Ratelimit | null {
  const client = getRedis();

  if (!client) {
    return null;
  }

  const policy = `${limit}:${windowMs}`;
  const existing = limiters.get(policy);

  if (existing) {
    return existing;
  }

  const limiter = new Ratelimit({
    redis: client,
    // Sliding rather than fixed: a fixed window lets twice the limit through
    // when the requests fall either side of one boundary.
    limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
    // Keys are shared with nothing else, but the default prefix says only that
    // some app is rate limiting; this one says which.
    prefix: "devstash:rl",
    timeout: CHECK_TIMEOUT_MS,
  });

  limiters.set(policy, limiter);

  return limiter;
}

/**
 * The caller a per-IP window is counted against. `x-forwarded-for` is the only
 * thing a request carries here, and a proxy appends to it, so the first entry
 * is the closest thing to an origin — spoofable unless something upstream
 * rewrites the header, which is why no endpoint leans on this dimension alone.
 */
export function callerKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");

  return forwarded?.split(",")[0]?.trim() || "unknown";
}

/** Counts one request against `key` and says whether it may pass. */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const limiter = getLimiter(limit, windowMs);

  if (!limiter) {
    return UNLIMITED;
  }

  try {
    const { success, remaining, reset } = await limiter.limit(key);

    return { success, remaining, reset };
  } catch (cause) {
    console.error("Rate limit check failed; allowing the request", cause);

    return UNLIMITED;
  }
}

/**
 * How long until the request would be accepted, in whole seconds. An endpoint
 * checks several windows and only the spent ones hold it up, so a window that
 * still has room is ignored however far off its own reset is.
 */
export function retryAfterSeconds(...results: RateLimitResult[]): number {
  const spent = results.filter((result) => !result.success);
  const relevant = spent.length > 0 ? spent : results;
  const reset = Math.max(...relevant.map((result) => result.reset));

  return Math.max(1, Math.ceil((reset - Date.now()) / 1000));
}

/**
 * Rounded up to whole minutes.
 *
 * `reset` is when the limiter's current window rolls, not when the budget is
 * certainly back: a sliding window keeps weighting the requests either side of
 * that boundary, so a caller who spent the window well past the limit can still
 * be refused for a while after the time this reports. Retrying then costs one
 * more refusal, which is the usual reading of `Retry-After` anyway — it is the
 * earliest worth trying, not a promise.
 */
export function tooManyAttemptsMessage(...results: RateLimitResult[]): string {
  const minutes = Math.ceil(retryAfterSeconds(...results) / 60);

  return `Too many attempts. Please try again in ${minutes} minute${
    minutes === 1 ? "" : "s"
  }.`;
}

/**
 * The 429 every guarded route answers with. Shaped like the other failures
 * those routes return, so a caller reads `error` the same way whatever went
 * wrong, and reads the status to know it was this.
 */
export function tooManyAttemptsResponse(
  ...results: RateLimitResult[]
): NextResponse {
  return NextResponse.json(
    { success: false, error: tooManyAttemptsMessage(...results) },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds(...results)) },
    },
  );
}
