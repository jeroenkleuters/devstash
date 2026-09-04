import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Boxes } from "lucide-react";

import { SIGN_IN_PATH } from "@/auth.config";
import { FavoritesList } from "@/components/favorites/favorites-list";
import { getAllItems } from "@/lib/db/items";
import { getCurrentUser } from "@/lib/db/user";

// Reads the session and the user's items on every request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Items · DevSquirrel" };

/**
 * Every item the account owns, in one scan list.
 *
 * The same shape as `/favorites` down to the components, which is what the
 * sort control comes from — `FavoritesList` takes both lists and leaves out a
 * section with nothing in it, so passing no collections gives the items panel
 * alone rather than needing a second component.
 *
 * No Suspense boundary and no pagination, for the same reason the favorites
 * page has neither: the count in the heading comes out of the read itself, so
 * a boundary would wrap the whole page, and the sort is client-side over the
 * full list rather than over a page of it. That makes this the app's one
 * unbounded item listing.
 */
export default async function ItemsPage() {
  const user = await getCurrentUser();

  // The proxy already turns an anonymous request away, so this covers what it
  // cannot: a token that still verifies against an account that is gone.
  if (!user) {
    redirect(SIGN_IN_PATH);
  }

  const items = await getAllItems(user.id);

  return (
    <>
      <div className="dashboard-heading">
        <h1 className="favorites-title">
          <Boxes className="items-title-icon" size={26} aria-hidden />
          Items
          <span className="favorites-title-count">({items.length})</span>
        </h1>
      </div>

      {items.length === 0 ? (
        <p className="favorites-empty">
          Nothing saved yet. Add an item and it will show up here.
        </p>
      ) : (
        <FavoritesList items={items} collections={[]} />
      )}
    </>
  );
}
