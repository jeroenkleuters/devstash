import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createItem,
  deleteItem,
  setItemFavorite,
  setItemPinned,
  updateItem,
} from "@/actions/items";
import { ownsAllCollections } from "@/lib/db/collections";
import { getItemTypeBySlug } from "@/lib/db/item-types";
import {
  createItem as createItemRow,
  deleteItem as deleteItemRow,
  getItemFile,
  setItemFavorite as setItemFavoriteRow,
  setItemPinned as setItemPinnedRow,
  updateItem as updateItemRow,
} from "@/lib/db/items";
import { getCurrentUserId } from "@/lib/db/user";
import { deleteFile, headFile } from "@/lib/r2";
import type { ItemDetail } from "@/types/item";

/**
 * These modules import `@/lib/prisma`, which throws at import time without a
 * `DATABASE_URL`. Replacing them keeps the test offline and leaves the action's
 * own job — session, validation, and turning a result into a response — as the
 * only thing under test.
 */
vi.mock("@/lib/db/items", () => ({
  createItem: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
  getItemFile: vi.fn(),
  setItemFavorite: vi.fn(),
  setItemPinned: vi.fn(),
}));
vi.mock("@/lib/db/item-types", () => ({ getItemTypeBySlug: vi.fn() }));
vi.mock("@/lib/db/collections", () => ({ ownsAllCollections: vi.fn() }));
vi.mock("@/lib/db/user", () => ({ getCurrentUserId: vi.fn() }));

/**
 * Stands in for R2 as well, so nothing here reaches the network. `ownsObjectKey`
 * is kept real: it is the rule the delete path leans on, and a mocked one would
 * make those assertions say nothing.
 */
vi.mock("@/lib/r2", async () => {
  const actual = await vi.importActual<typeof import("@/lib/r2")>("@/lib/r2");

  return {
    ownsObjectKey: actual.ownsObjectKey,
    deleteFile: vi.fn(),
    headFile: vi.fn(),
  };
});

const createItemRowMock = vi.mocked(createItemRow);
const updateItemRowMock = vi.mocked(updateItemRow);
const deleteItemRowMock = vi.mocked(deleteItemRow);
const getItemFileMock = vi.mocked(getItemFile);
const setItemFavoriteRowMock = vi.mocked(setItemFavoriteRow);
const setItemPinnedRowMock = vi.mocked(setItemPinnedRow);
const deleteFileMock = vi.mocked(deleteFile);
const headFileMock = vi.mocked(headFile);
const getItemTypeBySlugMock = vi.mocked(getItemTypeBySlug);
const ownsAllCollectionsMock = vi.mocked(ownsAllCollections);
const getCurrentUserIdMock = vi.mocked(getCurrentUserId);

const SNIPPET_TYPE = {
  id: "type-1",
  slug: "snippets",
  name: "Snippet",
  icon: "Code",
};

const DETAIL = {
  id: "item-1",
  title: "Saved",
  tags: ["react"],
} as unknown as ItemDetail;

function payload(overrides: Record<string, unknown> = {}) {
  return {
    title: "A title",
    description: "",
    content: "",
    url: "",
    language: "",
    author: "",
    tags: [] as string[],
    ...overrides,
  };
}

beforeEach(() => {
  // `restoreMocks` in vitest.config.mts only restores `vi.spyOn` spies, so the
  // call history of these `vi.fn()`s would otherwise carry across tests and the
  // "not called" assertions would read the previous test's call.
  vi.clearAllMocks();

  getCurrentUserIdMock.mockResolvedValue("user-1");
  getItemTypeBySlugMock.mockResolvedValue(SNIPPET_TYPE);
  ownsAllCollectionsMock.mockResolvedValue(true);
  createItemRowMock.mockResolvedValue(DETAIL);
  updateItemRowMock.mockResolvedValue(DETAIL);
  deleteItemRowMock.mockResolvedValue(true);
  setItemFavoriteRowMock.mockResolvedValue(true);
  setItemPinnedRowMock.mockResolvedValue(true);
  // Most items carry no file at all.
  getItemFileMock.mockResolvedValue(null);
  deleteFileMock.mockResolvedValue(undefined);
});

describe("createItem", () => {
  /** The dialog's payload: the edit fields plus the type it is created as. */
  function createPayload(overrides: Record<string, unknown> = {}) {
    return { typeSlug: "snippets", ...payload(overrides) };
  }

  /** Resolves the File type, for the cases that carry an upload. */
  function asFileType() {
    getItemTypeBySlugMock.mockResolvedValue({
      id: "type-5",
      slug: "files",
      name: "File",
      icon: "File",
    });
  }

  it("creates the item as the resolved type", async () => {
    const result = await createItem(createPayload({ title: "  Saved  " }));

    expect(result).toEqual({ success: true, data: DETAIL });

    // The id comes from the row the slug resolved to, and the content kind from
    // the constant — never from the request. The payload arrives parsed, so the
    // trim and the null-normalization have already happened.
    expect(createItemRowMock).toHaveBeenCalledWith(
      "user-1",
      { id: "type-1", slug: "snippets", contentType: "TEXT" },
      expect.objectContaining({ title: "Saved", description: null }),
      // No file to confirm, so nothing is attached and R2 is never asked.
      null,
    );
    expect(headFileMock).not.toHaveBeenCalled();
  });

  it("refuses when the session has no live account", async () => {
    getCurrentUserIdMock.mockResolvedValue(null);

    const result = await createItem(createPayload());

    expect(result).toEqual({
      success: false,
      error: "Your session has ended. Sign in again.",
    });
    expect(createItemRowMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid payload without touching the database", async () => {
    const result = await createItem(createPayload({ title: "" }));

    expect(result).toEqual({ success: false, error: "Title is required." });
    expect(getItemTypeBySlugMock).not.toHaveBeenCalled();
    expect(createItemRowMock).not.toHaveBeenCalled();
  });

  it("refuses a slug that names no type", async () => {
    const result = await createItem(createPayload({ typeSlug: "banana" }));

    expect(result).toEqual({ success: false, error: "Choose an item type." });
    expect(getItemTypeBySlugMock).not.toHaveBeenCalled();
    expect(createItemRowMock).not.toHaveBeenCalled();
  });

  it("refuses an upload from another account's prefix", async () => {
    // The key is the one thing in the payload naming something outside the row
    // being written, so it is checked against the caller's own prefix.
    const result = await createItem(
      createPayload({
        typeSlug: "files",
        file: { key: "uploads/user-2/secret.pdf", name: "s.pdf" },
      }),
    );

    expect(result).toEqual({
      success: false,
      error: "That file does not belong to this account.",
    });
    expect(createItemRowMock).not.toHaveBeenCalled();
  });

  it("creates a file item from the caller's own upload", async () => {
    asFileType();
    headFileMock.mockResolvedValue({ size: 4096 });

    const file = { key: "uploads/user-1/abc.pdf", name: "notes.pdf" };
    const result = await createItem(createPayload({ typeSlug: "files", file }));

    expect(result).toEqual({ success: true, data: DETAIL });
    expect(headFileMock).toHaveBeenCalledWith(file.key);

    // The size stored is R2's, not the browser's: the upload went straight to
    // the bucket, so this is the only count anyone can vouch for.
    expect(createItemRowMock).toHaveBeenCalledWith(
      "user-1",
      { id: "type-5", slug: "files", contentType: "FILE" },
      expect.objectContaining({ file }),
      { key: file.key, name: file.name, size: 4096 },
    );
  });

  it("refuses a key the bucket holds nothing under", async () => {
    // Never uploaded, or uploaded and already gone. Either way there is no file
    // to attach, and a row naming a missing object is worse than no row.
    asFileType();
    headFileMock.mockResolvedValue(null);

    const result = await createItem(
      createPayload({
        typeSlug: "files",
        file: { key: "uploads/user-1/ghost.pdf", name: "ghost.pdf" },
      }),
    );

    expect(result).toEqual({
      success: false,
      error: "That upload is no longer there. Try choosing it again.",
    });
    expect(createItemRowMock).not.toHaveBeenCalled();
  });

  it("refuses an object larger than the cap", async () => {
    // Only reachable if the signed `content-length` did not hold, which is the
    // reason this check exists at all: the cap should not rest on one mechanism.
    asFileType();
    headFileMock.mockResolvedValue({ size: 200 * 1024 * 1024 });

    const result = await createItem(
      createPayload({
        typeSlug: "files",
        file: { key: "uploads/user-1/huge.pdf", name: "huge.pdf" },
      }),
    );

    expect(result).toEqual({
      success: false,
      error: "That file is larger than 100 MB.",
    });
    expect(createItemRowMock).not.toHaveBeenCalled();
  });

  it("stores no size for an object R2 reports none for", async () => {
    // `fileSize` is nullable, and a size we cannot vouch for is better absent
    // than guessed.
    asFileType();
    headFileMock.mockResolvedValue({ size: null });

    const file = { key: "uploads/user-1/abc.pdf", name: "notes.pdf" };
    const result = await createItem(createPayload({ typeSlug: "files", file }));

    expect(result.success).toBe(true);
    expect(createItemRowMock).toHaveBeenCalledWith(
      "user-1",
      expect.anything(),
      expect.anything(),
      { key: file.key, name: file.name, size: null },
    );
  });

  it("reports a type with no row behind it", async () => {
    // An un-seeded database: the slug is one the dialog offers, but nothing
    // answers to it.
    getItemTypeBySlugMock.mockResolvedValue(null);

    const result = await createItem(createPayload());

    expect(result).toEqual({
      success: false,
      error: "That item type is not available.",
    });
    expect(createItemRowMock).not.toHaveBeenCalled();
  });

  it("turns a failed write into a message rather than throwing", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    createItemRowMock.mockRejectedValue(new Error("connection lost"));

    const result = await createItem(createPayload());

    expect(result).toEqual({
      success: false,
      error: "Could not create this item. Try again.",
    });
    expect(logged).toHaveBeenCalled();
  });
});

describe("updateItem", () => {
  it("saves and returns the stored item", async () => {
    const result = await updateItem("item-1", payload({ title: "  Saved  " }));

    expect(result).toEqual({ success: true, data: DETAIL });

    // The action hands the query the *parsed* payload, so the trim and the
    // null-normalization have already happened by the time it is written.
    expect(updateItemRowMock).toHaveBeenCalledWith(
      "user-1",
      "item-1",
      expect.objectContaining({ title: "Saved", description: null }),
    );
  });

  it("refuses when the session has no live account", async () => {
    // A JWT can still verify against a row that is gone, which is the one case
    // the proxy cannot see.
    getCurrentUserIdMock.mockResolvedValue(null);

    const result = await updateItem("item-1", payload());

    expect(result).toEqual({
      success: false,
      error: "Your session has ended. Sign in again.",
    });
    expect(updateItemRowMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid payload without touching the database", async () => {
    const result = await updateItem("item-1", payload({ title: "" }));

    expect(result).toEqual({ success: false, error: "Title is required." });
    expect(updateItemRowMock).not.toHaveBeenCalled();
  });

  it("validates the payload even though the form already did", async () => {
    // The client runs the same schema for its messages, but that copy is the
    // caller's to skip — this one is the rule.
    const result = await updateItem("item-1", { title: "Fine" });

    expect(result.success).toBe(false);
    expect(updateItemRowMock).not.toHaveBeenCalled();
  });

  it("reports an item that is missing or owned by someone else", async () => {
    // The query conflates the two deliberately, so an id nobody may see is
    // never confirmed to exist.
    updateItemRowMock.mockResolvedValue(null);

    const result = await updateItem("item-1", payload());

    expect(result).toEqual({
      success: false,
      error: "That item no longer exists.",
    });
  });

  it("turns a failed write into a message rather than throwing", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    updateItemRowMock.mockRejectedValue(new Error("connection lost"));

    const result = await updateItem("item-1", payload());

    expect(result).toEqual({
      success: false,
      error: "Could not save this item. Try again.",
    });
    expect(logged).toHaveBeenCalled();
  });
});

describe("deleteItem", () => {
  it("deletes the item for the signed-in account", async () => {
    const result = await deleteItem("item-1");

    expect(result).toEqual({ success: true });

    // The action never takes a user id from its caller: the one it scopes the
    // delete to comes from the session.
    expect(deleteItemRowMock).toHaveBeenCalledWith("user-1", "item-1");
  });

  it("refuses when the session has no live account", async () => {
    getCurrentUserIdMock.mockResolvedValue(null);

    const result = await deleteItem("item-1");

    expect(result).toEqual({
      success: false,
      error: "Your session has ended. Sign in again.",
    });
    expect(deleteItemRowMock).not.toHaveBeenCalled();
  });

  it("reports an item that is missing or owned by someone else", async () => {
    // The query deletes nothing in both cases and says so with `false`, so the
    // action cannot confirm that an id it may not touch exists.
    deleteItemRowMock.mockResolvedValue(false);

    const result = await deleteItem("item-1");

    expect(result).toEqual({
      success: false,
      error: "That item no longer exists.",
    });
  });

  it("turns a failed delete into a message rather than throwing", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    deleteItemRowMock.mockRejectedValue(new Error("connection lost"));

    const result = await deleteItem("item-1");

    expect(result).toEqual({
      success: false,
      error: "Could not delete this item. Try again.",
    });
    expect(logged).toHaveBeenCalled();
  });

  it("removes the stored file before the row", async () => {
    getItemFileMock.mockResolvedValue({
      key: "uploads/user-1/abc.pdf",
      name: "notes.pdf",
      size: 12,
    });

    const order: string[] = [];
    deleteFileMock.mockImplementation(async () => void order.push("file"));
    deleteItemRowMock.mockImplementation(async () => {
      order.push("row");
      return true;
    });

    const result = await deleteItem("item-1");

    expect(result).toEqual({ success: true });
    expect(order).toEqual(["file", "row"]);
  });

  it("keeps the item when its file cannot be deleted", async () => {
    // The whole point of the ordering: the alternative leaves an object in the
    // bucket that nothing points at and nothing can find again.
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    getItemFileMock.mockResolvedValue({
      key: "uploads/user-1/abc.pdf",
      name: "notes.pdf",
      size: 12,
    });
    deleteFileMock.mockRejectedValue(new Error("R2 unreachable"));

    const result = await deleteItem("item-1");

    expect(result).toEqual({
      success: false,
      error:
        "Could not delete this item's file, so the item was kept. Try again.",
    });
    expect(deleteItemRowMock).not.toHaveBeenCalled();
    expect(logged).toHaveBeenCalled();
  });

  it("refuses to delete an object outside the caller's own prefix", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    getItemFileMock.mockResolvedValue({
      key: "uploads/user-2/abc.pdf",
      name: "notes.pdf",
      size: 12,
    });

    const result = await deleteItem("item-1");

    expect(result.success).toBe(false);
    expect(deleteFileMock).not.toHaveBeenCalled();
    expect(deleteItemRowMock).not.toHaveBeenCalled();
    expect(logged).toHaveBeenCalled();
  });

  it("does not reach for storage when the item carries no file", async () => {
    const result = await deleteItem("item-1");

    expect(result).toEqual({ success: true });
    expect(deleteFileMock).not.toHaveBeenCalled();
  });
});

describe("setItemFavorite", () => {
  it("refuses a session whose account is gone", async () => {
    getCurrentUserIdMock.mockResolvedValue(null);

    const result = await setItemFavorite("item-1", true);

    expect(result).toEqual({
      success: false,
      error: "Your session has ended. Sign in again.",
    });
    expect(setItemFavoriteRowMock).not.toHaveBeenCalled();
  });

  it("writes as the session's user, never one the caller could name", async () => {
    await setItemFavorite("item-1", true);

    expect(setItemFavoriteRowMock).toHaveBeenCalledWith("user-1", "item-1", true);
  });

  /**
   * The value asked for is passed through rather than a flip of what is stored,
   * so two clicks racing settle on one answer instead of opposite ones.
   */
  it("passes the requested value through, both ways", async () => {
    await setItemFavorite("item-1", false);

    expect(setItemFavoriteRowMock).toHaveBeenCalledWith(
      "user-1",
      "item-1",
      false,
    );
  });

  it("reports an item that is missing or not the caller's", async () => {
    setItemFavoriteRowMock.mockResolvedValue(false);

    const result = await setItemFavorite("not-mine", true);

    expect(result).toEqual({
      success: false,
      error: "That item no longer exists.",
    });
  });

  it("answers success with no data half", async () => {
    await expect(setItemFavorite("item-1", true)).resolves.toEqual({
      success: true,
    });
  });

  it("turns a rejected write into a message rather than a throw", async () => {
    setItemFavoriteRowMock.mockRejectedValue(new Error("connection lost"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await setItemFavorite("item-1", true);

    expect(result).toEqual({
      success: false,
      error: "Could not change this item's favorite. Try again.",
    });
  });

  /** The two flags share one helper, so this is what keeps them separate. */
  it("does not touch the pin", async () => {
    await setItemFavorite("item-1", true);

    expect(setItemPinnedRowMock).not.toHaveBeenCalled();
  });
});

describe("setItemPinned", () => {
  it("refuses a session whose account is gone", async () => {
    getCurrentUserIdMock.mockResolvedValue(null);

    const result = await setItemPinned("item-1", true);

    expect(result).toEqual({
      success: false,
      error: "Your session has ended. Sign in again.",
    });
    expect(setItemPinnedRowMock).not.toHaveBeenCalled();
  });

  it("writes as the session's user", async () => {
    await setItemPinned("item-1", false);

    expect(setItemPinnedRowMock).toHaveBeenCalledWith("user-1", "item-1", false);
    expect(setItemFavoriteRowMock).not.toHaveBeenCalled();
  });

  it("reports an item that is missing or not the caller's", async () => {
    setItemPinnedRowMock.mockResolvedValue(false);

    await expect(setItemPinned("not-mine", true)).resolves.toEqual({
      success: false,
      error: "That item no longer exists.",
    });
  });

  /** Its own message, so a failure names the flag that did not change. */
  it("turns a rejected write into its own message", async () => {
    setItemPinnedRowMock.mockRejectedValue(new Error("connection lost"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await setItemPinned("item-1", true);

    expect(result).toEqual({
      success: false,
      error: "Could not change this item's pin. Try again.",
    });
  });
});
