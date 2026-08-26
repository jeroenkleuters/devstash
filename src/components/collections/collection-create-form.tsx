"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { createCollection } from "@/actions/collections";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { firstIssueMessage } from "@/lib/validations/auth";
import { createCollectionSchema } from "@/lib/validations/collection";

/** Said when the request never reached the action, so it named no reason. */
const UNREACHABLE = "Could not reach the server. Try again.";

interface CollectionCreateFormProps {
  /** Fires once the collection exists, for the dialog to close. */
  onCreated: () => void;
}

/** The "New Collection" dialog's form: a name and an optional description. */
export function CollectionCreateForm({
  onCreated,
}: CollectionCreateFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

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
    const parsed = createCollectionSchema.safeParse(payload);

    if (!parsed.success) {
      setError(firstIssueMessage(parsed.error));
      return;
    }

    setSaving(true);
    setError(null);

    // The action answers a failed *write* with `{ success: false }`, but a
    // failed *request* rejects instead. Without this the rejection is unhandled
    // and `saving` never clears, leaving the form permanently unsubmittable.
    const result = await createCollection(payload).catch(() => null);

    if (!result?.success) {
      const message = result?.error ?? UNREACHABLE;

      setSaving(false);
      setError(message);
      toast.error(message);
      return;
    }

    toast.success("Collection created");

    // The dashboard's grid, the sidebar's two lists and the collection stat
    // cards are all server-rendered, so they only show the new collection on a
    // refetch.
    router.refresh();

    // No `setSaving(false)`: the dialog closes on this call, and Radix unmounts
    // the form along with its state.
    onCreated();
  }

  return (
    <form className="collection-form" onSubmit={handleSubmit}>
      {error && (
        <p className="collection-form-error" role="alert">
          {error}
        </p>
      )}

      <div className="collection-form-field">
        <Label htmlFor="create-collection-name">Name</Label>
        <Input
          id="create-collection-name"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          autoFocus
        />
      </div>

      <div className="collection-form-field">
        <Label htmlFor="create-collection-description">Description</Label>
        <Textarea
          id="create-collection-description"
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
          {saving ? "Creating…" : "Create collection"}
        </Button>
      </DialogFooter>
    </form>
  );
}
