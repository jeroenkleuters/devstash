import { describe, expect, it } from "vitest";

import { objectKey, ownsObjectKey } from "@/lib/r2";

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
