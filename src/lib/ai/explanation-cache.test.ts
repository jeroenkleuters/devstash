import { describe, expect, it } from "vitest";

import { explanationSourceHash } from "@/lib/ai/explanation-cache";

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
