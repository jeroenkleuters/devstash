import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { deleteAccount } from "@/lib/account";
import { getUserFileKeys } from "@/lib/db/items";
import { passwordResetIdentifier } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import { deleteFiles } from "@/lib/r2";

/**
 * `src/lib/prisma.ts` throws at import time without a `DATABASE_URL`, so the
 * client is replaced wholesale; the two collaborators are mocked as well,
 * since what matters here is *when* each is called rather than what a database
 * or a bucket makes of it.
 */
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), deleteMany: vi.fn() },
    verificationToken: { deleteMany: vi.fn() },
  },
}));

vi.mock("@/lib/db/items", () => ({ getUserFileKeys: vi.fn() }));
vi.mock("@/lib/r2", () => ({ deleteFiles: vi.fn() }));

const findUniqueMock = vi.mocked(prisma.user.findUnique);
const deleteUsersMock = vi.mocked(prisma.user.deleteMany);
const deleteTokensMock = vi.mocked(prisma.verificationToken.deleteMany);
const getUserFileKeysMock = vi.mocked(getUserFileKeys);
const deleteFilesMock = vi.mocked(deleteFiles);

const EMAIL = "gone@example.com";

beforeEach(() => {
  // `restoreMocks` in `vitest.config.mts` restores `vi.spyOn` spies only, so a
  // `vi.fn()` keeps its call history between tests — which is what would make
  // every "was not called" assertion below read the previous test's calls.
  vi.clearAllMocks();

  findUniqueMock.mockResolvedValue({ email: EMAIL } as never);
  deleteTokensMock.mockResolvedValue({ count: 0 } as never);
  deleteUsersMock.mockResolvedValue({ count: 1 } as never);
  getUserFileKeysMock.mockResolvedValue([]);
  deleteFilesMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("deleteAccount", () => {
  /**
   * The bug this feature exists to fix, and the reason the assertion is on the
   * *order* rather than on both calls having happened: `Item` cascades from
   * `User`, so a read moved below the `deleteMany` returns nothing and every
   * object the account uploaded is orphaned with no record of its key.
   */
  it("collects the file keys before the user row is deleted", async () => {
    await deleteAccount("user-1");

    expect(getUserFileKeysMock).toHaveBeenCalledWith("user-1");
    expect(
      getUserFileKeysMock.mock.invocationCallOrder[0],
    ).toBeLessThan(deleteUsersMock.mock.invocationCallOrder[0]);
  });

  it("passes the collected keys to the store, scoped to the owner", async () => {
    getUserFileKeysMock.mockResolvedValue([
      "uploads/user-1/a.png",
      "uploads/user-1/b.pdf",
    ]);

    await deleteAccount("user-1");

    expect(deleteFilesMock).toHaveBeenCalledWith("user-1", [
      "uploads/user-1/a.png",
      "uploads/user-1/b.pdf",
    ]);
  });

  it("clears the verification tokens under both identifiers", async () => {
    await deleteAccount("user-1");

    expect(deleteTokensMock).toHaveBeenCalledWith({
      where: {
        identifier: { in: [EMAIL, passwordResetIdentifier(EMAIL)] },
      },
    });
  });

  it("does not reach the store for an account with no files", async () => {
    await deleteAccount("user-1");

    expect(deleteFilesMock).not.toHaveBeenCalled();
  });

  /**
   * The point of deleting the row first: someone asking to be erased must not
   * be held up by an outage at a third party.
   */
  it("still deletes the account when the store rejects", async () => {
    getUserFileKeysMock.mockResolvedValue(["uploads/user-1/a.png"]);
    deleteFilesMock.mockRejectedValue(new Error("R2 unreachable"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(deleteAccount("user-1")).resolves.toBe(true);
    expect(deleteUsersMock).toHaveBeenCalledWith({ where: { id: "user-1" } });
  });

  it("logs the orphan count and the recovery command when the store rejects", async () => {
    getUserFileKeysMock.mockResolvedValue([
      "uploads/user-1/a.png",
      "uploads/user-1/b.pdf",
    ]);
    deleteFilesMock.mockRejectedValue(new Error("R2 unreachable"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await deleteAccount("user-1");

    const [message] = error.mock.calls[0] as [string];

    expect(message).toContain("2 R2 object(s)");
    expect(message).toContain("npm run r2:sweep");
  });

  it("returns false for an unknown account without touching anything", async () => {
    findUniqueMock.mockResolvedValue(null as never);

    await expect(deleteAccount("user-1")).resolves.toBe(false);
    expect(getUserFileKeysMock).not.toHaveBeenCalled();
    expect(deleteUsersMock).not.toHaveBeenCalled();
    expect(deleteFilesMock).not.toHaveBeenCalled();
  });

  /**
   * A second submission of the confirmation dialog. The submission that did
   * delete the row has already swept, so sweeping again would only duplicate
   * the log noise of anything that failed.
   */
  it("returns false and does not sweep when the row is already gone", async () => {
    getUserFileKeysMock.mockResolvedValue(["uploads/user-1/a.png"]);
    deleteUsersMock.mockResolvedValue({ count: 0 } as never);

    await expect(deleteAccount("user-1")).resolves.toBe(false);
    expect(deleteFilesMock).not.toHaveBeenCalled();
  });
});
