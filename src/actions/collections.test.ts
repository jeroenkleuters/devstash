import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createCollection,
  deleteCollection,
  setCollectionFavorite,
  updateCollection,
} from "@/actions/collections";
import {
  countCollections,
  createCollection as createCollectionRow,
  deleteCollection as deleteCollectionRow,
  setCollectionFavorite as setCollectionFavoriteRow,
  updateCollection as updateCollectionRow,
} from "@/lib/db/collections";
import { getCurrentUser, getCurrentUserId } from "@/lib/db/user";
import type { CurrentUser } from "@/lib/db/user";
import type { CollectionSummary } from "@/lib/db/collections";
import {
  collectionLimitMessage,
  FREE_COLLECTION_LIMIT,
} from "@/lib/usage-limits";

/**
 * Both modules import `@/lib/prisma`, which throws at import time without a
 * `DATABASE_URL`. Replacing them keeps the test offline and leaves the action's
 * own job — session, validation, and turning a result into a response — as the
 * only thing under test.
 */
vi.mock("@/lib/db/collections", () => ({
  countCollections: vi.fn(),
  createCollection: vi.fn(),
  updateCollection: vi.fn(),
  deleteCollection: vi.fn(),
  setCollectionFavorite: vi.fn(),
}));
vi.mock("@/lib/db/user", () => ({
  getCurrentUser: vi.fn(),
  getCurrentUserId: vi.fn(),
}));

const createCollectionRowMock = vi.mocked(createCollectionRow);
const updateCollectionRowMock = vi.mocked(updateCollectionRow);
const deleteCollectionRowMock = vi.mocked(deleteCollectionRow);
const setCollectionFavoriteRowMock = vi.mocked(setCollectionFavoriteRow);
const getCurrentUserIdMock = vi.mocked(getCurrentUserId);
const getCurrentUserMock = vi.mocked(getCurrentUser);
const countCollectionsMock = vi.mocked(countCollections);

/** A free account well under the collection cap — the default for these tests. */
const FREE_USER = { id: "user-1", isPro: false } as CurrentUser;

const SUMMARY = {
  id: "collection-1",
  name: "React Patterns",
} as unknown as CollectionSummary;

beforeEach(() => {
  // `restoreMocks` only restores spies, so a `vi.fn()` keeps its calls between
  // tests — without this the "not called" assertions would read the last one's.
  vi.clearAllMocks();
  getCurrentUserIdMock.mockResolvedValue("user-1");
  getCurrentUserMock.mockResolvedValue(FREE_USER);
  countCollectionsMock.mockResolvedValue(0);
  createCollectionRowMock.mockResolvedValue(SUMMARY);
  updateCollectionRowMock.mockResolvedValue(SUMMARY);
  deleteCollectionRowMock.mockResolvedValue(true);
  setCollectionFavoriteRowMock.mockResolvedValue(true);
});

describe("createCollection", () => {
  it("refuses a free account that is at the collection cap", async () => {
    countCollectionsMock.mockResolvedValue(FREE_COLLECTION_LIMIT);

    const result = await createCollection({ name: "React", description: "" });

    expect(result).toEqual({ success: false, error: collectionLimitMessage() });
    expect(createCollectionRowMock).not.toHaveBeenCalled();
  });

  it("allows a free account one below the cap", async () => {
    // The boundary is `>=`: holding exactly the limit is at it, not under it.
    countCollectionsMock.mockResolvedValue(FREE_COLLECTION_LIMIT - 1);

    const result = await createCollection({ name: "React", description: "" });

    expect(result).toEqual({ success: true, data: SUMMARY });
  });

  it("does not count a Pro account's collections at all", async () => {
    getCurrentUserMock.mockResolvedValue({ ...FREE_USER, isPro: true });
    countCollectionsMock.mockResolvedValue(999);

    const result = await createCollection({ name: "React", description: "" });

    expect(result).toEqual({ success: true, data: SUMMARY });
    expect(countCollectionsMock).not.toHaveBeenCalled();
  });

  it("refuses a session whose account is gone", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    const result = await createCollection({ name: "React", description: "" });

    expect(result).toEqual({
      success: false,
      error: "Your session has ended. Sign in again.",
    });
    expect(createCollectionRowMock).not.toHaveBeenCalled();
  });

  it("reports an invalid payload without touching the database", async () => {
    const result = await createCollection({ name: "  ", description: "" });

    expect(result).toEqual({ success: false, error: "Name is required." });
    expect(createCollectionRowMock).not.toHaveBeenCalled();
  });

  // The one thing a crafted request must not be able to do: name its own owner.
  it("writes as the session's user, not one named by the caller", async () => {
    await createCollection({
      name: "React Patterns",
      description: "Hooks",
      userId: "someone-else",
    });

    expect(createCollectionRowMock).toHaveBeenCalledWith("user-1", {
      name: "React Patterns",
      description: "Hooks",
    });
  });

  it("returns the created collection", async () => {
    const result = await createCollection({
      name: "React Patterns",
      description: "",
    });

    expect(result).toEqual({ success: true, data: SUMMARY });
  });

  it("turns a rejected write into a message rather than a throw", async () => {
    createCollectionRowMock.mockRejectedValue(new Error("connection lost"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await createCollection({
      name: "React Patterns",
      description: "",
    });

    expect(result).toEqual({
      success: false,
      error: "Could not create this collection. Try again.",
    });
  });
});

describe("updateCollection", () => {
  it("refuses a session whose account is gone", async () => {
    getCurrentUserIdMock.mockResolvedValue(null);

    const result = await updateCollection("collection-1", {
      name: "Renamed",
      description: "",
    });

    expect(result).toEqual({
      success: false,
      error: "Your session has ended. Sign in again.",
    });
    expect(updateCollectionRowMock).not.toHaveBeenCalled();
  });

  it("reports an invalid payload without touching the database", async () => {
    const result = await updateCollection("collection-1", {
      name: "  ",
      description: "",
    });

    expect(result).toEqual({ success: false, error: "Name is required." });
    expect(updateCollectionRowMock).not.toHaveBeenCalled();
  });

  // The id is an argument of its own and the owner is the session's, so a
  // payload can name neither the collection it edits nor who owns it.
  it("edits as the session's user, not one named by the caller", async () => {
    await updateCollection("collection-1", {
      name: "Renamed",
      description: "Hooks",
      userId: "someone-else",
      id: "someone-elses-collection",
    });

    expect(updateCollectionRowMock).toHaveBeenCalledWith(
      "user-1",
      "collection-1",
      { name: "Renamed", description: "Hooks" },
    );
  });

  // The query cannot tell "no such collection" from "not yours", so neither
  // can the message.
  it("reports a collection that is missing or not the caller's", async () => {
    updateCollectionRowMock.mockResolvedValue(null);

    const result = await updateCollection("not-mine", {
      name: "Renamed",
      description: "",
    });

    expect(result).toEqual({
      success: false,
      error: "That collection no longer exists.",
    });
  });

  it("returns the saved collection", async () => {
    const result = await updateCollection("collection-1", {
      name: "Renamed",
      description: "",
    });

    expect(result).toEqual({ success: true, data: SUMMARY });
  });

  it("turns a rejected write into a message rather than a throw", async () => {
    updateCollectionRowMock.mockRejectedValue(new Error("connection lost"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await updateCollection("collection-1", {
      name: "Renamed",
      description: "",
    });

    expect(result).toEqual({
      success: false,
      error: "Could not save this collection. Try again.",
    });
  });
});

describe("deleteCollection", () => {
  it("refuses a session whose account is gone", async () => {
    getCurrentUserIdMock.mockResolvedValue(null);

    const result = await deleteCollection("collection-1");

    expect(result).toEqual({
      success: false,
      error: "Your session has ended. Sign in again.",
    });
    expect(deleteCollectionRowMock).not.toHaveBeenCalled();
  });

  it("deletes as the session's user", async () => {
    await deleteCollection("collection-1");

    expect(deleteCollectionRowMock).toHaveBeenCalledWith(
      "user-1",
      "collection-1",
    );
  });

  it("reports a collection that is missing or not the caller's", async () => {
    deleteCollectionRowMock.mockResolvedValue(false);

    const result = await deleteCollection("not-mine");

    expect(result).toEqual({
      success: false,
      error: "That collection no longer exists.",
    });
  });

  it("answers success with no data half", async () => {
    await expect(deleteCollection("collection-1")).resolves.toEqual({
      success: true,
    });
  });

  it("turns a rejected delete into a message rather than a throw", async () => {
    deleteCollectionRowMock.mockRejectedValue(new Error("connection lost"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await deleteCollection("collection-1");

    expect(result).toEqual({
      success: false,
      error: "Could not delete this collection. Try again.",
    });
  });
});

describe("setCollectionFavorite", () => {
  it("refuses a session whose account is gone", async () => {
    getCurrentUserIdMock.mockResolvedValue(null);

    const result = await setCollectionFavorite("collection-1", true);

    expect(result).toEqual({
      success: false,
      error: "Your session has ended. Sign in again.",
    });
    expect(setCollectionFavoriteRowMock).not.toHaveBeenCalled();
  });

  it("writes as the session's user, never one the caller could name", async () => {
    await setCollectionFavorite("collection-1", true);

    expect(setCollectionFavoriteRowMock).toHaveBeenCalledWith(
      "user-1",
      "collection-1",
      true,
    );
  });

  /**
   * The value asked for is passed through rather than a flip of what is stored,
   * so two clicks racing settle on one answer instead of opposite ones.
   */
  it("passes the requested value through, both ways", async () => {
    await setCollectionFavorite("collection-1", false);

    expect(setCollectionFavoriteRowMock).toHaveBeenCalledWith(
      "user-1",
      "collection-1",
      false,
    );
  });

  it("reports a collection that is missing or not the caller's", async () => {
    setCollectionFavoriteRowMock.mockResolvedValue(false);

    const result = await setCollectionFavorite("not-mine", true);

    expect(result).toEqual({
      success: false,
      error: "That collection no longer exists.",
    });
  });

  it("answers success with no data half", async () => {
    await expect(setCollectionFavorite("collection-1", true)).resolves.toEqual({
      success: true,
    });
  });

  it("turns a rejected write into a message rather than a throw", async () => {
    setCollectionFavoriteRowMock.mockRejectedValue(new Error("connection lost"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await setCollectionFavorite("collection-1", true);

    expect(result).toEqual({
      success: false,
      error: "Could not change this collection's favorite. Try again.",
    });
  });
});
