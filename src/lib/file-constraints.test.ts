import { describe, expect, it } from "vitest";

import {
  acceptAttribute,
  fileExtension,
  uploadContentType,
  validateUpload,
} from "@/lib/file-constraints";

describe("fileExtension", () => {
  it("lowercases what it finds", () => {
    expect(fileExtension("Screenshot.PNG")).toBe(".png");
  });

  it("takes the last extension of a double-barrelled name", () => {
    expect(fileExtension("archive.tar.gz")).toBe(".gz");
  });

  it("has none for a name with no dot", () => {
    expect(fileExtension("README")).toBe("");
  });

  it("treats a dotfile's name as a name and not an extension", () => {
    // ".env" is the whole filename — reading it as an extension would let it
    // pass for any type whose list happened to include it.
    expect(fileExtension(".env")).toBe("");
  });
});

describe("uploadContentType", () => {
  it("decides from the extension, not from what a browser reported", () => {
    // The point of the whole map: `.md` arrives as `text/markdown` on one
    // machine and as nothing at all on another.
    expect(uploadContentType("file", "notes.md")).toBe("text/markdown");
    expect(uploadContentType("file", "config.YML")).toBe("application/x-yaml");
  });

  it("falls back to a generic type for an extension it does not know", () => {
    // Unreachable through the routes, which validate first — this is what stops
    // an unknown extension being stored with no type at all.
    expect(uploadContentType("file", "thing.bin")).toBe(
      "application/octet-stream",
    );
  });

  it("keeps the two kinds separate", () => {
    // `.png` is an image extension, so it is not a file type's to serve.
    expect(uploadContentType("image", "shot.png")).toBe("image/png");
    expect(uploadContentType("file", "shot.png")).toBe(
      "application/octet-stream",
    );
  });
});

describe("acceptAttribute", () => {
  it("lists the kind's own extensions", () => {
    expect(acceptAttribute("image")).toBe(
      ".png,.jpg,.jpeg,.gif,.webp,.svg",
    );
  });
});

describe("validateUpload", () => {
  function image(overrides: Partial<Parameters<typeof validateUpload>[1]> = {}) {
    return validateUpload("image", {
      name: "shot.png",
      type: "image/png",
      size: 1024,
      ...overrides,
    });
  }

  function file(overrides: Partial<Parameters<typeof validateUpload>[1]> = {}) {
    return validateUpload("file", {
      name: "notes.md",
      type: "text/markdown",
      size: 1024,
      ...overrides,
    });
  }

  it("accepts a file that meets its kind's rules", () => {
    expect(image()).toBeNull();
    expect(file()).toBeNull();
  });

  it("rejects an extension the kind does not take", () => {
    expect(image({ name: "notes.pdf", type: "application/pdf" })).toMatch(
      /Images must be one of/,
    );
    expect(file({ name: "shot.png", type: "image/png" })).toMatch(
      /Files must be one of/,
    );
  });

  it("forgives a content type the browser could not name", () => {
    // Common for `.md`, `.toml` and `.ini`. The extension has already passed by
    // then, so this is not a way past the rules.
    expect(file({ type: "" })).toBeNull();
    expect(file({ type: "application/octet-stream" })).toBeNull();
  });

  it("accepts the second spelling of a format", () => {
    expect(file({ name: "data.yaml", type: "text/yaml" })).toBeNull();
    expect(file({ name: "feed.xml", type: "text/xml" })).toBeNull();
  });

  it("rejects a type that is neither the kind's nor unknown", () => {
    expect(file({ name: "notes.md", type: "image/png" })).toMatch(
      /not a file type/,
    );
  });

  it("holds each kind to its own size cap", () => {
    const FIVE_MB = 5 * 1024 * 1024;
    const TEN_MB = 10 * 1024 * 1024;

    expect(image({ size: FIVE_MB })).toBeNull();
    expect(image({ size: FIVE_MB + 1 })).toBe("Images are limited to 5 MB.");

    // The larger cap is the point: the same size passes as a file.
    expect(file({ size: FIVE_MB + 1 })).toBeNull();
    expect(file({ size: TEN_MB + 1 })).toBe("Files are limited to 10 MB.");
  });

  it("rejects an empty file", () => {
    // A zero-byte upload stores an object that can never be worth downloading.
    expect(image({ size: 0 })).toBe("That file is empty.");
  });
});
