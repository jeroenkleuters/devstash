import { beforeEach, describe, expect, it, vi } from "vitest";

import { createItem, deleteItem, updateItem } from "@/actions/items";
import { getItemTypeBySlug } from "@/lib/db/item-types";
import {
  createItem as createItemRow,
  deleteItem as deleteItemRow,
  getItemFile,
  updateItem as updateItemRow,
} from "@/lib/db/items";
import { getCurrentUserId } from "@/lib/db/user";
import { deleteFile } from "@/lib/r2";
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
}));
vi.mock("@/lib/db/item-types", () => ({ getItemTypeBySlug: vi.fn() }));
vi.mock("@/lib/db/user", () => ({ getCurrentUserId: vi.fn() }));

/**
 * Stands in for R2 as well, so nothing here reaches the network. `ownsObjectKey`
 * is kept real: it is the rule the delete path leans on, and a mocked one would
 * make those assertions say nothing.
 */
vi.mock("@/lib/r2", async () => {
  const actual = await vi.importActual<typeof import("@/lib/r2")>("@/lib/r2");

  return { ownsObjectKey: actual.ownsObjectKey, deleteFile: vi.fn() };
});

const createItemRowMock = vi.mocked(createItemRow);
const updateItemRowMock = vi.mocked(updateItemRow);
const deleteItemRowMock = vi.mocked(deleteItemRow);
const getItemFileMock = vi.mocked(getItemFile);
const deleteFileMock = vi.mocked(deleteFile);
const getItemTypeBySlugMock = vi.mocked(getItemTypeBySlug);
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
  createItemRowMock.mockResolvedValue(DETAIL);
  updateItemRowMock.mockResolvedValue(DETAIL);
  deleteItemRowMock.mockResolvedValue(true);
  // Most items carry no file at all.
  getItemFileMock.mockResolvedValue(null);
  deleteFileMock.mockResolvedValue(undefined);
});

describe("createItem", () => {
  /** The dialog's payload: the edit fields plus the type it is created as. */
  function createPayload(overrides: Record<string, unknown> = {}) {
    return { typeSlug: "snippets", ...payload(overrides) };
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
    );
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
        file: { key: "uploads/user-2/secret.pdf", name: "s.pdf", size: 10 },
      }),
    );

    expect(result).toEqual({
      success: false,
      error: "That file does not belong to this account.",
    });
    expect(createItemRowMock).not.toHaveBeenCalled();
  });

  it("creates a file item from the caller's own upload", async () => {
    getItemTypeBySlugMock.mockResolvedValue({
      id: "type-5",
      slug: "files",
      name: "File",
      icon: "File",
    });

    const file = { key: "uploads/user-1/abc.pdf", name: "notes.pdf", size: 12 };
    const result = await createItem(createPayload({ typeSlug: "files", file }));

    expect(result).toEqual({ success: true, data: DETAIL });
    expect(createItemRowMock).toHaveBeenCalledWith(
      "user-1",
      { id: "type-5", slug: "files", contentType: "FILE" },
      expect.objectContaining({ file }),
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
