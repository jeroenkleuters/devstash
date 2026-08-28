import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Star } from "lucide-react";

import { SIGN_IN_PATH } from "@/auth.config";
import { FavoriteCollectionRow } from "@/components/favorites/favorite-collection-row";
import { FavoriteItemRow } from "@/components/favorites/favorite-item-row";
import { FavoriteSection } from "@/components/favorites/favorite-section";
import { getFavoriteCollections } from "@/lib/db/collections";
import { getFavoriteItems } from "@/lib/db/items";
import { getCurrentUser } from "@/lib/db/user";

// Reads the session and the user's favorites on every request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Favorites · DevStash" };

/**
 * Everything the user has starred, items above collections.
 *
 * No Suspense boundary, unlike the listing pages: every number here — the total
 * in the heading and both section counts — comes out of the two reads
 * themselves, so a boundary would wrap the entire page and there would be
 * nothing left to paint ahead of it. The sidebar keeps its own boundary in
 * `AppShell`, so the shell is unaffected.
 */
export default async function FavoritesPage() {
  const user = await getCurrentUser();

  // The proxy already turns an anonymous request away, so this covers what it
  // cannot: a token that still verifies against an account that is gone.
  if (!user) {
    redirect(SIGN_IN_PATH);
  }

  const [items, collections] = await Promise.all([
    getFavoriteItems(user.id),
    // A filter over the cached collection read the sidebar is already running,
    // so this costs no query of its own.
    getFavoriteCollections(user.id),
  ]);

  const total = items.length + collections.length;

  return (
    <>
      <div className="dashboard-heading">
        <h1 className="favorites-title">
          <Star
            className="favorites-title-star"
            size={26}
            fill="currentColor"
            aria-hidden
          />
          Favorites
          <span className="favorites-title-count">({total})</span>
        </h1>
      </div>

      {total === 0 ? (
        <p className="favorites-empty">
          Nothing favorited yet. Star an item or a collection and it will show
          up here.
        </p>
      ) : (
        <div className="favorites-sections">
          {/* A section with nothing in it is left out rather than rendered as
              an empty panel — the same call `PinnedItemsSection` makes. */}
          {items.length > 0 && (
            <FavoriteSection title="Items" count={items.length}>
              {items.map((item) => (
                <FavoriteItemRow key={item.id} item={item} />
              ))}
            </FavoriteSection>
          )}

          {collections.length > 0 && (
            <FavoriteSection title="Collections" count={collections.length}>
              {collections.map((collection) => (
                <FavoriteCollectionRow
                  key={collection.id}
                  collection={collection}
                />
              ))}
            </FavoriteSection>
          )}
        </div>
      )}
    </>
  );
}
