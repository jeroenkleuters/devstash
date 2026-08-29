import { cache } from "react";

import { prisma } from "@/lib/prisma";

/** The item type metadata a card needs to render its icon and color coding. */
export interface ItemTypeSummary {
  id: string;
  /** URL segment used by /items/[type], also the CSS `data-type` value */
  slug: string;
  name: string;
  /** lucide-react icon name */
  icon: string;
}

/** Prisma selection matching `ItemTypeSummary`. */
export const itemTypeSelect = {
  id: true,
  slug: true,
  name: true,
  icon: true,
} as const;

/**
 * Display order for the system types — the schema carries no sort column, so
 * the order the seed writes them in is spelled out here instead.
 */
const TYPE_SLUG_ORDER = [
  "snippets",
  "prompts",
  "commands",
  "notes",
  "links",
  // The Pro types last, so the free ones a visitor can actually use lead the
  // list. Kept in step with `CREATABLE_TYPES`, which the create picker renders
  // in this same order, and with `PRO_TYPE_SLUGS`, which is exactly this tail.
  "files",
  "images",
  "books",
];

/**
 * Resolves a `/items/[type]` URL segment to its type, or null when the segment
 * names no type — which is what makes an unknown slug a 404 rather than an
 * empty list. Only system types are addressable; custom types are post-launch.
 *
 * `cache` memoizes per request so the page and its `generateMetadata` share one
 * query rather than each resolving the same segment.
 */
export const getItemTypeBySlug = cache(
  async (slug: string): Promise<ItemTypeSummary | null> =>
    prisma.itemType.findFirst({
      where: { isSystem: true, slug },
      select: itemTypeSelect,
    }),
);

/** Sorts by `TYPE_SLUG_ORDER`, unknown slugs last and then alphabetically. */
export function compareItemTypes(a: ItemTypeSummary, b: ItemTypeSummary) {
  const rankA = TYPE_SLUG_ORDER.indexOf(a.slug);
  const rankB = TYPE_SLUG_ORDER.indexOf(b.slug);

  if (rankA === rankB) return a.name.localeCompare(b.name);
  if (rankA === -1) return 1;
  if (rankB === -1) return -1;

  return rankA - rankB;
}
