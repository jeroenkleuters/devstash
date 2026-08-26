"use client";

import {
  CollectionForm,
  type CollectionFormCollection,
} from "@/components/collections/collection-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CollectionEditDialogProps {
  collection: CollectionFormCollection;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Edits a collection's metadata.
 *
 * Carries no trigger of its own: one of its two callers opens it from a
 * dropdown item, and a `DialogTrigger` inside a menu goes with the menu when it
 * closes on select — so both callers own the open state and render their own
 * button instead.
 *
 * Radix unmounts the content on close, which is what makes the next open start
 * from the stored values rather than from a half-finished edit.
 */
export function CollectionEditDialog({
  collection,
  open,
  onOpenChange,
}: CollectionEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="collection-create-dialog">
        <DialogHeader>
          <DialogTitle>Edit collection</DialogTitle>
          <DialogDescription>
            Rename this collection or change what it says it holds.
          </DialogDescription>
        </DialogHeader>

        <CollectionForm
          collection={collection}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
