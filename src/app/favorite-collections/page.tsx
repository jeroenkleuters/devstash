import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SIGN_IN_PATH } from "@/auth.config";
import { CollectionGrid } from "@/components/collections/collection-grid";
import { getFavoriteCollections } from "@/lib/db/collections";
import { getCurrentUser } from "@/lib/db/user";

// Reads the session and the user's collections on every request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Favorite collections · DevSquirrel" };

/**
 * The starred collections, as the same card grid `/collections` renders.
 *
 * Unpaginated and with no Suspense boundary, which is where this parts company
 * with the page it reuses: `getFavoriteCollections` is a filter over the cached
 * read the sidebar is already running, so it costs no query of its own and
 * there is nothing to stream — and a stash has few favorites, so there is
 * nothing to page through either.
 */
export default async function FavoriteCollectionsPage() {
  const user = await getCurrentUser();

  // The proxy already turns an anonymous request away, so this covers what it
  // cannot: a token that still verifies against an account that is gone.
  if (!user) {
    redirect(SIGN_IN_PATH);
  }

  const collections = await getFavoriteCollections(user.id);

  return (
    <>
      <div className="dashboard-heading">
        <h1>Favorite collections</h1>
        <p>Every collection you have starred</p>
      </div>

      <section className="dashboard-section">
        {collections.length === 0 ? (
          <p className="favorites-empty">
            No favorite collections yet. Star one and it will show up here.
          </p>
        ) : (
          <CollectionGrid collections={collections} />
        )}
      </section>
    </>
  );
}
