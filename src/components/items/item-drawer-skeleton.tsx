import { Skeleton } from "@/components/ui/skeleton";

/**
 * Stands in for the drawer's body while `/api/items/[id]` answers. The header
 * and the action bar are not here: the card already carried the title, type and
 * flags, so they paint on click and only what the fetch adds is a placeholder.
 */
export function ItemDrawerSkeleton() {
  return (
    <div className="item-drawer-body" aria-busy="true">
      <section className="item-drawer-section">
        <h3 className="item-drawer-label">Description</h3>
        <div className="item-drawer-text">
          <Skeleton className="skeleton-line skeleton-drawer-description" />
        </div>
      </section>

      <section className="item-drawer-section">
        <h3 className="item-drawer-label">Content</h3>
        <Skeleton className="skeleton-drawer-content" />
      </section>
    </div>
  );
}
