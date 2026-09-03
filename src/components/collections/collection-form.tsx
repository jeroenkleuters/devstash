"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { createCollection, updateCollection } from "@/actions/collections";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UNREACHABLE } from "@/constants/messages";
import { firstIssueMessage } from "@/lib/validations/auth";
import {
  createCollectionSchema,
  updateCollectionSchema,
} from "@/lib/validations/collection";

/** The metadata both dialogs edit — every column a collection form writes. */
export interface CollectionFormCollection {
  id: string;
  name: string;
  description: string | null;
}

interface CollectionFormProps {
  /**
   * The collection being edited, or nothing at all to create a new one.
   *
   * One component rather than two: the create and edit dialogs write the same
   * two fields under the same rules, so a second form would be the first one
   * copied with a different action at the bottom — and free to drift from it.
   */
  collection?: CollectionFormCollection;
  /** Fires once the write lands, for the dialog to close. */
  onDone: () => void;
}

/** The collection dialogs' form: a name and an optional description. */
export function CollectionForm({ collection, onDone }: CollectionFormProps) {
  const [name, setName] = useState(collection?.name ?? "");
  const [description, setDescription] = useState(collection?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  // Both dialogs can be mounted at once — a card's menu holds its own edit
  // dialog while the top bar holds the create one — so the field ids have to be
  // unique per instance rather than per component.
  const fieldId = useId();

  const editing = collection !== undefined;

  // The name is the one field a collection cannot be stored without. The schema
  // says so too, but an obviously dead button beats a round trip that comes
  // back with a message.
  const canSave = name.trim() !== "" && !saving;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) return;

    const payload = { name, description };

    // The same schema the action enforces, run here for the message alone. The
    // server parses the payload again — this copy is a convenience the client
    // controls, so it cannot be the rule.
    const schema = editing ? updateCollectionSchema : createCollectionSchema;
    const parsed = schema.safeParse(payload);

    if (!parsed.success) {
      const message = firstIssueMessage(parsed.error);

      // Toasted as well as shown inline: the inline slot is at the top of a
      // body that scrolls, so on a long form it can be off-screen when the
      // submit button is not. Every refused create says why somewhere visible.
      setError(message);
      toast.error(message);
      return;
    }

    setSaving(true);
    setError(null);

    // The action answers a failed *write* with `{ success: false }`, but a
    // failed *request* rejects instead. Without this the rejection is unhandled
    // and `saving` never clears, leaving the form permanently unsubmittable.
    const result = await (collection
      ? updateCollection(collection.id, payload)
      : createCollection(payload)
    ).catch(() => null);

    if (!result?.success) {
      const message = result?.error ?? UNREACHABLE;

      setSaving(false);
      setError(message);
      toast.error(message);
      return;
    }

    toast.success(editing ? "Collection updated" : "Collection created");

    // The dashboard's grid, the sidebar's two lists, the collection stat cards
    // and the page heading are all server-rendered, so they only show the write
    // on a refetch.
    router.refresh();

    // No `setSaving(false)`: the dialog closes on this call, and Radix unmounts
    // the form along with its state.
    onDone();
  }

  return (
    <form className="collection-form" onSubmit={handleSubmit}>
      {error && (
        <p className="collection-form-error" role="alert">
          {error}
        </p>
      )}

      <div className="collection-form-field">
        <Label htmlFor={`${fieldId}-name`}>Name</Label>
        <Input
          id={`${fieldId}-name`}
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          autoFocus
        />
      </div>

      <div className="collection-form-field">
        <Label htmlFor={`${fieldId}-description`}>Description</Label>
        <Textarea
          id={`${fieldId}-description`}
          name="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
        />
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={saving}>
            Cancel
          </Button>
        </DialogClose>

        <Button type="submit" disabled={!canSave}>
          {saving
            ? editing
              ? "Saving…"
              : "Creating…"
            : editing
              ? "Save changes"
              : "Create collection"}
        </Button>
      </DialogFooter>
    </form>
  );
}
