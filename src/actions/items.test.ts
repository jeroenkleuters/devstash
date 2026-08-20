import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteItem, updateItem } from "@/actions/items";
import {
  deleteItem as deleteItemRow,
  updateItem as updateItemRow,
} from "@/lib/db/items";
import { getCurrentUserId } from "@/lib/db/user";
import type { ItemDetail } from "@/types/item";

/**
 * Both modules import `@/lib/prisma`, which throws at import time without a
 * `DATABASE_URL`. Replacing them keeps the test offline and leaves the action's
 * own job — session, validation, and turning a result into a response — as the
 * only thing under test.
 */
vi.mock("@/lib/db/items", () => ({
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
}));
vi.mock("@/lib/db/user", () => ({ getCurrentUserId: vi.fn() }));

const updateItemRowMock = vi.mocked(updateItemRow);
const deleteItemRowMock = vi.mocked(deleteItemRow);
const getCurrentUserIdMock = vi.mocked(getCurrentUserId);

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
  updateItemRowMock.mockResolvedValue(DETAIL);
  deleteItemRowMock.mockResolvedValue(true);
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
