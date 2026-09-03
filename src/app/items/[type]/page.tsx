import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { SIGN_IN_PATH } from "@/auth.config";
import { FileListSkeleton } from "@/components/items/file-list-skeleton";
import { ImageGallerySkeleton } from "@/components/items/image-gallery-skeleton";
import { ItemCreateDialog } from "@/components/items/item-create-dialog";
import { ItemDropZone } from "@/components/items/item-drop-zone";
import { ItemListSkeleton } from "@/components/items/item-list-skeleton";
import {
  itemsLayoutFor,
  TypeItems,
  type ItemsLayout,
} from "@/components/items/type-items";
import { Pagination } from "@/components/layout/pagination";
import { uploadKindFor } from "@/constants/item-types";
import { ITEMS_PER_PAGE } from "@/constants/pagination";
import { getItemTypeBySlug } from "@/lib/db/item-types";
import { countItemsByType } from "@/lib/db/items";
import { getCurrentUser } from "@/lib/db/user";
import type { UploadKind } from "@/lib/file-constraints";
import { pageCount, parsePageParam, rowsOnPage } from "@/lib/pagination";

// Reads the session and the user's items on every request.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/items/[type]">): Promise<Metadata> {
  const { type } = await params;
  const itemType = await getItemTypeBySlug(type);

  return {
    title: itemType ? `${typeLabel(itemType.slug)} · CodeSquirrel` : "CodeSquirrel",
  };
}

export default async function ItemsByTypePage({
  params,
  searchParams,
}: PageProps<"/items/[type]">) {
  const [{ type }, query, user] = await Promise.all([
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

  // `?page=` names no page — a wrong URL, like a slug naming no type.
  if (page === null) {
    notFound();
  }

  const itemType = await getItemTypeBySlug(type);

  // The segment is whatever was typed, and it names no type.
  if (!itemType) {
    notFound();
  }

  // Counted here rather than inside the boundary: the page number has to be
  // checked before anything renders, or a 404 would arrive after the heading
  // has already flushed. `cache` keeps it to one query per request.
  const totalCount = await countItemsByType(user.id, itemType.id);
  const totalPages = pageCount(totalCount, ITEMS_PER_PAGE);

  // A page past the end of the list.
  if (page > totalPages) {
    notFound();
  }

  const label = typeLabel(itemType.slug);

  // Resolved once here so the fallback and the items agree on the shape.
  const layout = itemsLayoutFor(itemType.slug);

  // Set only for the two types a file can be dropped on, which is what decides
  // whether the listing is wrapped in a drop target at all.
  const uploadKind = uploadKindFor(itemType.slug);

  return (
    <>
      <div className="dashboard-heading dashboard-heading-row">
        <div>
          <h1>{label}</h1>
          <p>All your {label.toLowerCase()}</p>
        </div>

        {/* `ItemType.name` is the singular, which is what a button wants —
            `label` above is the plural the slug carries. */}
        <ItemCreateDialog
          typeSlug={itemType.slug}
          label={`New ${itemType.name}`}
        />
      </div>

      <section className="dashboard-section">
        {/* Its own boundary: the heading above needs only the type query, so it
            paints while the items resolve. Keyed on the page so stepping to
            another one suspends again rather than holding the old rows. */}
        <DropTarget kind={uploadKind} typeSlug={itemType.slug}>
          <Suspense
            key={page}
            fallback={
              <ItemsSkeleton
                layout={layout}
                count={rowsOnPage(totalCount, page, ITEMS_PER_PAGE)}
              />
            }
          >
            <TypeItems
              userId={user.id}
              typeId={itemType.id}
              label={label.toLowerCase()}
              layout={layout}
              page={page}
            />
          </Suspense>
        </DropTarget>

        {/* Outside the boundary — the count is already known, so the controls
            paint with the heading rather than waiting on the rows. */}
        <Pagination
          page={page}
          totalPages={totalPages}
          basePath={`/items/${itemType.slug}`}
        />
      </section>
    </>
  );
}

/**
 * Wraps the listing in a drop target on the two types that take uploads, and
 * leaves the other five exactly as they were.
 */
function DropTarget({
  kind,
  typeSlug,
  children,
}: {
  kind: UploadKind | undefined;
  typeSlug: string;
  children: ReactNode;
}) {
  if (!kind) {
    return children;
  }

  return (
    <ItemDropZone kind={kind} typeSlug={typeSlug}>
      {children}
    </ItemDropZone>
  );
}

/** The fallback that matches the layout the items will arrive in. */
function ItemsSkeleton({
  layout,
  count,
}: {
  layout: ItemsLayout;
  count: number;
}) {
  switch (layout) {
    case "gallery":
      return <ImageGallerySkeleton count={count} />;
    case "files":
      return <FileListSkeleton count={count} />;
    default:
      return <ItemListSkeleton count={count} />;
  }
}

/**
 * `ItemType.name` is singular ("Snippet") and the schema carries no plural, but
 * the slug is the plural form by seed convention — so the title comes from it.
 */
function typeLabel(slug: string) {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
