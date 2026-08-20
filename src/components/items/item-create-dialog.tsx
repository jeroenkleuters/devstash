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

/**
 * The top bar's "New Item" button and the dialog it opens.
 *
 * Controlled, so the form can close it once the item exists. Radix unmounts the
 * content on close, which is what makes the next open start on an empty form
 * rather than on the last one — the same reason the change-password dialog
 * needs no reset of its own.
 */
export function ItemCreateDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" aria-label="New Item">
          <Plus aria-hidden />
          <span className="dashboard-topbar-action-label">New Item</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="item-create-dialog">
        <DialogHeader>
          <DialogTitle>New item</DialogTitle>
          <DialogDescription>
            Pick a type, then fill in what it needs.
          </DialogDescription>
        </DialogHeader>

        <ItemCreateForm onCreated={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
