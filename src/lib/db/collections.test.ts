import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCollection } from "@/lib/db/collections";
import { prisma } from "@/lib/prisma";

/**
 * `src/lib/prisma.ts` throws at import time without a `DATABASE_URL`, and this
 * test is about the query the module builds rather than what a database makes
 * of it — so the client is replaced and the call is only ever inspected.
 */
vi.mock("@/lib/prisma", () => ({
  prisma: { collection: { findFirst: vi.fn() } },
}));

const findFirstMock = vi.mocked(prisma.collection.findFirst);

/** Enough of a row for `toSummary`, which the read returns through. */
const ROW = {
  id: "collection-1",
  name: "React Patterns",
  description: "Hooks and patterns",
  isFavorite: true,
  updatedAt: new Date("2026-08-20T10:00:00Z"),
  items: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCollection", () => {
  // The rule this read exists to hold: another account's collection has to be
  // indistinguishable from one that was never there.
  it("scopes the lookup to the owner as well as the id", async () => {
    findFirstMock.mockResolvedValue(ROW as never);

    await getCollection("user-1", "collection-1");

    expect(findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "collection-1", userId: "user-1" },
      }),
    );
  });

  it("returns null when nothing matches, rather than throwing", async () => {
    findFirstMock.mockResolvedValue(null);

    await expect(getCollection("user-1", "not-mine")).resolves.toBeNull();
  });

  it("counts the items it holds", async () => {
    findFirstMock.mockResolvedValue({
      ...ROW,
      items: [
        { item: { itemType: TYPE_SNIPPET } },
        { item: { itemType: TYPE_SNIPPET } },
        { item: { itemType: TYPE_LINK } },
      ],
    } as never);

    const collection = await getCollection("user-1", "collection-1");

    expect(collection?.itemCount).toBe(3);
  });

  // `types[0]` is what colours the card, so most-common-first is load-bearing
  // rather than cosmetic.
  it("ranks the types it holds, most common first, deduplicated", async () => {
    findFirstMock.mockResolvedValue({
      ...ROW,
      items: [
        { item: { itemType: TYPE_LINK } },
        { item: { itemType: TYPE_SNIPPET } },
        { item: { itemType: TYPE_SNIPPET } },
      ],
    } as never);

    const collection = await getCollection("user-1", "collection-1");

    expect(collection?.types.map((type) => type.slug)).toEqual([
      "snippets",
      "links",
    ]);
  });
});

const TYPE_SNIPPET = {
  id: "type-1",
  slug: "snippets",
  name: "Snippet",
  icon: "Code",
};

const TYPE_LINK = { id: "type-2", slug: "links", name: "Link", icon: "Link" };
