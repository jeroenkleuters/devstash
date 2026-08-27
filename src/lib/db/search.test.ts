import { beforeEach, describe, expect, it, vi } from "vitest";

import { searchCollections } from "@/lib/db/collections";
import { searchItems } from "@/lib/db/items";
import { prisma } from "@/lib/prisma";

/**
 * `src/lib/prisma.ts` throws at import time without a `DATABASE_URL`, and these
 * tests are about the query each module builds and the shape it maps to — so
 * the client is replaced and the call is only ever inspected.
 *
 * Its own file rather than joining `items.test.ts` or `collections.test.ts`:
 * search spans both modules, and each of those mocks a client carrying only
 * what its own subject reaches.
 */
vi.mock("@/lib/prisma", () => ({
  prisma: {
    item: { findMany: vi.fn() },
    collection: { findMany: vi.fn() },
  },
}));

const itemFindMany = vi.mocked(prisma.item.findMany);
const collectionFindMany = vi.mocked(prisma.collection.findMany);

const TYPE = { id: "type-1", slug: "snippets", name: "Snippet", icon: "Code" };

function itemRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    title: "useDebounce",
    description: null,
    isFavorite: false,
    isPinned: false,
    updatedAt: new Date("2026-08-20T10:00:00.000Z"),
    itemType: TYPE,
    tags: [{ name: "react" }],
    content: null,
    url: null,
    fileName: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  itemFindMany.mockResolvedValue([] as never);
  collectionFindMany.mockResolvedValue([] as never);
});

describe("searchItems", () => {
  /**
   * The scoping that matters: `userId` is part of the `where`, not a check on
   * the result, so no query can reach another account's items.
   */
  it("scopes the search to the owner", async () => {
    await searchItems("user-1", "react", 10);

    expect(itemFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-1" }),
      }),
    );
  });

  // Every field that carries meaning: the title and description, whichever of
  // content / url / fileName the item's type uses for its payload, its tags,
  // and its type's name — so "command" finds the user's commands.
  it("matches case-insensitively across every meaningful field", async () => {
    await searchItems("user-1", "React", 10);

    const match = { contains: "React", mode: "insensitive" };
    const where = itemFindMany.mock.calls[0]![0]!.where as { OR: unknown[] };

    expect(where.OR).toEqual([
      { title: match },
      { description: match },
      { content: match },
      { url: match },
      { fileName: match },
      { tags: { some: { name: match } } },
      { itemType: { name: match } },
    ]);
  });

  /**
   * A null query browses. The filter has to be *absent* rather than an empty
   * OR: Prisma reads `OR: []` as matching nothing, so the palette would open
   * on a blank list instead of the whole stash.
   */
  it("drops the filter entirely when there is no query", async () => {
    await searchItems("user-1", null, 30);

    const where = itemFindMany.mock.calls[0]![0]!.where;

    expect(where).toEqual({ userId: "user-1" });
    expect("OR" in where!).toBe(false);
    expect(itemFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 30 }));
  });

  // Browsing keeps the ordering a search uses, so the list does not reshuffle
  // as the query crosses the floor.
  it("orders a browse the same way as a search", async () => {
    await searchItems("user-1", null, 30);

    expect(itemFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
      }),
    );
  });

  it("takes the caller's limit, pinned first then most recently updated", async () => {
    await searchItems("user-1", "react", 4);

    expect(itemFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 4,
        orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
      }),
    );
  });

  /**
   * The date leaves as an ISO string because this is serialized to JSON by an
   * API route. `ItemSummary.updatedAt` is a `Date`, so a caller handing this to
   * the drawer has to revive it — a test here is what pins which side is which.
   */
  it("returns the summary with the date as an ISO string", async () => {
    itemFindMany.mockResolvedValue([itemRow()] as never);

    const [item] = await searchItems("user-1", "react", 10);

    expect(item).toMatchObject({
      id: "item-1",
      title: "useDebounce",
      type: TYPE,
      tags: ["react"],
      updatedAt: "2026-08-20T10:00:00.000Z",
    });
  });

  describe("the preview", () => {
    // A snippet's newlines and indentation would render as a long gap in a
    // one-line row, so they collapse to single spaces.
    it("collapses whitespace and trims", async () => {
      itemFindMany.mockResolvedValue([
        itemRow({ content: "  const a = 1;\n\n\tconst b = 2;  " }),
      ] as never);

      const [item] = await searchItems("user-1", "const", 10);

      expect(item!.preview).toBe("const a = 1; const b = 2;");
    });

    it("truncates long content and marks it", async () => {
      itemFindMany.mockResolvedValue([
        itemRow({ content: "x".repeat(500) }),
      ] as never);

      const [item] = await searchItems("user-1", "x", 10);

      expect(item!.preview).toBe(`${"x".repeat(160)}…`);
    });

    // Whichever field the item's type actually uses for its payload: a link
    // has no content, and a file has neither.
    it("falls back from content to url to fileName", async () => {
      itemFindMany.mockResolvedValue([
        itemRow({ url: "https://example.com" }),
        itemRow({ id: "item-2", fileName: "notes.md" }),
      ] as never);

      const items = await searchItems("user-1", "e", 10);

      expect(items[0]!.preview).toBe("https://example.com");
      expect(items[1]!.preview).toBe("notes.md");
    });

    it("is null when the item carries no payload at all", async () => {
      itemFindMany.mockResolvedValue([itemRow()] as never);

      const [item] = await searchItems("user-1", "use", 10);

      expect(item!.preview).toBeNull();
    });

    // Content that is nothing but whitespace collapses to an empty string,
    // which is not a preview — a row would show a blank second line.
    it("is null when the payload collapses to nothing", async () => {
      itemFindMany.mockResolvedValue([
        itemRow({ content: "  \n\t  " }),
      ] as never);

      const [item] = await searchItems("user-1", "use", 10);

      expect(item!.preview).toBeNull();
    });
  });
});

describe("searchCollections", () => {
  it("scopes the search to the owner", async () => {
    await searchCollections("user-1", "react", 5);

    expect(collectionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-1",
          OR: [
            { name: { contains: "react", mode: "insensitive" } },
            { description: { contains: "react", mode: "insensitive" } },
          ],
        },
        take: 5,
      }),
    );
  });

  it("drops the filter entirely when there is no query", async () => {
    await searchCollections("user-1", null, 30);

    const where = collectionFindMany.mock.calls[0]![0]!.where;

    expect(where).toEqual({ userId: "user-1" });
    expect("OR" in where!).toBe(false);
    expect(collectionFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 30 }));
  });

  /**
   * Counts rather than rows: `collectionSelect` pulls every item of every
   * collection just to rank the types it holds, and a result row shows neither.
   */
  it("counts the items instead of selecting them", async () => {
    await searchCollections("user-1", "react", 5);

    expect(collectionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          name: true,
          description: true,
          _count: { select: { items: true } },
        },
      }),
    );
  });

  it("flattens the count onto the result", async () => {
    collectionFindMany.mockResolvedValue([
      {
        id: "collection-1",
        name: "React Patterns",
        description: "Hooks worth keeping",
        _count: { items: 3 },
      },
    ] as never);

    expect(await searchCollections("user-1", "react", 5)).toEqual([
      {
        id: "collection-1",
        name: "React Patterns",
        description: "Hooks worth keeping",
        itemCount: 3,
      },
    ]);
  });
});
