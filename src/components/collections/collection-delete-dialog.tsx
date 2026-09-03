"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { deleteCollection } from "@/actions/collections";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { UNREACHABLE } from "@/constants/messages";

interface CollectionDeleteDialogProps {
  collectionId: string;
  /** Named in the confirmation, so it says which collection is going. */
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Fires once the collection is gone. Absent for a card in a list, which the
   * refresh below takes away on its own; the collection's own page passes one,
   * since its route is a 404 the moment the row goes.
   */
  onDeleted?: () => void;
}

/**
 * Confirms deleting a collection, then deletes it.
 *
 * Carries no trigger of its own, for the reason `CollectionEditDialog` records:
 * one caller opens it from a dropdown item, which unmounts on select.
 */
export function CollectionDeleteDialog({
  collectionId,
  name,
  open,
  onOpenChange,
  onDeleted,
}: CollectionDeleteDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleOpenChange(next: boolean) {
    if (deleting) return;

    // A dismissed dialog should not come back carrying the last failure.
    if (!next) {
      setError(null);
    }

    onOpenChange(next);
  }

  async function handleDelete() {
    if (deleting) return;

    setDeleting(true);
    setError(null);

    // The action answers a failed *delete* with `{ success: false }`, but a
    // failed *request* — offline, a dropped connection, a deploy mid-flight —
    // rejects instead. Without this the rejection is unhandled, `deleting`
    // never clears, and the dialog is stuck: both buttons disabled and the
    // guard above swallowing Escape, so only a reload gets out.
    const result = await deleteCollection(collectionId).catch(() => null);

    if (!result?.success) {
      const message = result?.error ?? UNREACHABLE;

      setDeleting(false);
      setError(message);
      toast.error(message);
      return;
    }

    onOpenChange(false);
    setDeleting(false);
    toast.success("Collection deleted");

    // The grids, the sidebar's two lists and the stat cards are all
    // server-rendered, so they only drop the collection on a refetch.
    router.refresh();
    onDeleted?.();
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this collection?</AlertDialogTitle>
          <AlertDialogDescription>
            “{name}” is deleted. The items in it are <strong>not</strong> —
            they stay in your stash and simply stop being in this collection.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>
            Keep collection
          </AlertDialogCancel>

          {/* A plain button rather than `AlertDialogAction`, which closes the
              dialog as soon as it is clicked: the delete would then run with
              nothing on screen, and a failure would have nowhere to report
              itself. */}
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete collection"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
