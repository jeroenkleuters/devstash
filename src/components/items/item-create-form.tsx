"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { createItem } from "@/actions/items";
import { useBilling } from "@/components/billing/billing-provider";
import { FileUpload, type UploadedFile } from "@/components/items/file-upload";
import {
  EMPTY_ITEM_FORM_VALUES,
  ItemFormFields,
  type ItemFormValues,
  type TextField,
} from "@/components/items/item-form-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  CREATABLE_TYPES,
  PRO_TYPE_SLUGS,
  TYPE_ICONS,
  creatableType,
  isBookType,
  isProType,
  uploadKindFor,
} from "@/constants/item-types";
import { UNREACHABLE } from "@/constants/messages";
import { titleFromFileName } from "@/lib/file-title";
import { firstIssueMessage } from "@/lib/validations/auth";
import { createItemSchema } from "@/lib/validations/item";

interface ItemCreateFormProps {
  /** Type to open on. Falls back to the first creatable one. */
  initialTypeSlug?: string;
  /** Fires once the item exists, for the dialog to close. */
  onCreated: () => void;
}

/**
 * The "New Item" dialog's form.
 *
 * Which fields render follows the selected type: every type takes a title, a
 * description and tags, the text types add a content box, a link takes a URL
 * instead, the two file types take an upload, and only the types in
 * `LANGUAGE_TYPE_SLUGS` carry a language.
 */
export function ItemCreateForm({
  initialTypeSlug,
  onCreated,
}: ItemCreateFormProps) {
  const { isPro, requestUpgrade } = useBilling();
  const [typeSlug, setTypeSlug] = useState(
    initialTypeSlug ?? CREATABLE_TYPES[0].slug,
  );
  const [values, setValues] = useState<ItemFormValues>(EMPTY_ITEM_FORM_VALUES);
  const [file, setFile] = useState<UploadedFile | null>(null);
  /**
   * The last title this form wrote from a filename. Kept so a second upload can
   * replace it, while a title the user typed themselves is never overwritten.
   */
  const [generatedTitle, setGeneratedTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const type = creatableType(typeSlug);
  const uploadKind = uploadKindFor(typeSlug);

  // A title is the one field no type can be stored without, and a file item
  // needs its file — both are in the schema too, but an obviously dead button
  // beats a round trip that comes back with a message.
  const canSave =
    values.title.trim() !== "" && (!uploadKind || file !== null) && !saving;

  function setField(name: TextField, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function setCollectionIds(collectionIds: string[]) {
    setValues((current) => ({ ...current, collectionIds }));
  }

  /**
   * Takes the upload, and names the item after it.
   *
   * The generated title is a starting point rather than a lock: it fills only
   * an empty title or one this form generated, so picking the file after typing
   * a name does not lose the name. Clearing the file leaves the title alone —
   * the words are still the user's, whether or not the file is still attached.
   */
  function changeFile(next: UploadedFile | null) {
    setFile(next);

    if (!next) return;

    const title = titleFromFileName(next.name);

    // Empty for a name that is all separators, or a dotfile whose leading dot
    // is its whole name — nothing to offer, so nothing is written.
    if (!title) return;

    setValues((current) =>
      current.title.trim() === "" || current.title === generatedTitle
        ? { ...current, title }
        : current,
    );
    setGeneratedTitle(title);
  }

  function changeType(slug: string) {
    setTypeSlug(slug);

    // The upload belongs to the type it was made for: switching away and back
    // should not carry a `.png` into a File item, or a file into a snippet.
    setFile(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) return;

    const payload = {
      typeSlug,
      ...values,
      // Key and name only: the size shown in the zone is for reading, and the
      // server takes R2's word for it rather than ours.
      file: file && { key: file.key, name: file.name },
      tags: values.tags.split(","),
    };

    // The same schema the action enforces, run here for the message alone. The
    // server parses the payload again — this copy is a convenience the client
    // controls, so it cannot be the rule.
    const parsed = createItemSchema.safeParse(payload);

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
    const result = await createItem(payload).catch(() => null);

    if (!result?.success) {
      const message = result?.error ?? UNREACHABLE;

      setSaving(false);
      setError(message);
      toast.error(message);
      return;
    }

    toast.success("Item created");

    // The lists, the sidebar's per-type counts and the stat cards are all
    // server-rendered, so they only show the new item on a refetch.
    router.refresh();

    // No `setSaving(false)`: the dialog closes on this call, and Radix unmounts
    // the form along with its state.
    onCreated();
  }

  return (
    <form className="item-form" onSubmit={handleSubmit}>
      <div className="item-create-body">
        {error && (
          <p className="item-drawer-error" role="alert">
            {error}
          </p>
        )}

        <fieldset className="item-type-picker">
          <legend className="item-type-legend">Type</legend>

          <div className="item-type-options">
            {CREATABLE_TYPES.map((option) => {
              const Icon = TYPE_ICONS[option.icon];
              const locked = !isPro && isProType(option.slug);

              return (
                <label
                  key={option.slug}
                  className="item-type-option"
                  data-type={option.slug}
                  data-locked={locked || undefined}
                >
                  {/* Locked options stay selectable rather than `disabled`:
                      the click is what raises the upsell, and the controlled
                      `checked` below is what puts the selection back. */}
                  <input
                    type="radio"
                    name="typeSlug"
                    value={option.slug}
                    checked={option.slug === typeSlug}
                    onChange={() => {
                      if (locked) {
                        requestUpgrade({
                          kind: "type",
                          label: `${option.label}s`,
                        });
                        return;
                      }

                      changeType(option.slug);
                    }}
                    disabled={saving}
                  />
                  {Icon && <Icon size={16} aria-hidden />}
                  {option.label}
                  {PRO_TYPE_SLUGS.has(option.slug) && (
                    <Badge variant="outline" className="item-type-badge">
                      PRO
                    </Badge>
                  )}
                </label>
              );
            })}
          </div>
        </fieldset>

        {uploadKind && (
          <div className="item-form-field">
            <Label htmlFor={undefined}>
              {isBookType(typeSlug)
                ? "Cover"
                : uploadKind === "image"
                  ? "Image"
                  : "File"}
            </Label>
            <FileUpload
              kind={uploadKind}
              value={file}
              onChange={changeFile}
              disabled={saving}
            />
          </div>
        )}

        <ItemFormFields
          values={values}
          setField={setField}
          setCollectionIds={setCollectionIds}
          idPrefix="create-item"
          typeSlug={typeSlug}
          contentType={type?.contentType}
          urlRequired
          contentRows={10}
        />
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={saving}>
            Cancel
          </Button>
        </DialogClose>

        <Button type="submit" disabled={!canSave}>
          {saving ? "Creating…" : "Create item"}
        </Button>
      </DialogFooter>
    </form>
  );
}
