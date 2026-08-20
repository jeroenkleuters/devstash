import { Skeleton } from "@/components/ui/skeleton";

interface ItemListSkeletonProps {
  count: number;
}

/**
 * Suspense fallback for `ItemList`. Reuses the real card's classes for its box
 * model and only replaces the parts that depend on data, so the list keeps its
 * size — and its column count — while the query is in flight.
 */
export function ItemListSkeleton({ count }: ItemListSkeletonProps) {
  return (
    <ul className="item-list" aria-busy="true">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="item-card">
          <Skeleton className="item-card-icon" />

          <div className="item-card-body">
            <h3 className="item-card-title">
              <Skeleton className="skeleton-line skeleton-item-title" />
            </h3>
            {/* `div`, not the `p` the real card uses: the skeleton primitive
                renders a `div`, and a `p` may not contain one. */}
            <div className="item-card-description">
              <Skeleton className="skeleton-line skeleton-item-description" />
            </div>
          </div>

          {/* A `span`, not the real `time` — an empty one carries no date. */}
          <span className="item-card-date">
            <Skeleton className="skeleton-line skeleton-item-date" />
          </span>
        </li>
      ))}
    </ul>
  );
}
