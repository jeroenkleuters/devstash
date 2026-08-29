import { describe, expect, it } from "vitest";

import {
  FREE_COLLECTION_LIMIT,
  FREE_ITEM_LIMIT,
  collectionLimitMessage,
  collectionUsage,
  itemLimitMessage,
  itemUsage,
} from "@/lib/usage-limits";

describe("the free-tier constants", () => {
  it("are the numbers project overview §8 states", () => {
    expect(FREE_ITEM_LIMIT).toBe(50);
    expect(FREE_COLLECTION_LIMIT).toBe(3);
  });
});

describe("itemUsage", () => {
  it("allows a Pro account at zero, at the limit and far past it", () => {
    expect(itemUsage(true, 0).allowed).toBe(true);
    expect(itemUsage(true, FREE_ITEM_LIMIT).allowed).toBe(true);
    expect(itemUsage(true, FREE_ITEM_LIMIT * 100).allowed).toBe(true);
  });

  it("reports no limit for a Pro account", () => {
    expect(itemUsage(true, 12).limit).toBeNull();
  });

  it("allows a free account below the limit, counting down", () => {
    expect(itemUsage(false, 0)).toEqual({
      allowed: true,
      limit: FREE_ITEM_LIMIT,
      used: 0,
      remaining: FREE_ITEM_LIMIT,
    });

    expect(itemUsage(false, 20).remaining).toBe(FREE_ITEM_LIMIT - 20);
  });

  it("allows a free account one under the limit", () => {
    expect(itemUsage(false, FREE_ITEM_LIMIT - 1)).toMatchObject({
      allowed: true,
      remaining: 1,
    });
  });

  // The `>=` boundary: holding exactly the limit is *at* it, not under it.
  it("refuses a free account at exactly the limit", () => {
    expect(itemUsage(false, FREE_ITEM_LIMIT)).toMatchObject({
      allowed: false,
      remaining: 0,
    });
  });

  // A Pro account that cancels keeps what it created, so this state is real.
  it("refuses a free account over the limit and never reports a negative", () => {
    const over = itemUsage(false, FREE_ITEM_LIMIT + 10);

    expect(over.allowed).toBe(false);
    expect(over.used).toBe(FREE_ITEM_LIMIT + 10);
    expect(over.remaining).toBe(0);
  });
});

describe("collectionUsage", () => {
  it("allows a Pro account past the limit and reports no limit", () => {
    expect(collectionUsage(true, FREE_COLLECTION_LIMIT + 5)).toMatchObject({
      allowed: true,
      limit: null,
    });
  });

  it("measures against its own constant, not the item one", () => {
    expect(collectionUsage(false, 2)).toEqual({
      allowed: true,
      limit: FREE_COLLECTION_LIMIT,
      used: 2,
      remaining: 1,
    });
  });

  it("refuses a free account at exactly the limit", () => {
    expect(collectionUsage(false, FREE_COLLECTION_LIMIT).allowed).toBe(false);
  });

  it("refuses a free account over the limit and never reports a negative", () => {
    const over = collectionUsage(false, FREE_COLLECTION_LIMIT + 4);

    expect(over.allowed).toBe(false);
    expect(over.remaining).toBe(0);
  });
});

describe("the limit messages", () => {
  // Built from the constants, so the copy cannot drift from the rule.
  it("name the number the rule enforces", () => {
    expect(itemLimitMessage()).toContain(String(FREE_ITEM_LIMIT));
    expect(collectionLimitMessage()).toContain(String(FREE_COLLECTION_LIMIT));
  });
});
