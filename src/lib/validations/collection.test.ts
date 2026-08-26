import { describe, expect, it } from "vitest";

import { createCollectionSchema } from "@/lib/validations/collection";

function parse(input: Record<string, unknown>) {
  return createCollectionSchema.safeParse({
    name: "React Patterns",
    description: "",
    ...input,
  });
}

describe("createCollectionSchema", () => {
  it("trims the name", () => {
    const result = parse({ name: "  React Patterns  " });

    expect(result.success && result.data.name).toBe("React Patterns");
  });

  it("rejects a name that is only whitespace", () => {
    const result = parse({ name: "   " });

    expect(result.success).toBe(false);
    expect(!result.success && result.error.issues[0].message).toBe(
      "Name is required.",
    );
  });

  it("caps the name", () => {
    expect(parse({ name: "n".repeat(100) }).success).toBe(true);
    expect(parse({ name: "n".repeat(101) }).success).toBe(false);
  });

  // `description` is nullable in the schema, so an emptied field has to arrive
  // as null — an empty string would be a description that renders as a blank
  // line rather than as no description at all.
  it("stores an empty description as null, not an empty string", () => {
    expect(parse({ description: "" }).success && parse({ description: "" }).data)
      .toHaveProperty("description", null);
    expect(
      parse({ description: "   " }).success &&
        parse({ description: "   " }).data,
    ).toHaveProperty("description", null);
  });

  it("keeps a real description, trimmed", () => {
    const result = parse({ description: "  Hooks and patterns  " });

    expect(result.success && result.data.description).toBe(
      "Hooks and patterns",
    );
  });

  it("caps the description", () => {
    expect(parse({ description: "d".repeat(500) }).success).toBe(true);
    expect(parse({ description: "d".repeat(501) }).success).toBe(false);
  });

  // The owner comes from the session, so there is no `userId` to name — and
  // `isFavorite` is not this form's to set either. Both are dropped rather than
  // carried through to the write.
  it("drops anything the caller adds beyond the two fields", () => {
    const result = parse({ userId: "someone-else", isFavorite: true });

    expect(result.success && result.data).toEqual({
      name: "React Patterns",
      description: null,
    });
  });
});
