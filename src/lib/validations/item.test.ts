import { describe, expect, it } from "vitest";

import { updateItemSchema } from "@/lib/validations/item";

/** The shape the drawer submits, with every field at its empty default. */
function payload(overrides: Record<string, unknown> = {}) {
  return {
    title: "A title",
    description: "",
    content: "",
    url: "",
    language: "",
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
