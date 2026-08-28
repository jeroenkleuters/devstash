import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getFavoriteItems,
  getFileItemsByType,
  getItemsByType,
  getRecentItems,
  searchItems,
} from "@/lib/db/items";
import { prisma } from "@/lib/prisma";

/**
 * Every item listing puts pinned items above unpinned ones.
 *
 * That rule lives in five separate `orderBy` arguments rather than in one
 * shared helper, so it is exactly the kind of thing one edit can quietly drop
 * from a single listing. These assert the argument the module builds, not what
 * a database makes of it — the client is replaced and only ever inspected, as
 * `collection-items.test.ts` does (`getCollectionItems` is covered there).
 */
vi.mock("@/lib/prisma", () => ({
  prisma: { item: { findMany: vi.fn() } },
}));

const findManyMock = vi.mocked(prisma.item.findMany);

beforeEach(() => {
  vi.clearAllMocks();
  findManyMock.mockResolvedValue([] as never);
});

function orderByOf(): unknown {
  return findManyMock.mock.calls[0]?.[0]?.orderBy;
}

describe("pinned items lead every listing", () => {
  it("orders the favorites list pinned first, then most recently updated", async () => {
    await getFavoriteItems("user-1");

    expect(orderByOf()).toEqual([{ isPinned: "desc" }, { updatedAt: "desc" }]);
  });

  it("orders the dashboard's recent list pinned first", async () => {
    await getRecentItems("user-1", 10);

    expect(orderByOf()).toEqual([{ isPinned: "desc" }, { updatedAt: "desc" }]);
  });

  it("orders a type page pinned first", async () => {
    await getItemsByType("user-1", "type-1", 1);

    expect(orderByOf()).toEqual([{ isPinned: "desc" }, { updatedAt: "desc" }]);
  });

  // The file list is the one that sorts on `createdAt`, because that is the
  // date its rows print — the pin still leads.
  it("orders the file list pinned first, then by creation date", async () => {
    await getFileItemsByType("user-1", "type-1", 1);

    expect(orderByOf()).toEqual([{ isPinned: "desc" }, { createdAt: "desc" }]);
  });

  it("orders search results pinned first", async () => {
    await searchItems("user-1", "react", 30);

    expect(orderByOf()).toEqual([{ isPinned: "desc" }, { updatedAt: "desc" }]);
  });
});

describe("the favorites list", () => {
  it("reads only the caller's own favorites", async () => {
    await getFavoriteItems("user-1");

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1", isFavorite: true } }),
    );
  });
});
