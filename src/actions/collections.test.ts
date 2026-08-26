import { beforeEach, describe, expect, it, vi } from "vitest";

import { createCollection } from "@/actions/collections";
import { createCollection as createCollectionRow } from "@/lib/db/collections";
import { getCurrentUserId } from "@/lib/db/user";
import type { CollectionSummary } from "@/lib/db/collections";

/**
 * Both modules import `@/lib/prisma`, which throws at import time without a
 * `DATABASE_URL`. Replacing them keeps the test offline and leaves the action's
 * own job — session, validation, and turning a result into a response — as the
 * only thing under test.
 */
vi.mock("@/lib/db/collections", () => ({ createCollection: vi.fn() }));
vi.mock("@/lib/db/user", () => ({ getCurrentUserId: vi.fn() }));

const createCollectionRowMock = vi.mocked(createCollectionRow);
const getCurrentUserIdMock = vi.mocked(getCurrentUserId);

const SUMMARY = {
  id: "collection-1",
  name: "React Patterns",
} as unknown as CollectionSummary;

beforeEach(() => {
  // `restoreMocks` only restores spies, so a `vi.fn()` keeps its calls between
  // tests — without this the "not called" assertions would read the last one's.
  vi.clearAllMocks();
  getCurrentUserIdMock.mockResolvedValue("user-1");
  createCollectionRowMock.mockResolvedValue(SUMMARY);
});

describe("createCollection", () => {
  it("refuses a session whose account is gone", async () => {
    getCurrentUserIdMock.mockResolvedValue(null);

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
