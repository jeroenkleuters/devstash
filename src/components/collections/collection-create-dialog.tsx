"use client";

import { FolderPlus } from "lucide-react";
import { useState } from "react";

import { CollectionForm } from "@/components/collections/collection-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface CollectionCreateDialogProps {
  /**
   * The trigger's text. Built here rather than taken as a `ReactNode` because
   * `DialogTrigger asChild` clones what it is given, and the caller is a server
   * component — the button has to be constructed on the client.
   */
  label?: string;
}

/**
 * The "New Collection" dialog, opened from the top bar.
 *
 * Controlled, so the form can close it once the collection exists. Radix
 * unmounts the content on close, which is what makes the next open start on an
 * empty form rather than on the last one — the same reason the item create
 * dialog needs no reset of its own.
 */
export function CollectionCreateDialog({
  label = "New Collection",
}: CollectionCreateDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" aria-label={label}>
          <FolderPlus aria-hidden />
          <span className="action-label">{label}</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="collection-create-dialog">
        <DialogHeader>
          <DialogTitle>New collection</DialogTitle>
          <DialogDescription>
            Group items of any type together. You can add items to it later.
          </DialogDescription>
        </DialogHeader>

        <CollectionForm onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
