import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCollectionItems } from "@/lib/db/items";
import { prisma } from "@/lib/prisma";

/**
 * `src/lib/prisma.ts` throws at import time without a `DATABASE_URL`, and this
 * test is about the query the module builds rather than what a database makes
 * of it — so the client is replaced and the call is only ever inspected.
 *
 * Its own file rather than joining `items.test.ts`: that one mocks only
 * `item.create`, and widening its client would change what every test there is
 * allowed to reach.
 */
vi.mock("@/lib/prisma", () => ({
  prisma: { item: { findMany: vi.fn() } },
}));

const findManyMock = vi.mocked(prisma.item.findMany);

beforeEach(() => {
  vi.clearAllMocks();
  findManyMock.mockResolvedValue([] as never);
});

describe("getCollectionItems", () => {
  /**
   * The scoping that matters: the items are filtered by owner *independently*
   * of the collection, so being handed a collection id that is not the
   * caller's still cannot read another account's items.
   */
  it("filters on the owner as well as the collection", async () => {
    await getCollectionItems("user-1", "collection-1");

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-1",
          collections: { some: { collectionId: "collection-1" } },
        },
      }),
    );
  });

  // Pinned first, then the date the card itself prints — the same order every
  // other item list uses, so a collection page and a type page agree.
  it("orders pinned first, then by the item's own date", async () => {
    await getCollectionItems("user-1", "collection-1");

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
      }),
    );
  });

  it("returns an empty list for a collection holding nothing", async () => {
    await expect(
      getCollectionItems("user-1", "collection-1"),
    ).resolves.toEqual([]);
  });
});
