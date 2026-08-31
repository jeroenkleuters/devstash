"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { updateItem } from "@/actions/items";
import { ItemDrawerHeading } from "@/components/items/item-drawer-heading";
import {
  ItemFormFields,
  type TextField,
  itemFormValuesFrom,
} from "@/components/items/item-form-fields";
import { SheetHeader } from "@/components/ui/sheet";
import { updateItemSchema } from "@/lib/validations/item";
import { firstIssueMessage } from "@/lib/validations/auth";
import type { ItemDetail } from "@/types/item";

/** Said when the request never reached the action, so it named no reason. */
const UNREACHABLE = "Could not reach the server. Try again.";

interface ItemDrawerEditProps {
  detail: ItemDetail;
  /** Hands the saved item back so the drawer can show what was stored. */
  onSaved: (detail: ItemDetail) => void;
  onCancel: () => void;
}

/**
 * The drawer's edit mode.
 *
 * It renders its own `SheetHeader` rather than being slotted into the view's,
 * because Save and Cancel replace the action bar *inside* that header while the
 * fields sit in the body — one component owning both keeps the form state in
 * one place instead of hoisting it into `ItemDrawer` for two children in
 * different parents.
 */
export function ItemDrawerEdit({
  detail,
  onSaved,
  onCancel,
}: ItemDrawerEditProps) {
  const [values, setValues] = useState(() => itemFormValuesFrom(detail));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // A title is the one field the item cannot be stored without, so the guard is
  // here as well as in the schema — an obviously dead Save button beats a round
  // trip that comes back with a message.
  const canSave = values.title.trim() !== "" && !saving;

  function setField(name: TextField, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function setCollectionIds(collectionIds: string[]) {
    setValues((current) => ({ ...current, collectionIds }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) return;

    const payload = {
      ...values,
      tags: values.tags.split(","),
    };

    // The same schema the action enforces, run here for the message alone. The
    // server parses the payload again — this copy is a convenience the client
    // controls, so it cannot be the rule.
    const parsed = updateItemSchema.safeParse(payload);

    if (!parsed.success) {
      setError(firstIssueMessage(parsed.error));
      return;
    }

    setSaving(true);
    setError(null);

    // The action answers a failed *write* with `{ success: false }`, but a
    // failed *request* rejects instead. Without this the rejection is unhandled
    // and `saving` never clears, leaving Save permanently dead.
    const result = await updateItem(detail.id, payload).catch(() => null);

    if (!result?.success) {
      const message = result?.error ?? UNREACHABLE;

      setSaving(false);
      setError(message);
      toast.error(message);
      return;
    }

    toast.success("Item saved");
    // No `setSaving(false)`: the drawer switches back to view mode on this
    // call, unmounting the form along with its state.
    onSaved(result.data);
  }

  return (
    <>
      <SheetHeader className="item-drawer-header">
        <ItemDrawerHeading
          title={detail.title}
          type={detail.type}
          language={detail.language}
        />

        <div className="item-drawer-actions">
          <div className="item-drawer-actions-end">
            <button
              type="button"
              className="item-drawer-action"
              onClick={onCancel}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              form={FORM_ID}
              className="item-drawer-action item-drawer-action-save"
              disabled={!canSave}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </SheetHeader>

      <div className="item-drawer-body">
        {/* The buttons live in the header above, so they reach the form by id
            rather than by containment. */}
        <form id={FORM_ID} className="item-form" onSubmit={handleSubmit}>
          {error && <p className="item-drawer-error">{error}</p>}

          <ItemFormFields
            values={values}
            setField={setField}
            setCollectionIds={setCollectionIds}
            idPrefix="item"
            typeSlug={detail.type.slug}
            contentType={detail.contentType}
            contentRows={12}
            itemId={detail.id}
          />
        </form>
      </div>
    </>
  );
}

const FORM_ID = "item-edit-form";
