import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { SIGN_IN_PATH } from "@/auth.config";
import { ItemListSkeleton } from "@/components/items/item-list-skeleton";
import { TypeItems } from "@/components/items/type-items";
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

  return (
    <>
      <div className="dashboard-heading">
        <h1>{label}</h1>
        <p>All your {label.toLowerCase()}</p>
      </div>

      <section className="dashboard-section">
        {/* Its own boundary: the heading above needs only the type query, so it
            paints while the items resolve. */}
        <Suspense fallback={<ItemListSkeleton count={ITEM_SKELETON_COUNT} />}>
          <TypeItems
            userId={user.id}
            typeId={itemType.id}
            label={label.toLowerCase()}
          />
        </Suspense>
      </section>
    </>
  );
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
