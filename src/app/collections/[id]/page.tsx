import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { SIGN_IN_PATH } from "@/auth.config";
import { CollectionActions } from "@/components/collections/collection-actions";
import { ItemList } from "@/components/items/item-list";
import { ItemListSkeleton } from "@/components/items/item-list-skeleton";
import { Pagination } from "@/components/layout/pagination";
import { TYPE_ICONS } from "@/constants/item-types";
import { ITEMS_PER_PAGE } from "@/constants/pagination";
import { getCollection } from "@/lib/db/collections";
import { countCollectionItems, getCollectionItems } from "@/lib/db/items";
import { getCurrentUser } from "@/lib/db/user";
import { pageCount, parsePageParam, rowsOnPage } from "@/lib/pagination";

// Reads the session and one user's rows on every request.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/collections/[id]">): Promise<Metadata> {
  const [{ id }, user] = await Promise.all([params, getCurrentUser()]);
  const collection = user ? await getCollection(user.id, id) : null;

  return {
    title: collection ? `${collection.name} · CodeSquirrel` : "CodeSquirrel",
  };
}

export default async function CollectionPage({
  params,
  searchParams,
}: PageProps<"/collections/[id]">) {
  const [{ id }, query, user] = await Promise.all([
    params,
    searchParams,
    getCurrentUser(),
  ]);

  // The proxy already turns an anonymous request away, so this covers what it
  // cannot: a token that still verifies against an account that is gone.
  if (!user) {
    redirect(SIGN_IN_PATH);
  }

  const page = parsePageParam(query.page);

  // `?page=` names no page — a wrong URL, like an id naming no collection.
  if (page === null) {
    notFound();
  }

  const collection = await getCollection(user.id, id);

  // Covers both "no such collection" and "not yours" — the query does not tell
  // them apart, so an id nobody may see is never confirmed to exist.
  if (!collection) {
    notFound();
  }

  // Counted here rather than inside the boundary, so a page past the end is a
  // 404 before anything has flushed. `cache` keeps it to one query per request.
  const totalCount = await countCollectionItems(user.id, collection.id);
  const totalPages = pageCount(totalCount, ITEMS_PER_PAGE);

  if (page > totalPages) {
    notFound();
  }

  return (
    <>
      <div className="dashboard-heading dashboard-heading-row">
        <div>
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

        <CollectionActions
          collection={{
            id: collection.id,
            name: collection.name,
            description: collection.description,
          }}
          isFavorite={collection.isFavorite}
        />
      </div>

      <section className="dashboard-section">
        {/* Its own boundary: the heading above needs only the collection query,
            so it paints while the items resolve. Keyed on the page so stepping
            to another one suspends again rather than holding the old rows. */}
        <Suspense
          key={page}
          fallback={
            <ItemListSkeleton
              count={rowsOnPage(totalCount, page, ITEMS_PER_PAGE)}
            />
          }
        >
          <CollectionItems
            userId={user.id}
            collectionId={collection.id}
            page={page}
          />
        </Suspense>

        {/* Outside the boundary — the count is already known, so the controls
            paint with the heading rather than waiting on the rows. */}
        <Pagination
          page={page}
          totalPages={totalPages}
          basePath={`/collections/${collection.id}`}
        />
      </section>
    </>
  );
}

async function CollectionItems({
  userId,
  collectionId,
  page,
}: {
  userId: string;
  collectionId: string;
  page: number;
}) {
  // A collection mixes item types, so the gallery and file-row layouts
  // `/items/[type]` picks between cannot apply — one list has to render them
  // all, which is the same reason the dashboard's Recent list does.
  const items = await getCollectionItems(userId, collectionId, page);

  return <ItemList items={items} emptyMessage="No items in this collection." />;
}
