import { CollectionGrid } from "@/components/collections/collection-grid";
import { collections } from "@/lib/mock-data";

const RECENT_COLLECTION_LIMIT = 6;

export function CollectionsSection() {
  const recentCollections = [...collections]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, RECENT_COLLECTION_LIMIT);

  return (
    <section className="dashboard-section">
      <h2 className="dashboard-section-title">Collections</h2>
      <CollectionGrid collections={recentCollections} />
    </section>
  );
}
