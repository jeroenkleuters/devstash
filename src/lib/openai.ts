import OpenAI from "openai";

/**
 * The OpenAI client, created once per process like the other third-party
 * singletons.
 *
 * The key is read **lazily** rather than at module load, for the reason
 * `stripe.ts`, `resend.ts` and `r2.ts` all do it: importing this file must not
 * crash a build, or a request that never talks to OpenAI. Every AI feature is
 * behind a gate, so most requests never reach this at all.
 */
let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!client) {
    const key = process.env.OPENAI_API_KEY?.trim();

    if (!key) {
      throw new Error("OPENAI_API_KEY is not set");
    }

    client = new OpenAI({
      apiKey: key,
      // The SDK default is 10 minutes, which on a serverless host means the
      // platform's own limit fires first and the visitor gets nothing useful.
      // 30s is comfortably above this model's worst realistic latency at the
      // efforts we use, and well under any platform limit.
      timeout: 30_000,
      // The default is 2, and every retry is a second full-price call. The SDK
      // retries on 429 — which, for a limit measured per account, is exactly
      // when retrying is wrong. One covers a transient 500; the caller handles
      // the rest.
      maxRetries: 1,
    });
  }

  return client;
}

/**
 * The one model every AI feature uses, named once.
 *
 * A reasoning model, which is the thing to remember before adding a parameter:
 * `temperature`, `top_p`, `presence_penalty`, `frequency_penalty`, `logprobs`,
 * `logit_bias` and `max_tokens` are **unsupported and error** rather than being
 * silently ignored. Steering is `reasoning.effort` and `text.verbosity` only.
 */
export const AI_MODEL = "gpt-5-nano";
