import { Skeleton } from "@/components/ui/skeleton";

interface FileListSkeletonProps {
  count: number;
}

/**
 * Suspense fallback for `FileList`. Reuses the real row's classes for its box
 * model and only replaces the parts that depend on data, so the list keeps its
 * size while the query is in flight.
 */
export function FileListSkeleton({ count }: FileListSkeletonProps) {
  return (
    <ul className="file-list" aria-busy="true">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="file-row">
          <Skeleton className="file-row-icon" />

          <div className="file-row-body">
            {/* `div`s, not the `h3`/`p` the real row uses: the skeleton
                primitive renders a `div`, and a `p` may not contain one. */}
            <div className="file-row-name">
              <Skeleton className="skeleton-line skeleton-file-name" />
            </div>
            <div className="file-row-subtitle">
              <Skeleton className="skeleton-line skeleton-item-title" />
            </div>
          </div>

          <span className="file-row-size">
            <Skeleton className="skeleton-line skeleton-file-size" />
          </span>

          {/* A `span`, not the real `time` — an empty one carries no date. */}
          <span className="file-row-date">
            <Skeleton className="skeleton-line skeleton-item-date" />
          </span>

          <Skeleton className="file-row-download" />
        </li>
      ))}
    </ul>
  );
}
