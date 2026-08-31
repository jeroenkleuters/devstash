import { beforeEach, describe, expect, it, vi } from "vitest";

import { saveAiPreferences } from "@/actions/ai-preferences";
import { getCurrentUserId, updateAiPreferences } from "@/lib/db/user";

/**
 * `@/lib/db/user` reaches the Prisma singleton, which throws at import time
 * without a `DATABASE_URL` — and this is about what the action does with the
 * session and the payload rather than about the write itself.
 */
vi.mock("@/lib/db/user", () => ({
  getCurrentUserId: vi.fn(),
  updateAiPreferences: vi.fn(),
}));

const getCurrentUserIdMock = vi.mocked(getCurrentUserId);
const updateAiPreferencesMock = vi.mocked(updateAiPreferences);

beforeEach(() => {
  // `restoreMocks` restores `vi.spyOn` spies only, so a `vi.fn()` keeps its
  // call history across tests — which is what would make every "did not write"
  // assertion below read the previous test's call.
  vi.clearAllMocks();

  getCurrentUserIdMock.mockResolvedValue("user-1");
  updateAiPreferencesMock.mockResolvedValue(true);
});

describe("saveAiPreferences", () => {
  it("stores the setting", async () => {
    const result = await saveAiPreferences({ enabled: false });

    expect(result).toEqual({ success: true });
    expect(updateAiPreferencesMock).toHaveBeenCalledWith("user-1", {
      enabled: false,
    });
  });

  it("turns the feature back on again", async () => {
    await saveAiPreferences({ enabled: true });

    expect(updateAiPreferencesMock).toHaveBeenCalledWith("user-1", {
      enabled: true,
    });
  });

  it("refuses a signed-out caller without writing", async () => {
    getCurrentUserIdMock.mockResolvedValue(null);

    const result = await saveAiPreferences({ enabled: false });

    expect(result).toEqual({
      success: false,
      error: "Your session has ended. Sign in again.",
    });
    expect(updateAiPreferencesMock).not.toHaveBeenCalled();
  });

  /**
   * The scoping that matters, and the one to mutation-check: a request may name
   * the setting it wants but not whose it is. The id in the payload is dropped
   * by the schema and the write still goes to the session's account.
   */
  it("takes the account from the session, never the payload", async () => {
    const result = await saveAiPreferences({
      enabled: false,
      userId: "someone-else",
      id: "someone-else",
    });

    expect(result).toEqual({ success: true });
    expect(updateAiPreferencesMock).toHaveBeenCalledWith("user-1", {
      enabled: false,
    });
    expect(updateAiPreferencesMock).not.toHaveBeenCalledWith(
      "someone-else",
      expect.anything(),
    );
  });

  it("strips unknown fields rather than storing them", async () => {
    await saveAiPreferences({ enabled: true, model: "gpt-4", budget: 999 });

    expect(updateAiPreferencesMock).toHaveBeenCalledWith("user-1", {
      enabled: true,
    });
  });

  it("refuses an invalid payload without touching the database", async () => {
    for (const input of [{}, { enabled: "yes" }, null, "enabled", 42]) {
      const result = await saveAiPreferences(input);

      expect(result.success).toBe(false);
    }

    expect(updateAiPreferencesMock).not.toHaveBeenCalled();
  });

  /**
   * The JWT still verifies but the row is gone — which is what deleting an
   * account leaves behind if the sign-out after it ever failed.
   */
  it("answers rather than crashing when the account is gone", async () => {
    updateAiPreferencesMock.mockResolvedValue(false);

    const result = await saveAiPreferences({ enabled: false });

    expect(result).toEqual({
      success: false,
      error: "Your session has ended. Sign in again.",
    });
  });

  it("turns a rejected write into a message rather than a throw", async () => {
    updateAiPreferencesMock.mockRejectedValue(new Error("connection lost"));

    await expect(saveAiPreferences({ enabled: false })).resolves.toEqual({
      success: false,
      error: "Could not save your AI setting. Try again.",
    });
  });
});
