import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SIGN_IN_PATH } from "@/auth.config";
import { CollectionGrid } from "@/components/collections/collection-grid";
import { CollectionGridSkeleton } from "@/components/collections/collection-grid-skeleton";
import { getCollections } from "@/lib/db/collections";
import { getCurrentUser } from "@/lib/db/user";

// Reads the session and the user's collections on every request.
export const dynamic = "force-dynamic";

/** A guess — the real count isn't known until the query returns. */
const COLLECTION_SKELETON_COUNT = 6;

export const metadata: Metadata = { title: "Collections · DevStash" };

export default async function CollectionsPage() {
  const user = await getCurrentUser();

  // The proxy already turns an anonymous request away, so this covers what it
  // cannot: a token that still verifies against an account that is gone.
  if (!user) {
    redirect(SIGN_IN_PATH);
  }

  return (
    <>
      <div className="dashboard-heading">
        <h1>Collections</h1>
        <p>Every collection you have made</p>
      </div>

      <section className="dashboard-section">
        {/* Its own boundary: the heading needs no data, so it paints while the
            collections resolve. */}
        <Suspense
          fallback={<CollectionGridSkeleton count={COLLECTION_SKELETON_COUNT} />}
        >
          <AllCollections userId={user.id} />
        </Suspense>
      </section>
    </>
  );
}

async function AllCollections({ userId }: { userId: string }) {
  // Unsliced, unlike the dashboard's grid — this is the page that shows them all.
  const collections = await getCollections(userId);

  return <CollectionGrid collections={collections} />;
}
