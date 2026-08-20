import { beforeEach, describe, expect, it, vi } from "vitest";

import { createItem, deleteItem, updateItem } from "@/actions/items";
import { getItemTypeBySlug } from "@/lib/db/item-types";
import {
  createItem as createItemRow,
  deleteItem as deleteItemRow,
  updateItem as updateItemRow,
} from "@/lib/db/items";
import { getCurrentUserId } from "@/lib/db/user";
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
}));
vi.mock("@/lib/db/item-types", () => ({ getItemTypeBySlug: vi.fn() }));
vi.mock("@/lib/db/user", () => ({ getCurrentUserId: vi.fn() }));

const createItemRowMock = vi.mocked(createItemRow);
const updateItemRowMock = vi.mocked(updateItemRow);
const deleteItemRowMock = vi.mocked(deleteItemRow);
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

  it("refuses a type the dialog does not offer", async () => {
    // `files` is a real system type, so the slug would resolve — the schema is
    // what keeps a request from creating one, since nothing uploads a file.
    const result = await createItem(createPayload({ typeSlug: "files" }));

    expect(result).toEqual({ success: false, error: "Choose an item type." });
    expect(getItemTypeBySlugMock).not.toHaveBeenCalled();
    expect(createItemRowMock).not.toHaveBeenCalled();
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
});
