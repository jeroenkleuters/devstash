import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { SIGN_IN_PATH } from "@/auth.config";
import { CollectionGrid } from "@/components/collections/collection-grid";
import { CollectionGridSkeleton } from "@/components/collections/collection-grid-skeleton";
import { Pagination } from "@/components/layout/pagination";
import { COLLECTIONS_PER_PAGE } from "@/constants/pagination";
import { countCollections, getCollectionsPage } from "@/lib/db/collections";
import { getCurrentUser } from "@/lib/db/user";
import { pageCount, parsePageParam, rowsOnPage } from "@/lib/pagination";

// Reads the session and the user's collections on every request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Collections · DevSquirrel" };

export default async function CollectionsPage({
  searchParams,
}: PageProps<"/collections">) {
  const [query, user] = await Promise.all([searchParams, getCurrentUser()]);

  // The proxy already turns an anonymous request away, so this covers what it
  // cannot: a token that still verifies against an account that is gone.
  if (!user) {
    redirect(SIGN_IN_PATH);
  }

  const page = parsePageParam(query.page);

  // `?page=` names no page.
  if (page === null) {
    notFound();
  }

  // Counted here rather than inside the boundary, so a page past the end is a
  // 404 before anything has flushed. `cache` keeps it to one query per request.
  const totalCount = await countCollections(user.id);
  const totalPages = pageCount(totalCount, COLLECTIONS_PER_PAGE);

  if (page > totalPages) {
    notFound();
  }

  return (
    <>
      <div className="dashboard-heading">
        <h1>Collections</h1>
        <p>Every collection you have made</p>
      </div>

      <section className="dashboard-section">
        {/* Its own boundary: the heading needs no data, so it paints while the
            collections resolve. Keyed on the page so stepping to another one
            suspends again rather than holding the old cards. */}
        <Suspense
          key={page}
          fallback={
            <CollectionGridSkeleton
              count={rowsOnPage(totalCount, page, COLLECTIONS_PER_PAGE)}
            />
          }
        >
          <CollectionsOnPage userId={user.id} page={page} />
        </Suspense>

        {/* Outside the boundary — the count is already known, so the controls
            paint with the heading rather than waiting on the cards. */}
        <Pagination
          page={page}
          totalPages={totalPages}
          basePath="/collections"
        />
      </section>
    </>
  );
}

async function CollectionsOnPage({
  userId,
  page,
}: {
  userId: string;
  page: number;
}) {
  // Its own bounded query, not a slice of the cached `getCollections` the
  // sidebar and the dashboard share — that one reads every row the user owns.
  const collections = await getCollectionsPage(userId, page);

  return <CollectionGrid collections={collections} />;
}
