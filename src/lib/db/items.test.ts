import { beforeEach, describe, expect, it, vi } from "vitest";

import { createItem, type CreateItemType } from "@/lib/db/items";
import { prisma } from "@/lib/prisma";
import type { CreateItemInput } from "@/lib/validations/item";

/**
 * `src/lib/prisma.ts` throws at import time without a `DATABASE_URL`, and this
 * test is about the `data` the query builds rather than what a database makes
 * of it — so the client is replaced and the write is only ever inspected.
 */
vi.mock("@/lib/prisma", () => ({
  prisma: { item: { create: vi.fn() } },
}));

const createMock = vi.mocked(prisma.item.create);

const SNIPPET: CreateItemType = {
  id: "type-1",
  slug: "snippets",
  contentType: "TEXT",
};

const NOTE: CreateItemType = { id: "type-2", slug: "notes", contentType: "TEXT" };

const LINK: CreateItemType = { id: "type-3", slug: "links", contentType: "URL" };

const FILE: CreateItemType = {
  id: "type-4",
  slug: "files",
  contentType: "FILE",
};

const UPLOAD = { key: "uploads/user-1/abc.pdf", name: "notes.pdf" };

/** The same object once R2 has confirmed it — the action's `confirmUpload`
 * result, which is where the size comes from now that no byte of the file
 * passes through the app. */
const STORED = { ...UPLOAD, size: 2048 };

/** The parsed payload, which arrives with its optional fields already nulled. */
function input(overrides: Partial<CreateItemInput> = {}): CreateItemInput {
  return {
    typeSlug: "snippets",
    title: "A title",
    description: null,
    content: null,
    url: null,
    language: null,
    file: null,
    tags: [],
    ...overrides,
  };
}

/** Enough of a row for `toDetail`, which every write returns through. */
const ROW = {
  id: "item-1",
  title: "A title",
  itemType: { id: "type-1", slug: "snippets", name: "Snippet", icon: "Code" },
  tags: [{ name: "react" }],
  collections: [{ collection: { id: "col-1", name: "React Patterns" } }],
  createdAt: new Date("2026-08-20T10:00:00.000Z"),
  updatedAt: new Date("2026-08-20T11:00:00.000Z"),
};

/** The `data` the last call would have written. */
function written() {
  return createMock.mock.calls.at(-1)?.[0].data as Record<string, unknown>;
}

beforeEach(() => {
  // `restoreMocks` only restores `vi.spyOn` spies, so this `vi.fn()` would
  // otherwise carry its calls — and `written()` would read the previous test's.
  vi.clearAllMocks();
  createMock.mockResolvedValue(ROW as never);
});

describe("createItem", () => {
  it("writes text content for a text type, and no URL", async () => {
    await createItem("user-1", SNIPPET, input({ content: "const a = 1;" }), null);

    expect(written()).toMatchObject({
      userId: "user-1",
      itemTypeId: "type-1",
      contentType: "TEXT",
      content: "const a = 1;",
      url: null,
    });
  });

  it("writes the URL for a link, and no content", async () => {
    // The form keeps what was typed when the type is switched, so a link can
    // arrive carrying content. Only the field its type owns may be stored: the
    // three are mutually exclusive with no constraint saying so, and
    // `scripts/test-db.ts` asserts an item never holds two.
    await createItem(
      "user-1",
      LINK,
      input({
        typeSlug: "links",
        url: "https://example.com",
        content: "left over",
      }),
      null,
    );

    expect(written()).toMatchObject({
      contentType: "URL",
      url: "https://example.com",
      content: null,
    });
  });

  it("writes the upload for a file type, and neither of the others", async () => {
    await createItem(
      "user-1",
      FILE,
      input({
        typeSlug: "files",
        file: UPLOAD,
        content: "left over",
        url: "https://example.com",
      }),
      STORED,
    );

    // `fileUrl` holds the R2 object key, not a URL — see `createItem`.
    expect(written()).toMatchObject({
      contentType: "FILE",
      fileUrl: STORED.key,
      fileName: STORED.name,
      fileSize: STORED.size,
      content: null,
      url: null,
    });
  });

  it("ignores an upload sent for a type that holds no file", async () => {
    // The form clears it when the type changes, so this only happens to a
    // crafted request — the stored type decides, never the payload.
    await createItem("user-1", SNIPPET, input({ file: UPLOAD }), STORED);

    expect(written()).toMatchObject({
      fileUrl: null,
      fileName: null,
      fileSize: null,
    });
  });

  it("keeps the language on a type that carries one", async () => {
    await createItem("user-1", SNIPPET, input({ language: "typescript" }), null);

    expect(written().language).toBe("typescript");
  });

  it("drops the language on a type that does not", async () => {
    // A note is TEXT too, which is why the gate is on the slug rather than the
    // content type.
    await createItem(
      "user-1",
      NOTE,
      input({ typeSlug: "notes", language: "typescript" }),
      null,
    );

    expect(written().language).toBeNull();
  });

  it("attaches tags scoped to the owner", async () => {
    await createItem("user-1", SNIPPET, input({ tags: ["react", "hooks"] }), null);

    // `connectOrCreate` on the compound unique, so an existing tag of the same
    // name is reused and someone else's identically named tag is not.
    expect(written().tags).toEqual({
      connectOrCreate: [
        {
          where: { userId_name: { userId: "user-1", name: "react" } },
          create: { userId: "user-1", name: "react" },
        },
        {
          where: { userId_name: { userId: "user-1", name: "hooks" } },
          create: { userId: "user-1", name: "hooks" },
        },
      ],
    });
  });

  it("returns the item with its dates as ISO strings", async () => {
    // The drawer reads this shape over JSON from `GET /api/items/[id]`, so a
    // `Date` here would be one type on the server and another in the browser.
    const detail = await createItem("user-1", SNIPPET, input(), null);

    expect(detail).toMatchObject({
      id: "item-1",
      type: ROW.itemType,
      tags: ["react"],
      collections: [{ id: "col-1", name: "React Patterns" }],
      createdAt: "2026-08-20T10:00:00.000Z",
      updatedAt: "2026-08-20T11:00:00.000Z",
    });
  });
});
