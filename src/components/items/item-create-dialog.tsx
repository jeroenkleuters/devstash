"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { ItemCreateForm } from "@/components/items/item-create-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { pickerType } from "@/constants/item-types";

interface ItemCreateDialogProps {
  /**
   * Type the picker opens on. The type pages pass their own so the dialog
   * arrives on the type the page is already about; the top bar passes none and
   * gets the first creatable one.
   */
  typeSlug?: string;
  /**
   * The trigger's text. Built here rather than taken as a `ReactNode` because
   * `DialogTrigger asChild` clones what it is given, and the callers include a
   * server component — the button has to be constructed on the client.
   */
  label?: string;
}

/**
 * The create dialog, opened either from the top bar or from a type page.
 *
 * Controlled, so the form can close it once the item exists. Radix unmounts the
 * content on close, which is what makes the next open start on an empty form
 * rather than on the last one — the same reason the change-password dialog
 * needs no reset of its own. That unmount is also what re-applies `typeSlug`,
 * so the picker returns to the page's type after a create.
 */
export function ItemCreateDialog({
  typeSlug,
  label = "New Item",
}: ItemCreateDialogProps) {
  const [open, setOpen] = useState(false);

  // Only preselects a type the picker actually knows; anything else falls
  // through to the form's own default rather than selecting nothing.
  const selected = typeSlug ? pickerType(typeSlug) : undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" aria-label={label}>
          <Plus aria-hidden />
          <span className="action-label">{label}</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="item-create-dialog">
        <DialogHeader>
          <DialogTitle>
            {selected ? `New ${selected.label.toLowerCase()}` : "New item"}
          </DialogTitle>
          <DialogDescription>
            {selected
              ? "Fill in what it needs, or switch to another type."
              : "Pick a type, then fill in what it needs."}
          </DialogDescription>
        </DialogHeader>

        <ItemCreateForm
          initialTypeSlug={selected?.slug}
          onCreated={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
