"use client";

import { Pencil, Star, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CollectionDeleteDialog } from "@/components/collections/collection-delete-dialog";
import { CollectionEditDialog } from "@/components/collections/collection-edit-dialog";
import type { CollectionFormCollection } from "@/components/collections/collection-form";
import { Button } from "@/components/ui/button";

/** Favorite renders for the layout and says why it is inert, as the drawer's does. */
const SOON = "Coming soon";

interface CollectionActionsProps {
  collection: CollectionFormCollection;
  /**
   * Reflected on the Favorite button, which stays inert — the toggle is its own
   * feature. Separate from `collection` rather than widening it: that shape is
   * what the edit dialog's form reads, and the form has no favorite field.
   */
  isFavorite: boolean;
}

/**
 * The action row beside a collection page's heading.
 *
 * It owns both dialogs' open state rather than letting them carry triggers, so
 * this and the card's dropdown menu drive the same two components the same way.
 */
export function CollectionActions({
  collection,
  isFavorite,
}: CollectionActionsProps) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  return (
    <div className="collection-actions">
      {/* Still inert, but no longer blind to the state it names: a favorited
          collection shows the button selected, as the drawer's does. */}
      <Button
        variant="outline"
        className="collection-favorite"
        data-active={isFavorite}
        aria-pressed={isFavorite}
        disabled
        title={SOON}
      >
        <Star aria-hidden fill={isFavorite ? "currentColor" : "none"} />
        <span className="action-label">Favorite</span>
      </Button>

      <Button variant="outline" onClick={() => setEditing(true)}>
        <Pencil aria-hidden />
        <span className="action-label">Edit</span>
      </Button>

      <Button variant="destructive" onClick={() => setDeleting(true)}>
        <Trash2 aria-hidden />
        <span className="action-label">Delete</span>
      </Button>

      <CollectionEditDialog
        collection={collection}
        open={editing}
        onOpenChange={setEditing}
      />

      <CollectionDeleteDialog
        collectionId={collection.id}
        name={collection.name}
        open={deleting}
        onOpenChange={setDeleting}
        // This page's route is a 404 the moment the row goes, so it cannot just
        // refresh in place the way a card's menu does.
        onDeleted={() => router.push("/collections")}
      />
    </div>
  );
}
