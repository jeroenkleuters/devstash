import { describe, expect, it, vi } from "vitest";

import { compareItemTypes, type ItemTypeSummary } from "@/lib/db/item-types";

/**
 * The module reaches Prisma for `getItemTypeBySlug`, and `src/lib/prisma.ts`
 * throws at import time when `DATABASE_URL` is unset — so importing the pure
 * comparator next to it needs the client stubbed out. Nothing here calls it.
 */
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

function type(slug: string, name = slug): ItemTypeSummary {
  return { id: `id-${slug}`, slug, name, icon: "Code" };
}

/** The seeded order, which the schema carries no column for. */
const SEEDED = [
  "snippets",
  "prompts",
  "commands",
  "notes",
  "files",
  "images",
  "links",
];

describe("compareItemTypes", () => {
  it("puts the system types in their seeded order", () => {
    const shuffled = [...SEEDED].reverse().map((slug) => type(slug));

    expect(shuffled.sort(compareItemTypes).map((t) => t.slug)).toEqual(SEEDED);
  });

  it("sorts an unknown slug after every known one", () => {
    const sorted = [type("custom"), type("links"), type("snippets")]
      .sort(compareItemTypes)
      .map((t) => t.slug);

    expect(sorted).toEqual(["snippets", "links", "custom"]);
  });

  /** Custom types are post-launch, and nothing orders them but their name. */
  it("falls back to the name for two unknown slugs", () => {
    const sorted = [type("zeta", "Zeta"), type("alpha", "Alpha")]
      .sort(compareItemTypes)
      .map((t) => t.name);

    expect(sorted).toEqual(["Alpha", "Zeta"]);
  });

  it("is stable for the same slug", () => {
    expect(compareItemTypes(type("notes"), type("notes"))).toBe(0);
  });
});
