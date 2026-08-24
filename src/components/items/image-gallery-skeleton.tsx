import { Skeleton } from "@/components/ui/skeleton";

interface ImageGallerySkeletonProps {
  count: number;
}

/**
 * Suspense fallback for `ImageGallery`. Reuses the real card's classes for its
 * box model — including the thumbnail's aspect ratio — so the grid keeps its
 * shape and column count while the query is in flight.
 */
export function ImageGallerySkeleton({ count }: ImageGallerySkeletonProps) {
  return (
    <ul className="image-gallery" aria-busy="true">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="image-card">
          <Skeleton className="image-card-thumb" />

          <div className="image-card-body">
            <h3 className="image-card-title">
              <Skeleton className="skeleton-line skeleton-item-title" />
            </h3>

            {/* A `span`, not the real `time` — an empty one carries no date. */}
            <span className="image-card-date">
              <Skeleton className="skeleton-line skeleton-item-date" />
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
