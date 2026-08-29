import { describe, expect, it } from "vitest";

import {
  createItemSchema,
  presignUploadSchema,
  updateItemSchema,
} from "@/lib/validations/item";

/** The shape the drawer submits, with every field at its empty default. */
function payload(overrides: Record<string, unknown> = {}) {
  return {
    title: "A title",
    description: "",
    content: "",
    url: "",
    language: "",
    author: "",
    tags: [] as string[],
    ...overrides,
  };
}

function parse(overrides: Record<string, unknown> = {}) {
  return updateItemSchema.safeParse(payload(overrides));
}

/** The parsed value, for the cases that are expected to pass. */
function parsed(overrides: Record<string, unknown> = {}) {
  const result = parse(overrides);

  if (!result.success) {
    throw new Error(`expected the payload to parse: ${result.error.message}`);
  }

  return result.data;
}

function firstError(overrides: Record<string, unknown> = {}) {
  const result = parse(overrides);

  return result.success ? null : result.error.issues[0]?.message;
}

describe("updateItemSchema", () => {
  describe("title", () => {
    it("trims", () => {
      expect(parsed({ title: "  Spaced  " }).title).toBe("Spaced");
    });

    it("rejects a title that is only whitespace", () => {
      // Trimming happens first, so this is the same rejection as an empty
      // field — which is what the form's disabled Save button also guards.
      expect(firstError({ title: "   " })).toBe("Title is required.");
    });

    it("rejects a title beyond the length cap", () => {
      expect(firstError({ title: "x".repeat(201) })).toMatch(/limited to 200/);
    });
  });

  describe("optional text", () => {
    it("stores an emptied field as null rather than an empty string", () => {
      // Inputs have no null: without this the drawer would have to tell "no
      // description" and "an empty description" apart.
      const values = parsed({ description: "", content: "  ", language: "" });

      expect(values.description).toBeNull();
      expect(values.content).toBeNull();
      expect(values.language).toBeNull();
    });

    it("keeps content that has inner whitespace", () => {
      expect(parsed({ content: "  const a = 1;\n\nconst b = 2;  " }).content).toBe(
        "const a = 1;\n\nconst b = 2;",
      );
    });
  });

  describe("url", () => {
    it("accepts a valid URL, trimmed", () => {
      expect(parsed({ url: "  https://example.com/a  " }).url).toBe(
        "https://example.com/a",
      );
    });

    it("treats an empty field as no URL instead of an invalid one", () => {
      expect(parsed({ url: "   " }).url).toBeNull();
    });

    it("rejects something that is not a URL", () => {
      expect(firstError({ url: "example.com" })).toMatch(/valid URL/);
    });
  });

  describe("tags", () => {
    it("trims and drops the empty segments a comma-separated field leaves", () => {
      // "react, , hooks," splits to four entries, two of them junk.
      expect(parsed({ tags: ["react", " ", " hooks", ""] }).tags).toEqual([
        "react",
        "hooks",
      ]);
    });

    it("removes duplicates", () => {
      // Not cosmetic: the same name twice makes `connectOrCreate` attempt a row
      // that violates Tag.@@unique([userId, name]), failing the whole write.
      expect(parsed({ tags: ["react", "react", " react "] }).tags).toEqual([
        "react",
      ]);
    });

    it("treats differently cased tags as distinct", () => {
      // Postgres does too — the unique index is on the exact name.
      expect(parsed({ tags: ["React", "react"] }).tags).toEqual([
        "React",
        "react",
      ]);
    });

    it("rejects more tags than an item may carry", () => {
      const tags = Array.from({ length: 21 }, (_, index) => `tag-${index}`);

      expect(firstError({ tags })).toMatch(/at most 20 tags/);
    });

    it("counts the cap after duplicates are removed", () => {
      const tags = Array.from({ length: 21 }, () => "same");

      expect(parsed({ tags }).tags).toEqual(["same"]);
    });

    it("rejects a tag beyond the length cap", () => {
      expect(firstError({ tags: ["x".repeat(33)] })).toMatch(/limited to 32/);
    });
  });
});

describe("createItemSchema", () => {
  /** The create payload is the edit one plus the type it is created as. */
  function createParse(overrides: Record<string, unknown> = {}) {
    return createItemSchema.safeParse({
      typeSlug: "snippets",
      ...payload(overrides),
    });
  }

  function createError(overrides: Record<string, unknown> = {}) {
    const result = createParse(overrides);

    return result.success ? null : result.error.issues[0]?.message;
  }

  it("shares the edit schema's field rules", () => {
    // The two are built from one set of fields, so this is a spot check that
    // they still are rather than a second pass over every rule.
    expect(createError({ title: "   " })).toBe("Title is required.");
  });

  it("rejects a slug that names no type", () => {
    expect(createError({ typeSlug: "banana" })).toBe("Choose an item type.");
  });

  it("requires a file for the file types", () => {
    // Both are `ContentType.FILE`, and a file item with no object behind it is
    // a title and nothing else.
    expect(createError({ typeSlug: "files" })).toBe("Upload a file first.");
    expect(createError({ typeSlug: "images" })).toBe("Upload a file first.");
  });

  it("accepts a file item that has one", () => {
    const result = createParse({
      typeSlug: "files",
      file: { key: "uploads/user-1/abc.pdf", name: "notes.pdf" },
    });

    expect(result.success).toBe(true);
  });

  it("keeps no size the client sends with an upload", () => {
    // The bytes go straight to R2, so a size here could only be the browser's
    // word for it. `createItem` asks the bucket instead, and this is what stops
    // a crafted one reaching the row.
    const result = createParse({
      typeSlug: "files",
      file: { key: "uploads/user-1/abc.pdf", name: "notes.pdf", size: 1 },
    });

    expect(result.success).toBe(true);
    expect(result.success && result.data.file).toEqual({
      key: "uploads/user-1/abc.pdf",
      name: "notes.pdf",
    });
  });

  it("rejects an upload that names no object", () => {
    expect(
      createError({
        typeSlug: "images",
        file: { key: "  ", name: "shot.png" },
      }),
    ).toBe("That upload is missing its file.");
  });

  it("asks for no file from a type that carries none", () => {
    // The field is on the payload for every type, so this is what keeps the
    // refine scoped to the two that own it.
    expect(createParse({ typeSlug: "snippets" }).success).toBe(true);
  });

  it("requires a URL for a link", () => {
    expect(createError({ typeSlug: "links", url: "" })).toBe(
      "A URL is required.",
    );
  });

  it("accepts a link that has one", () => {
    const result = createParse({
      typeSlug: "links",
      url: "https://example.com",
    });

    expect(result.success).toBe(true);
  });

  it("takes a book with a cover and no link", () => {
    // The link is optional: a cover dropped on the listing becomes a book
    // straight away, and the link is added in the drawer afterwards.
    const result = createParse({
      typeSlug: "books",
      url: "",
      file: { key: "uploads/user-1/abc.jpg", name: "cover.jpg" },
    });

    expect(result.success).toBe(true);
    expect(result.success && result.data.url).toBeNull();
  });

  it("accepts a book carrying both a cover and a link", () => {
    const result = createParse({
      typeSlug: "books",
      url: "https://example.com/book",
      file: { key: "uploads/user-1/abc.jpg", name: "cover.jpg" },
      author: "  Ursula K. Le Guin  ",
    });

    expect(result.success).toBe(true);
    expect(result.success && result.data.author).toBe("Ursula K. Le Guin");
  });

  it("does not ask a text type for a URL", () => {
    // Only the URL types are held to it — a snippet has nowhere to put one.
    expect(createParse({ typeSlug: "notes", url: "" }).success).toBe(true);
  });
});

describe("presignUploadSchema", () => {
  function presign(overrides: Record<string, unknown> = {}) {
    return presignUploadSchema.safeParse({
      kind: "file",
      name: "notes.pdf",
      type: "application/pdf",
      size: 2048,
      ...overrides,
    });
  }

  it("accepts what the upload zone sends", () => {
    expect(presign().success).toBe(true);
  });

  it("takes only the two upload kinds", () => {
    // The route hands this straight to `validateUpload`, which has rules for
    // these two and nothing else.
    expect(presign({ kind: "video" }).success).toBe(false);
    expect(presign({ kind: "image", name: "shot.png" }).success).toBe(true);
  });

  it("accepts a content type the browser could not name", () => {
    // Common for `.md`, `.toml` and `.ini`. Whether an empty type is allowed
    // for this extension is `validateUpload`'s call, not the shape's.
    expect(presign({ type: "" }).success).toBe(true);
  });

  it("refuses a size that is not a whole count of bytes", () => {
    expect(presign({ size: 12.5 }).success).toBe(false);
    expect(presign({ size: -1 }).success).toBe(false);
    expect(presign({ size: "2048" }).success).toBe(false);
  });

  it("says nothing about the cap itself", () => {
    // Deliberate: the shape is one thing and the rules are another, and the
    // route runs both. A 200 MB claim parses here and is refused by
    // `validateUpload` a line later.
    expect(presign({ size: 200 * 1024 * 1024 }).success).toBe(true);
  });

  it("requires a file name", () => {
    expect(presign({ name: "   " }).success).toBe(false);
  });
});
