"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { deleteItem } from "@/actions/items";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/** Said when the request never reached the action, so it named no reason. */
const UNREACHABLE = "Could not reach the server. Try again.";

interface ItemDeleteDialogProps {
  itemId: string;
  /** Named in the confirmation, so it says which item is going. */
  title: string;
  /** Fires once the item is gone, for the drawer to close and the lists to refresh. */
  onDeleted: () => void;
}

/**
 * The drawer's Delete action and its confirmation.
 *
 * The trigger is the action bar's own button rather than a `Button` variant, so
 * it keeps the bar's box model; only the dialog inside is stock ShadCN.
 */
export function ItemDeleteDialog({
  itemId,
  title,
  onDeleted,
}: ItemDeleteDialogProps) {
  // Controlled, so a failed delete can hold the dialog open to report itself
  // while a successful one closes it before the drawer goes.
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (deleting) return;

    // A dismissed dialog should not come back carrying the last failure.
    if (!next) {
      setError(null);
    }

    setOpen(next);
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
    const result = await deleteItem(itemId).catch(() => null);

    if (!result?.success) {
      const message = result?.error ?? UNREACHABLE;

      setDeleting(false);
      setError(message);
      toast.error(message);
      return;
    }

    // Closing the confirmation before the drawer keeps the two Radix layers
    // unwinding innermost first, since both take `body` out of the pointer
    // event flow while they are open.
    setOpen(false);
    setDeleting(false);
    toast.success("Item deleted");
    onDeleted();
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className="item-drawer-action item-drawer-action-delete"
          aria-label="Delete item"
        >
          <Trash2 size={16} aria-hidden />
        </button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this item?</AlertDialogTitle>
          <AlertDialogDescription>
            “{title}” is removed from every collection it sits in. This cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Keep item</AlertDialogCancel>

          {/* A plain button rather than `AlertDialogAction`, which closes the
              dialog as soon as it is clicked: the delete would then run with
              nothing on screen, and a failure would have nowhere to report
              itself. */}
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete item"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
