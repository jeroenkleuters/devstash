/**
 * The shapes the AI features share, kept free of any runtime import so a client
 * component can pull a type from here without dragging the OpenAI SDK, Prisma
 * or the Redis client into a browser bundle.
 */

/**
 * What one call spent, as the response itself reported it.
 *
 * `cached` is the share of `input` that was served from the prompt cache. It is
 * **already counted in `input`** — the API reports it as a detail of that
 * number, not in addition to it — which is the arithmetic every price
 * calculation here has to get right. See `costOf`.
 */
export interface AiUsage {
  input: number;
  cached: number;
  output: number;
}

/**
 * Why a call did not produce an answer.
 *
 * A closed set rather than a message, so the features can map each to their own
 * copy and the UI can tell apart the ones worth retrying from the ones that are
 * not. Every one of these is a state the wrapper returns rather than throws.
 */
export type AiFailureReason =
  /** Our own monthly spend cap, or a ledger we could not read. */
  | "budget"
  /** OpenAI's 429 — theirs, not ours. Worth retrying shortly. */
  | "rate-limited"
  /** A connection failure, a 5xx, or a misconfiguration on our side. */
  | "unavailable"
  /** The model answered, but with nothing that fits the schema. */
  | "no-output";

/** A call that produced a validated answer, and what it cost. */
export interface AiSuccess<T> {
  ok: true;
  data: T;
  usage: AiUsage;
}

/** A call that did not, with a message already fit to show. */
export interface AiFailure {
  ok: false;
  reason: AiFailureReason;
  error: string;
}

export type AiResult<T> = AiSuccess<T> | AiFailure;

/**
 * The account's AI settings.
 *
 * A type alias rather than an interface, and that is load-bearing: it goes into
 * a Prisma `Json` column, whose input type wants an index signature, and
 * TypeScript infers one for an alias but never for an interface. The build
 * fails otherwise, in a way that looks unrelated to the cause — the
 * editor-preferences feature records learning this.
 */
export type AiPreferences = {
  enabled: boolean;
};

/**
 * What `saveAiPreferences` answers with. No `data` half: the caller sent the
 * whole set and already holds it, so the only thing left to say is whether it
 * was stored — the same shape `UpdateUploadPreferencesResult` has.
 */
export type UpdateAiPreferencesResult =
  | { success: true }
  | { success: false; error: string };
