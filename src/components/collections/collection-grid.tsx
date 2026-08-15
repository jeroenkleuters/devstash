import { CollectionCard } from "@/components/collections/collection-card";
import type { CollectionSummary } from "@/lib/db/collections";

interface CollectionGridProps {
  collections: CollectionSummary[];
}

export function CollectionGrid({ collections }: CollectionGridProps) {
  if (collections.length === 0) {
    return <p className="dashboard-empty">No collections yet.</p>;
  }

  return (
    <ul className="collection-grid">
      {collections.map((collection) => (
        <CollectionCard key={collection.id} collection={collection} />
      ))}
    </ul>
  );
}
