import type { ReactNode } from "react";

interface FavoriteSectionProps {
  title: string;
  count: number;
  /** The section's sort control, rendered opposite the label. */
  action?: ReactNode;
  children: ReactNode;
}

/**
 * One labelled block of favorites — the label and its count above a panel of
 * hairline-separated rows.
 *
 * The panel is one bordered surface rather than a card per row: a favorites
 * list is meant to be scanned, and card chrome around every line is what makes
 * that slow.
 */
export function FavoriteSection({
  title,
  count,
  action,
  children,
}: FavoriteSectionProps) {
  return (
    <section className="favorite-section">
      <div className="favorite-section-header">
        <h2 className="favorite-section-title">
          {title} <span className="favorite-section-count">({count})</span>
        </h2>

        {action}
      </div>

      <ul className="favorite-list">{children}</ul>
    </section>
  );
}
