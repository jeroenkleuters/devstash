import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { SIGN_IN_PATH } from "@/auth.config";
import { FileListSkeleton } from "@/components/items/file-list-skeleton";
import { ImageGallerySkeleton } from "@/components/items/image-gallery-skeleton";
import { ItemCreateDialog } from "@/components/items/item-create-dialog";
import { ItemListSkeleton } from "@/components/items/item-list-skeleton";
import {
  itemsLayoutFor,
  TypeItems,
  type ItemsLayout,
} from "@/components/items/type-items";
import { getItemTypeBySlug } from "@/lib/db/item-types";
import { getCurrentUser } from "@/lib/db/user";

// Reads the session and the user's items on every request.
export const dynamic = "force-dynamic";

/** A guess — the real count isn't known until the query returns. */
const ITEM_SKELETON_COUNT = 6;

export async function generateMetadata({
  params,
}: PageProps<"/items/[type]">): Promise<Metadata> {
  const { type } = await params;
  const itemType = await getItemTypeBySlug(type);

  return {
    title: itemType ? `${typeLabel(itemType.slug)} · DevStash` : "DevStash",
  };
}

export default async function ItemsByTypePage({
  params,
}: PageProps<"/items/[type]">) {
  const [{ type }, user] = await Promise.all([params, getCurrentUser()]);

  // The proxy already turns an anonymous request away, so this covers what it
  // cannot: a token that still verifies against an account that is gone.
  if (!user) {
    redirect(SIGN_IN_PATH);
  }

  const itemType = await getItemTypeBySlug(type);

  // The segment is whatever was typed, and it names no type.
  if (!itemType) {
    notFound();
  }

  const label = typeLabel(itemType.slug);

  // Resolved once here so the fallback and the items agree on the shape.
  const layout = itemsLayoutFor(itemType.slug);

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
            paints while the items resolve. */}
        <Suspense fallback={<ItemsSkeleton layout={layout} />}>
          <TypeItems
            userId={user.id}
            typeId={itemType.id}
            label={label.toLowerCase()}
            layout={layout}
          />
        </Suspense>
      </section>
    </>
  );
}

/** The fallback that matches the layout the items will arrive in. */
function ItemsSkeleton({ layout }: { layout: ItemsLayout }) {
  switch (layout) {
    case "gallery":
      return <ImageGallerySkeleton count={ITEM_SKELETON_COUNT} />;
    case "files":
      return <FileListSkeleton count={ITEM_SKELETON_COUNT} />;
    default:
      return <ItemListSkeleton count={ITEM_SKELETON_COUNT} />;
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
