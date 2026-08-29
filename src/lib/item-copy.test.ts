import { describe, expect, it } from "vitest";

import { copyText } from "@/lib/item-copy";
import type { ItemDetail } from "@/types/item";

/** A detail with every payload field empty; each test fills the one it means. */
function detail(overrides: Partial<ItemDetail> = {}): ItemDetail {
  return {
    id: "item-1",
    title: "Example",
    description: null,
    contentType: "TEXT",
    content: null,
    url: null,
    fileName: null,
    fileSize: null,
    fileUrl: null,
    language: null,
    author: null,
    isFavorite: false,
    isPinned: false,
    type: { id: "type-1", slug: "snippets", name: "Snippet", icon: "Code" },
    tags: [],
    collections: [],
    createdAt: "2026-08-14T09:30:00Z",
    updatedAt: "2026-08-14T09:30:00Z",
    ...overrides,
  };
}

describe("copyText", () => {
  it("copies a text item's content", () => {
    expect(copyText(detail({ content: "const x = 1;" }))).toBe("const x = 1;");
  });

  it("copies a link item's url", () => {
    expect(copyText(detail({ contentType: "URL", url: "https://a.dev" }))).toBe(
      "https://a.dev",
    );
  });

  /**
   * The fields are mutually exclusive by application rule and nothing in the
   * schema enforces it, so a row carrying both is possible. Content wins.
   */
  it("prefers content when a row somehow carries both", () => {
    expect(copyText(detail({ content: "text", url: "https://a.dev" }))).toBe(
      "text",
    );
  });

  /**
   * `||` and not `??`: an empty content field is a field with nothing in it,
   * which is the same to a clipboard as no field at all. Swapping the operator
   * would return `""` here and report a successful copy of nothing.
   */
  it("treats empty content as nothing to copy", () => {
    expect(copyText(detail({ content: "" }))).toBeNull();
  });

  it("falls through an empty content field to the url", () => {
    expect(copyText(detail({ content: "", url: "https://a.dev" }))).toBe(
      "https://a.dev",
    );
  });

  /**
   * `fileUrl` holds an R2 object key, which means nothing outside the server —
   * so a file item copies as null rather than putting the key on the clipboard.
   */
  it("gives a file item nothing to copy, key or not", () => {
    expect(
      copyText(
        detail({
          contentType: "FILE",
          fileName: "notes.pdf",
          fileUrl: "uploads/user-1/abc123",
        }),
      ),
    ).toBeNull();
  });
});
