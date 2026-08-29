import { describe, expect, it, vi } from "vitest";

import { isProType } from "@/constants/item-types";
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

/**
 * The order the sidebar lists the system types in, which the schema carries no
 * column for. The three Pro types come last — see `TYPE_SLUG_ORDER`.
 */
const SEEDED = [
  "snippets",
  "prompts",
  "commands",
  "notes",
  "links",
  "files",
  "images",
  "books",
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

  it("puts every Pro type after every free one", () => {
    const sorted = [...SEEDED].reverse().map((slug) => type(slug));
    const slugs = sorted.sort(compareItemTypes).map((t) => t.slug);

    const lastFree = Math.max(
      ...slugs.map((slug, index) => (isProType(slug) ? -1 : index)),
    );
    const firstPro = slugs.findIndex((slug) => isProType(slug));

    expect(firstPro).toBeGreaterThan(lastFree);
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
