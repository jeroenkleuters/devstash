import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Star } from "lucide-react";

import { SIGN_IN_PATH } from "@/auth.config";
import { FavoritesList } from "@/components/favorites/favorites-list";
import { getFavoriteCollections } from "@/lib/db/collections";
import { getFavoriteItems } from "@/lib/db/items";
import { getCurrentUser } from "@/lib/db/user";

// Reads the session and the user's favorites on every request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Favorites · CodeSquirrel" };

/**
 * Everything the user has starred, items above collections.
 *
 * No Suspense boundary, unlike the listing pages: every number here — the total
 * in the heading and both section counts — comes out of the two reads
 * themselves, so a boundary would wrap the entire page and there would be
 * nothing left to paint ahead of it. The sidebar keeps its own boundary in
 * `AppShell`, so the shell is unaffected.
 *
 * The lists themselves are handed to a client component, which is what lets
 * them be reordered without a round trip.
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
        <FavoritesList items={items} collections={collections} />
      )}
    </>
  );
}
