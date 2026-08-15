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
  "files",
  "images",
  "links",
];

/** Sorts by `TYPE_SLUG_ORDER`, unknown slugs last and then alphabetically. */
export function compareItemTypes(a: ItemTypeSummary, b: ItemTypeSummary) {
  const rankA = TYPE_SLUG_ORDER.indexOf(a.slug);
  const rankB = TYPE_SLUG_ORDER.indexOf(b.slug);

  if (rankA === rankB) return a.name.localeCompare(b.name);
  if (rankA === -1) return 1;
  if (rankB === -1) return -1;

  return rankA - rankB;
}
