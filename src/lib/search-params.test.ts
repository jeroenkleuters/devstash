import { describe, expect, it } from "vitest";

import { firstParam } from "@/lib/search-params";

describe("firstParam", () => {
  it("passes a single value through", () => {
    expect(firstParam("sent")).toBe("sent");
  });

  /** `?status=a&status=b` arrives as an array; every read wants one value. */
  it("takes the first of a repeated parameter", () => {
    expect(firstParam(["sent", "verified"])).toBe("sent");
  });

  it("returns undefined for an absent parameter", () => {
    expect(firstParam(undefined)).toBeUndefined();
  });

  it("returns undefined for an empty array rather than an empty string", () => {
    expect(firstParam([])).toBeUndefined();
  });
});
