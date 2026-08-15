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
