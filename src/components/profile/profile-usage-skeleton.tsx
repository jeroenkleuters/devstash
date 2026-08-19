import { Skeleton } from "@/components/ui/skeleton";

/** The seven system types, so the list keeps its size as the counts land. */
const TYPE_ROW_COUNT = 7;

function placeholders(count: number) {
  return Array.from({ length: count }, (_, index) => index);
}

/**
 * Suspense fallback for `ProfileUsage`. Reuses the real classes for its box
 * model, as the dashboard skeletons do, so only the blocks standing in for
 * content need sizing.
 */
export function ProfileUsageSkeleton() {
  return (
    <section className="dashboard-section">
      <h2 className="dashboard-section-title">Usage</h2>

      <ul className="stat-cards profile-usage-totals" aria-busy="true">
        {placeholders(2).map((index) => (
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

      <h3 className="profile-subheading">By type</h3>

      <ul className="profile-type-list" aria-busy="true">
        {placeholders(TYPE_ROW_COUNT).map((index) => (
          <li key={index} className="profile-type">
            <Skeleton className="profile-type-icon" />
            <span className="profile-type-name">
              <Skeleton className="skeleton-line skeleton-profile-type-name" />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
