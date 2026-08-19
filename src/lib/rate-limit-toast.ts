import { toast } from "sonner";

/**
 * How a rejected-for-rate-limiting response is shown to the visitor.
 *
 * It gets a toast where every other auth failure gets the inline `.auth-error`
 * slot, because it is the one failure that is not about what was typed: there
 * is no field to correct and no second attempt to make right now, so leaving
 * the form untouched and saying so above it fits better than an error sitting
 * under the heading as if the address were malformed.
 */

/** Said when a 429 arrives without a body to quote, which should not happen. */
const FALLBACK = "Too many attempts. Try again later.";

/** Long enough to read a wait measured in minutes before it goes. */
const DURATION_MS = 8_000;

export const TOO_MANY_REQUESTS = 429;

/**
 * Raises the toast if `status` is a 429, and reports whether it did, so the
 * caller can leave its own inline error alone for this one case.
 */
export function toastIfRateLimited(status: number, message?: string): boolean {
  if (status !== TOO_MANY_REQUESTS) {
    return false;
  }

  toast.error(message ?? FALLBACK, { duration: DURATION_MS });

  return true;
}

/** The same toast, for the sign-in path, where the limit never becomes a 429. */
export function toastRateLimited(message: string): void {
  toast.error(message, { duration: DURATION_MS });
}
