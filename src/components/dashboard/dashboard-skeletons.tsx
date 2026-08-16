import { Clock, Pin } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Suspense fallbacks for the four dashboard sections. Each one reuses the real
 * component's classes for its box model and only replaces the parts that depend
 * on data, so the section keeps its size while the query is in flight.
 */

const STAT_CARD_COUNT = 4;
/** Matches RECENT_COLLECTION_LIMIT in `collections-section.tsx`. */
const COLLECTION_CARD_COUNT = 6;
/** A guess — the pinned count isn't known until the query returns. */
const PINNED_ITEM_COUNT = 2;
/** Matches RECENT_ITEM_LIMIT in `recent-items-section.tsx`. */
const RECENT_ITEM_COUNT = 10;

function placeholders(count: number) {
  return Array.from({ length: count }, (_, index) => index);
}

export function StatCardsSkeleton() {
  return (
    <ul className="stat-cards" aria-busy="true">
      {placeholders(STAT_CARD_COUNT).map((index) => (
        <li key={index} className="stat-card">
          <Skeleton className="stat-card-icon" />
          <span className="stat-card-value">
            <Skeleton className="skeleton-line skeleton-stat-value" />
          </span>
          <span className="stat-card-label">
            <Skeleton className="skeleton-line skeleton-stat-label" />
          </span>
        </li>
      ))}
    </ul>
  );
}

export function CollectionsSectionSkeleton() {
  return (
    <section className="dashboard-section">
      <h2 className="dashboard-section-title">Collections</h2>
      <ul className="collection-grid" aria-busy="true">
        {placeholders(COLLECTION_CARD_COUNT).map((index) => (
          <li key={index}>
            <div className="collection-card">
              <h3 className="collection-card-name">
                <Skeleton className="skeleton-line skeleton-collection-name" />
              </h3>
              <p className="collection-card-count">
                <Skeleton className="skeleton-line skeleton-collection-count" />
              </p>
              <p className="collection-card-description">
                <Skeleton className="skeleton-line" />
              </p>
              <p className="collection-card-types">
                {placeholders(3).map((iconIndex) => (
                  <Skeleton key={iconIndex} className="skeleton-type-icon" />
                ))}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PinnedItemsSectionSkeleton() {
  return (
    <section className="dashboard-section">
      <h2 className="dashboard-section-title">
        <Pin size={16} aria-hidden />
        Pinned
      </h2>
      <ItemListSkeleton count={PINNED_ITEM_COUNT} />
    </section>
  );
}

export function RecentItemsSectionSkeleton() {
  return (
    <section className="dashboard-section">
      <h2 className="dashboard-section-title">
        <Clock size={16} aria-hidden />
        Recent
      </h2>
      <ItemListSkeleton count={RECENT_ITEM_COUNT} />
    </section>
  );
}

function ItemListSkeleton({ count }: { count: number }) {
  return (
    <ul className="item-list" aria-busy="true">
      {placeholders(count).map((index) => (
        <li key={index} className="item-card">
          <Skeleton className="item-card-icon" />

          <div className="item-card-body">
            <h3 className="item-card-title">
              <Skeleton className="skeleton-line skeleton-item-title" />
            </h3>
            <p className="item-card-description">
              <Skeleton className="skeleton-line skeleton-item-description" />
            </p>
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
