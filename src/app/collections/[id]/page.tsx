import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { SIGN_IN_PATH } from "@/auth.config";
import { ItemList } from "@/components/items/item-list";
import { ItemListSkeleton } from "@/components/items/item-list-skeleton";
import { TYPE_ICONS } from "@/constants/item-types";
import { getCollection } from "@/lib/db/collections";
import { getCollectionItems } from "@/lib/db/items";
import { getCurrentUser } from "@/lib/db/user";

// Reads the session and one user's rows on every request.
export const dynamic = "force-dynamic";

/** A guess — the real count isn't known until the query returns. */
const ITEM_SKELETON_COUNT = 6;

export async function generateMetadata({
  params,
}: PageProps<"/collections/[id]">): Promise<Metadata> {
  const [{ id }, user] = await Promise.all([params, getCurrentUser()]);
  const collection = user ? await getCollection(user.id, id) : null;

  return {
    title: collection ? `${collection.name} · DevStash` : "DevStash",
  };
}

export default async function CollectionPage({
  params,
}: PageProps<"/collections/[id]">) {
  const [{ id }, user] = await Promise.all([params, getCurrentUser()]);

  // The proxy already turns an anonymous request away, so this covers what it
  // cannot: a token that still verifies against an account that is gone.
  if (!user) {
    redirect(SIGN_IN_PATH);
  }

  const collection = await getCollection(user.id, id);

  // Covers both "no such collection" and "not yours" — the query does not tell
  // them apart, so an id nobody may see is never confirmed to exist.
  if (!collection) {
    notFound();
  }

  return (
    <>
      <div className="dashboard-heading">
        <h1>{collection.name}</h1>
        <p>
          {collection.description ??
            `${collection.itemCount} ${
              collection.itemCount === 1 ? "item" : "items"
            } in this collection`}
        </p>

        {collection.types.length > 0 && (
          <p className="collection-heading-types">
            {collection.types.map((type) => {
              const Icon = TYPE_ICONS[type.icon];

              return Icon ? (
                <Icon
                  key={type.id}
                  className="collection-card-type-icon"
                  data-type={type.slug}
                  size={14}
                  aria-hidden
                />
              ) : null;
            })}
          </p>
        )}
      </div>

      <section className="dashboard-section">
        {/* Its own boundary: the heading above needs only the collection query,
            so it paints while the items resolve. */}
        <Suspense fallback={<ItemListSkeleton count={ITEM_SKELETON_COUNT} />}>
          <CollectionItems userId={user.id} collectionId={collection.id} />
        </Suspense>
      </section>
    </>
  );
}

async function CollectionItems({
  userId,
  collectionId,
}: {
  userId: string;
  collectionId: string;
}) {
  // A collection mixes item types, so the gallery and file-row layouts
  // `/items/[type]` picks between cannot apply — one list has to render them
  // all, which is the same reason the dashboard's Recent list does.
  const items = await getCollectionItems(userId, collectionId);

  return <ItemList items={items} emptyMessage="No items in this collection." />;
}
