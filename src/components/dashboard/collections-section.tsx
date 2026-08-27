import { CollectionGrid } from "@/components/collections/collection-grid";
import { DASHBOARD_COLLECTIONS_LIMIT } from "@/constants/pagination";
import { getRecentCollections } from "@/lib/db/collections";
import { getCurrentUserId } from "@/lib/db/user";

export async function CollectionsSection() {
  const userId = await getCurrentUserId();
  const recentCollections = userId
    ? await getRecentCollections(userId, DASHBOARD_COLLECTIONS_LIMIT)
    : [];

  return (
    <section className="dashboard-section">
      <h2 className="dashboard-section-title">Collections</h2>
      <CollectionGrid collections={recentCollections} />
    </section>
  );
}
