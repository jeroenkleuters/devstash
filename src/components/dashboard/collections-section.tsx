import { CollectionGrid } from "@/components/collections/collection-grid";
import { getRecentCollections } from "@/lib/db/collections";
import { getCurrentUserId } from "@/lib/db/user";

const RECENT_COLLECTION_LIMIT = 6;

export async function CollectionsSection() {
  const userId = await getCurrentUserId();
  const recentCollections = userId
    ? await getRecentCollections(userId, RECENT_COLLECTION_LIMIT)
    : [];

  return (
    <section className="dashboard-section">
      <h2 className="dashboard-section-title">Collections</h2>
      <CollectionGrid collections={recentCollections} />
    </section>
  );
}
