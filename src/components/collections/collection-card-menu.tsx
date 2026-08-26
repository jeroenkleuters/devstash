"use client";

import { MoreHorizontal, Pencil, Star, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import { CollectionDeleteDialog } from "@/components/collections/collection-delete-dialog";
import { CollectionEditDialog } from "@/components/collections/collection-edit-dialog";
import type { CollectionFormCollection } from "@/components/collections/collection-form";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Favorite renders for the layout and says why it is inert, as the drawer's does. */
const SOON = "Coming soon";

interface CollectionCardMenuProps {
  collection: CollectionFormCollection;
}

/**
 * A collection card's three-dots menu: Edit, Delete and (not yet) Favorite.
 *
 * A sibling of the card's stretched link rather than a child of it — a button
 * cannot nest in an anchor, and the `z-index` on it is what puts this one on
 * top. The menu itself is portaled to `body`, so nothing inside it can reach
 * the link underneath and no `stopPropagation` is involved.
 */
export function CollectionCardMenu({ collection }: CollectionCardMenuProps) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Set when a menu item is opening a dialog. Radix returns focus to the
  // trigger as the menu closes, which lands in the same commit as the dialog
  // mounting and takes the focus straight back out of it.
  const openingDialog = useRef(false);

  function open(setter: (open: boolean) => void) {
    openingDialog.current = true;
    setter(true);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="collection-card-menu"
          aria-label={`Actions for ${collection.name}`}
        >
          <MoreHorizontal size={16} aria-hidden />
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          onCloseAutoFocus={(event) => {
            if (openingDialog.current) {
              event.preventDefault();
              openingDialog.current = false;
            }
          }}
        >
          <DropdownMenuItem disabled title={SOON}>
            <Star aria-hidden />
            Favorite
          </DropdownMenuItem>

          <DropdownMenuItem onSelect={() => open(setEditing)}>
            <Pencil aria-hidden />
            Edit
          </DropdownMenuItem>

          <DropdownMenuItem
            variant="destructive"
            onSelect={() => open(setDeleting)}
          >
            <Trash2 aria-hidden />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Outside the menu: a dialog rendered inside one is unmounted along with
          it the moment an item is selected. */}
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
      />
    </>
  );
}
