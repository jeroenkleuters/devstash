import { Skeleton } from "@/components/ui/skeleton";

interface CollectionGridSkeletonProps {
  count: number;
}

/**
 * Suspense fallback for `CollectionGrid`. Reuses the real card's classes for
 * its box model and only replaces the parts that depend on data, so the grid
 * keeps its size while the query is in flight.
 */
export function CollectionGridSkeleton({ count }: CollectionGridSkeletonProps) {
  return (
    <ul className="collection-grid" aria-busy="true">
      {Array.from({ length: count }, (_, index) => (
        <li key={index}>
          <div className="collection-card">
            <h3 className="collection-card-name">
              <Skeleton className="skeleton-line skeleton-collection-name" />
            </h3>
            {/* `div`, not the `p` the real card uses: the skeleton primitive
                renders a `div`, and a `p` may not contain one. */}
            <div className="collection-card-count">
              <Skeleton className="skeleton-line skeleton-collection-count" />
            </div>
            <div className="collection-card-description">
              <Skeleton className="skeleton-line" />
            </div>
            <div className="collection-card-types">
              {Array.from({ length: 3 }, (_, iconIndex) => (
                <Skeleton key={iconIndex} className="skeleton-type-icon" />
              ))}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
