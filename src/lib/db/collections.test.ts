import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  deleteCollection,
  getCollection,
  updateCollection,
} from "@/lib/db/collections";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * `src/lib/prisma.ts` throws at import time without a `DATABASE_URL`, and this
 * test is about the query the module builds rather than what a database makes
 * of it — so the client is replaced and the call is only ever inspected.
 */
vi.mock("@/lib/prisma", () => ({
  prisma: {
    collection: {
      findFirst: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

const findFirstMock = vi.mocked(prisma.collection.findFirst);
const updateMock = vi.mocked(prisma.collection.update);
const deleteManyMock = vi.mocked(prisma.collection.deleteMany);

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

describe("updateCollection", () => {
  const INPUT = { name: "Renamed", description: null };

  // The whole of this write's authorization: without `userId` in the `where`,
  // an id is enough to rename someone else's collection.
  it("scopes the write to the owner as well as the id", async () => {
    updateMock.mockResolvedValue(ROW as never);

    await updateCollection("user-1", "collection-1", INPUT);

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "collection-1", userId: "user-1" },
        data: { name: "Renamed", description: null },
      }),
    );
  });

  // P2025 here means the id names nothing or names another account's row —
  // which the caller has to be able to report as "missing" rather than as a
  // crash.
  it("answers null when Prisma says the row is not there", async () => {
    updateMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("not found", {
        code: "P2025",
        clientVersion: "7",
      }),
    );

    await expect(
      updateCollection("user-1", "not-mine", INPUT),
    ).resolves.toBeNull();
  });

  // Only P2025 means "missing". Swallowing the rest would report a dropped
  // connection as a collection that does not exist.
  it("rethrows any other failure", async () => {
    updateMock.mockRejectedValue(new Error("connection lost"));

    await expect(
      updateCollection("user-1", "collection-1", INPUT),
    ).rejects.toThrow("connection lost");
  });
});

describe("deleteCollection", () => {
  it("scopes the delete to the owner as well as the id", async () => {
    deleteManyMock.mockResolvedValue({ count: 1 } as never);

    await deleteCollection("user-1", "collection-1");

    expect(deleteManyMock).toHaveBeenCalledWith({
      where: { id: "collection-1", userId: "user-1" },
    });
  });

  // `deleteMany` rather than `delete` is what makes a second click read as
  // "already gone" instead of throwing P2025.
  it("answers whether a row actually went", async () => {
    deleteManyMock.mockResolvedValue({ count: 1 } as never);
    await expect(deleteCollection("user-1", "collection-1")).resolves.toBe(true);

    deleteManyMock.mockResolvedValue({ count: 0 } as never);
    await expect(deleteCollection("user-1", "not-mine")).resolves.toBe(false);
  });
});

const TYPE_SNIPPET = {
  id: "type-1",
  slug: "snippets",
  name: "Snippet",
  icon: "Code",
};

const TYPE_LINK = { id: "type-2", slug: "links", name: "Link", icon: "Link" };
