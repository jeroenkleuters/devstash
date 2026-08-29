import { beforeEach, describe, expect, it, vi } from "vitest";

import { updateItem } from "@/lib/db/items";
import { prisma } from "@/lib/prisma";
import type { UpdateItemInput } from "@/lib/validations/item";

/**
 * Its own file rather than joining `items.test.ts`: that one mocks a client
 * carrying only `item.create`, and widening it would change what every test in
 * it is allowed to reach.
 *
 * The write is only ever inspected — this is about the `data` the query builds,
 * not what a database makes of it.
 */
vi.mock("@/lib/prisma", () => ({
  prisma: { item: { findFirst: vi.fn(), update: vi.fn() } },
}));

const findFirstMock = vi.mocked(prisma.item.findFirst);
const updateMock = vi.mocked(prisma.item.update);

const ROW = {
  itemType: { id: "type-1", slug: "books", name: "Book", icon: "BookOpen" },
  tags: [],
  collections: [],
  createdAt: new Date("2026-08-14T09:30:00Z"),
  updatedAt: new Date("2026-08-14T09:30:00Z"),
};

/** The parsed payload, which arrives with its optional fields already nulled. */
function input(overrides: Partial<UpdateItemInput> = {}): UpdateItemInput {
  return {
    title: "A title",
    description: null,
    content: null,
    url: null,
    language: null,
    author: null,
    tags: [],
    collectionIds: [],
    ...overrides,
  };
}

/** Says what type the stored row is, which is what decides the write. */
function existing(slug: string, contentType: "TEXT" | "URL" | "FILE") {
  findFirstMock.mockResolvedValue({
    contentType,
    itemType: { slug },
    collections: [],
  } as never);
}

/** The `data` the update was built with. */
function written() {
  return updateMock.mock.calls[0]?.[0].data as Record<string, unknown>;
}

beforeEach(() => {
  // `restoreMocks` only restores `vi.spyOn` spies, so these would otherwise
  // carry their call history across tests.
  vi.clearAllMocks();
  updateMock.mockResolvedValue(ROW as never);
});

describe("updateItem", () => {
  it("returns null when the item is missing or belongs to someone else", async () => {
    findFirstMock.mockResolvedValue(null);

    expect(await updateItem("user-1", "item-1", input())).toBeNull();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("writes the link and the author of a book", async () => {
    // A book is `ContentType.FILE` and still owns a `url`, which is why the
    // write reads the slug as well as the content type.
    existing("books", "FILE");

    await updateItem(
      "user-1",
      "item-1",
      input({ url: "https://example.com/book", author: "Ursula K. Le Guin" }),
    );

    expect(written()).toMatchObject({
      url: "https://example.com/book",
      author: "Ursula K. Le Guin",
    });
  });

  it("leaves both alone on a file type that is not a book", async () => {
    // `undefined` rather than null: the column is not this type's to write, so
    // the update does not name it at all.
    existing("images", "FILE");

    await updateItem(
      "user-1",
      "item-1",
      input({ url: "https://example.com", author: "Ted Chiang" }),
    );

    expect(written().url).toBeUndefined();
    expect(written().author).toBeUndefined();
  });

  it("still writes the URL of a link item", async () => {
    existing("links", "URL");

    await updateItem(
      "user-1",
      "item-1",
      input({ url: "https://example.com", content: "left over" }),
    );

    expect(written().url).toBe("https://example.com");
    expect(written().content).toBeUndefined();
  });

  it("scopes the write to the owner", async () => {
    existing("books", "FILE");

    await updateItem("user-1", "item-1", input());

    expect(updateMock.mock.calls[0]?.[0].where).toEqual({
      id: "item-1",
      userId: "user-1",
    });
  });
});
