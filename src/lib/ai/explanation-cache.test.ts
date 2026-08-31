import { describe, expect, it } from "vitest";

import {
  explanationSourceHash,
  freshExplanation,
} from "@/lib/ai/explanation-cache";

const CODE = "export function useDebounce() {}";

describe("explanationSourceHash", () => {
  it("is stable for the same code and hint", () => {
    expect(explanationSourceHash(CODE, "typescript")).toBe(
      explanationSourceHash(CODE, "typescript"),
    );
  });

  it("changes when the code changes", () => {
    expect(explanationSourceHash(CODE, "typescript")).not.toBe(
      explanationSourceHash(`${CODE} // and a comment`, "typescript"),
    );
  });

  /**
   * The hint reaches the prompt, so the same code labelled two ways is two
   * questions and the answers must not be interchangeable.
   */
  it("changes when only the language hint changes", () => {
    expect(explanationSourceHash(CODE, "sh")).not.toBe(
      explanationSourceHash(CODE, "powershell"),
    );
  });

  it("treats no hint as its own case, not as an empty one", () => {
    expect(explanationSourceHash(CODE, null)).not.toBe(
      explanationSourceHash(CODE, "typescript"),
    );
  });

  /**
   * `null` and `""` genuinely are the same question — the prompt carries no
   * hint either way — so they agree rather than paying twice for one answer.
   */
  it("treats a null hint and an empty one as the same question", () => {
    expect(explanationSourceHash(CODE, null)).toBe(
      explanationSourceHash(CODE, ""),
    );
  });

  /**
   * The length prefix is what makes this true. Joining the two halves with a
   * separator that can occur inside the content would let these two collide:
   * both flatten to the same characters, and only the prefix tells them apart.
   */
  it("does not confuse a hint with code that begins the same way", () => {
    expect(explanationSourceHash("hello", "sh")).not.toBe(
      explanationSourceHash("shhello", null),
    );
  });

  it("is a hex sha-256 digest, so it fits any column it is stored in", () => {
    expect(explanationSourceHash(CODE, "typescript")).toMatch(
      /^[0-9a-f]{64}$/,
    );
  });
});

describe("freshExplanation", () => {
  const ROW = {
    explanation: "It debounces a value.",
    sourceHash: "abc",
    model: "gpt-5-nano",
  };

  it("returns the explanation when the digest and the model both match", () => {
    expect(freshExplanation(ROW, "abc", "gpt-5-nano")).toBe(ROW.explanation);
  });

  /** An edit changes the digest, so the answer no longer describes the code. */
  it("discards it when the digest has moved on", () => {
    expect(freshExplanation(ROW, "def", "gpt-5-nano")).toBeNull();
  });

  /**
   * Switching models must not keep serving answers the new one never produced
   * — the point of storing the model alongside the digest.
   */
  it("discards it when a different model wrote it", () => {
    expect(freshExplanation(ROW, "abc", "gpt-5-mini")).toBeNull();
  });

  /** No row at all, and the shape Prisma returns for an absent relation. */
  it("takes an absent row either way round", () => {
    expect(freshExplanation(null, "abc", "gpt-5-nano")).toBeNull();
    expect(freshExplanation(undefined, "abc", "gpt-5-nano")).toBeNull();
  });
});
