import { CollectionCard } from "@/components/collections/collection-card";
import type { Collection } from "@/lib/mock-data";

interface CollectionGridProps {
  collections: Collection[];
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
