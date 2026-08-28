import { beforeEach, describe, expect, it, vi } from "vitest";

import { saveUploadPreferences } from "@/actions/upload-preferences";
import { getCurrentUserId, updateUploadPreferences } from "@/lib/db/user";
import { DEFAULT_UPLOAD_PREFERENCES } from "@/lib/validations/upload-preferences";

/**
 * `@/lib/db/user` imports `@/lib/prisma`, which throws at import time without a
 * `DATABASE_URL`. Replacing it keeps the test offline and leaves the action's
 * own job — session, validation, and turning a result into a response — as the
 * only thing under test.
 */
vi.mock("@/lib/db/user", () => ({
  getCurrentUserId: vi.fn(),
  updateUploadPreferences: vi.fn(),
}));

const getCurrentUserIdMock = vi.mocked(getCurrentUserId);
const updateMock = vi.mocked(updateUploadPreferences);

const VALID = { limit: 60, windowMs: 60 * 60 * 1000 } as const;

beforeEach(() => {
  // `restoreMocks` only restores spies, so a `vi.fn()` keeps its calls between
  // tests and the "not called" assertions would read the previous one's.
  vi.clearAllMocks();
  getCurrentUserIdMock.mockResolvedValue("user-1");
  updateMock.mockResolvedValue(true);
});

describe("saveUploadPreferences", () => {
  it("refuses without a session, without touching the database", async () => {
    getCurrentUserIdMock.mockResolvedValue(null);

    const result = await saveUploadPreferences(VALID);

    expect(result.success).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("stores a valid set against the session's account", async () => {
    const result = await saveUploadPreferences(VALID);

    expect(result.success).toBe(true);
    expect(updateMock).toHaveBeenCalledWith("user-1", VALID);
  });

  it("takes the account from the session and never from the payload", async () => {
    await saveUploadPreferences({ ...VALID, userId: "someone-else" });

    expect(updateMock).toHaveBeenCalledWith("user-1", VALID);
  });

  it("refuses a limit above the largest the card offers", async () => {
    // The ceiling, at the layer that actually writes. Raising the number past
    // what was offered has to be refused here, not clamped, or the setting
    // becomes a way around the guard rather than a control for it.
    const result = await saveUploadPreferences({
      limit: 100000,
      windowMs: DEFAULT_UPLOAD_PREFERENCES.windowMs,
    });

    expect(result.success).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("refuses a window shorter than the shortest the card offers", async () => {
    const result = await saveUploadPreferences({
      limit: DEFAULT_UPLOAD_PREFERENCES.limit,
      windowMs: 1000,
    });

    expect(result.success).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("refuses an invalid payload without touching the database", async () => {
    const result = await saveUploadPreferences({ limit: "lots" });

    expect(result.success).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("reports a session whose account is gone", async () => {
    updateMock.mockResolvedValue(false);

    const result = await saveUploadPreferences(VALID);

    expect(result.success).toBe(false);
  });

  it("turns a rejected write into a message rather than a throw", async () => {
    updateMock.mockRejectedValue(new Error("connection lost"));

    await expect(saveUploadPreferences(VALID)).resolves.toEqual({
      success: false,
      error: expect.any(String),
    });
  });
});
