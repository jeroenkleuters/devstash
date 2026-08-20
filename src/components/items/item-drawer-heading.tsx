"use client";

import { Badge } from "@/components/ui/badge";
import { SheetTitle } from "@/components/ui/sheet";
import { TYPE_ICONS } from "@/constants/item-types";
import type { ItemTypeSummary } from "@/lib/db/item-types";

interface ItemDrawerHeadingProps {
  title: string;
  type: ItemTypeSummary;
  /** Absent while the detail loads, and for the types that have no language. */
  language: string | null;
}

/**
 * The icon, title and type badges at the top of the drawer.
 *
 * Shared because view mode and edit mode render their own `SheetHeader` — the
 * heading is the half that does not change between them, and `SheetTitle` has
 * to be present in both for Radix's labelling.
 */
export function ItemDrawerHeading({
  title,
  type,
  language,
}: ItemDrawerHeadingProps) {
  const Icon = TYPE_ICONS[type.icon];

  return (
    <div className="item-drawer-heading" data-type={type.slug}>
      <span className="item-drawer-icon">
        {Icon && <Icon size={20} aria-hidden />}
      </span>

      <div className="item-drawer-heading-text">
        <SheetTitle className="item-drawer-title">{title}</SheetTitle>

        <div className="item-drawer-badges">
          <Badge variant="secondary">{type.name}</Badge>
          {language && <Badge variant="secondary">{language}</Badge>}
        </div>
      </div>
    </div>
  );
}
