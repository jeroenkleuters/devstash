import { beforeEach, describe, expect, it, vi } from "vitest";

const { send } = vi.hoisted(() => ({ send: vi.fn() }));

/**
 * The SDK is replaced rather than pointed at a bucket: what is worth asserting
 * about the bulk delete is how the module reads a response, not what Cloudflare
 * does with a request. `objectKey` and `ownsObjectKey` are pure and never reach
 * it, so the mock costs them nothing.
 *
 * Every command is a class rather than a `vi.fn`, because the module calls each
 * with `new` and an arrow function is not a constructor.
 */
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class S3Client {
    send = send;
  },
  DeleteObjectCommand: class DeleteObjectCommand {
    constructor(readonly input: unknown) {}
  },
  DeleteObjectsCommand: class DeleteObjectsCommand {
    constructor(readonly input: unknown) {}
  },
  GetObjectCommand: class GetObjectCommand {
    constructor(readonly input: unknown) {}
  },
  HeadObjectCommand: class HeadObjectCommand {
    constructor(readonly input: unknown) {}
  },
  ListObjectsV2Command: class ListObjectsV2Command {
    constructor(readonly input: unknown) {}
  },
  PutObjectCommand: class PutObjectCommand {
    constructor(readonly input: unknown) {}
  },
  NoSuchKey: class NoSuchKey extends Error {},
  NotFound: class NotFound extends Error {},
}));

import {
  deleteFiles,
  deleteObjects,
  objectKey,
  ownsObjectKey,
} from "@/lib/r2";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("R2_ACCOUNT_ID", "account");
  vi.stubEnv("R2_ACCESS_KEY_ID", "key");
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "secret");
  vi.stubEnv("R2_BUCKET_NAME", "bucket");
  send.mockResolvedValue({});
});

describe("objectKey", () => {
  it("puts the key inside the user's own prefix", () => {
    // The prefix is not decoration: it is what `ownsObjectKey` reads.
    expect(objectKey("user-1", "notes.pdf")).toMatch(/^uploads\/user-1\//);
    expect(ownsObjectKey("user-1", objectKey("user-1", "notes.pdf"))).toBe(true);
  });

  it("keeps the extension", () => {
    // The stored content type is decided from it, and a key with no extension
    // is unreadable in a bucket listing.
    expect(objectKey("user-1", "Report.PDF")).toMatch(/\.pdf$/);
  });

  it("leaves the original filename out of the key", () => {
    // Deliberate: the name is stored on the item instead, so no user input is
    // ever sanitized into a path. Two files of the same name are two objects.
    const key = objectKey("user-1", "quarterly report (final).pdf");

    expect(key).not.toContain("quarterly");
    expect(key).not.toContain(" ");
  });

  it("gives two uploads of one name two keys", () => {
    expect(objectKey("user-1", "a.png")).not.toBe(objectKey("user-1", "a.png"));
  });

  it("has no extension to keep when the name has none", () => {
    expect(objectKey("user-1", "LICENSE")).toMatch(/^uploads\/user-1\/[\w-]+$/);
  });
});

describe("ownsObjectKey", () => {
  it("accepts a key in the user's own prefix", () => {
    expect(ownsObjectKey("user-1", "uploads/user-1/abc.pdf")).toBe(true);
  });

  it("refuses another user's prefix", () => {
    expect(ownsObjectKey("user-1", "uploads/user-2/abc.pdf")).toBe(false);
  });

  it("refuses a user id that merely starts the same", () => {
    // The trailing slash in the prefix is what does this. Without it,
    // `user-10`'s objects would sit inside `user-1`'s.
    expect(ownsObjectKey("user-1", "uploads/user-10/abc.pdf")).toBe(false);
  });

  it("refuses a key that climbs out of the prefix", () => {
    // Not traversal at the store — S3 keys are opaque strings — but the key
    // arrives from a request, and nothing is served by letting one climb.
    expect(ownsObjectKey("user-1", "uploads/user-1/../user-2/abc.pdf")).toBe(
      false,
    );
  });

  it("refuses a key outside the uploads prefix entirely", () => {
    expect(ownsObjectKey("user-1", "user-1/abc.pdf")).toBe(false);
    expect(ownsObjectKey("user-1", "")).toBe(false);
  });

  it("does not mistake the prefix itself for an object in it", () => {
    expect(ownsObjectKey("user-1", "uploads/user-1")).toBe(false);
  });
});

describe("deleteObjects", () => {
  it("sends every key in one request", async () => {
    await deleteObjects(["uploads/user-1/a", "uploads/user-1/b"]);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].input).toEqual({
      Bucket: "bucket",
      Delete: {
        Objects: [{ Key: "uploads/user-1/a" }, { Key: "uploads/user-1/b" }],
      },
    });
  });

  /**
   * The case that is easy to get wrong, and the reason this test exists: a
   * partial failure comes back as a 200 carrying an `Errors` array rather than
   * as a throw, so a `try`/`catch` alone reads it as a success — which would
   * turn account deletion's best-effort sweep into no effort at all.
   */
  it("treats a 200 carrying an Errors array as a failure", async () => {
    send.mockResolvedValue({
      Errors: [
        { Key: "uploads/user-1/a", Code: "AccessDenied", Message: "nope" },
      ],
    });

    await expect(deleteObjects(["uploads/user-1/a"])).rejects.toThrow(
      "uploads/user-1/a",
    );
  });

  it("does not treat an empty Errors array as a failure", async () => {
    send.mockResolvedValue({ Errors: [] });

    await expect(deleteObjects(["uploads/user-1/a"])).resolves.toBeUndefined();
  });

  it("chunks at the API's 1,000-key limit", async () => {
    const keys = Array.from({ length: 1001 }, (_, i) => `uploads/user-1/${i}`);

    await deleteObjects(keys);

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0][0].input.Delete.Objects).toHaveLength(1000);
    expect(send.mock.calls[1][0].input.Delete.Objects).toHaveLength(1);
  });

  it("sends nothing for an empty list", async () => {
    await deleteObjects([]);

    expect(send).not.toHaveBeenCalled();
  });
});

describe("deleteFiles", () => {
  /**
   * The keys come from the user's own rows, so this should never drop
   * anything — but `fileUrl` is a stored string, and it is the one check
   * standing between a data bug and deleting someone else's file.
   */
  it("refuses a key outside the owner's prefix", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    await deleteFiles("user-1", [
      "uploads/user-1/mine",
      "uploads/user-2/theirs",
    ]);

    expect(send.mock.calls[0][0].input.Delete.Objects).toEqual([
      { Key: "uploads/user-1/mine" },
    ]);
  });

  it("sends nothing when every key is refused", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    await deleteFiles("user-1", ["uploads/user-2/theirs"]);

    expect(send).not.toHaveBeenCalled();
  });
});
