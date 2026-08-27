import { beforeEach, describe, expect, it, vi } from "vitest";

import { saveEditorPreferences } from "@/actions/editor-preferences";
import { getCurrentUserId, updateEditorPreferences } from "@/lib/db/user";

/**
 * `@/lib/db/user` imports `@/lib/prisma`, which throws at import time without a
 * `DATABASE_URL`. Replacing it keeps the test offline and leaves the action's
 * own job — session, validation, and turning a result into a response — as the
 * only thing under test.
 */
vi.mock("@/lib/db/user", () => ({
  getCurrentUserId: vi.fn(),
  updateEditorPreferences: vi.fn(),
}));

const getCurrentUserIdMock = vi.mocked(getCurrentUserId);
const updateMock = vi.mocked(updateEditorPreferences);

const VALID = {
  fontSize: 16,
  tabSize: 4,
  wordWrap: false,
  minimap: true,
  theme: "monokai",
} as const;

beforeEach(() => {
  // `restoreMocks` only restores spies, so a `vi.fn()` keeps its calls between
  // tests and the "not called" assertions would read the previous one's.
  vi.clearAllMocks();
  getCurrentUserIdMock.mockResolvedValue("user-1");
  updateMock.mockResolvedValue(true);
});

describe("saveEditorPreferences", () => {
  it("refuses without a session, without touching the database", async () => {
    getCurrentUserIdMock.mockResolvedValue(null);

    const result = await saveEditorPreferences(VALID);

    expect(result.success).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("refuses an invalid payload, without touching the database", async () => {
    const result = await saveEditorPreferences({ ...VALID, fontSize: 15 });

    expect(result.success).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("stores the preferences against the session's account", async () => {
    const result = await saveEditorPreferences(VALID);

    expect(result).toEqual({ success: true });
    expect(updateMock).toHaveBeenCalledWith("user-1", VALID);
  });

  it("takes the account from the session, never from the payload", async () => {
    await saveEditorPreferences({ ...VALID, userId: "someone-else" });

    // The id is the session's, and the schema stripped the one that was sent.
    expect(updateMock).toHaveBeenCalledWith("user-1", VALID);
  });

  it("reports a session whose account is gone", async () => {
    updateMock.mockResolvedValue(false);

    const result = await saveEditorPreferences(VALID);

    expect(result.success).toBe(false);
  });

  it("turns a rejected write into a message rather than a throw", async () => {
    updateMock.mockRejectedValue(new Error("connection lost"));

    await expect(saveEditorPreferences(VALID)).resolves.toEqual({
      success: false,
      error: expect.any(String),
    });
  });
});
