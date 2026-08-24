"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { createItem } from "@/actions/items";
import { CodeEditor } from "@/components/items/code-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CREATABLE_TYPES,
  LANGUAGE_TYPE_SLUGS,
  PICKER_TYPES,
  TYPE_ICONS,
  codeTypeLanguage,
  isCodeType,
  pickerType,
} from "@/constants/item-types";
import { firstIssueMessage } from "@/lib/validations/auth";
import { createItemSchema } from "@/lib/validations/item";

/** Said when the request never reached the action, so it named no reason. */
const UNREACHABLE = "Could not reach the server. Try again.";

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
 * instead, and only the types in `LANGUAGE_TYPE_SLUGS` carry a language. The
 * two file types are offered but cannot be stored — see `PICKER_TYPES`.
 */
export function ItemCreateForm({
  initialTypeSlug,
  onCreated,
}: ItemCreateFormProps) {
  const [typeSlug, setTypeSlug] = useState(
    initialTypeSlug ?? CREATABLE_TYPES[0].slug,
  );
  const [values, setValues] = useState<FormValues>(EMPTY_VALUES);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const type = pickerType(typeSlug);
  const creatable = type?.creatable ?? false;
  // A type with no upload flow has no payload field to offer, so the fields
  // give way to the note explaining why.
  const showContent = creatable && type?.contentType === "TEXT";
  const showUrl = creatable && type?.contentType === "URL";
  const showLanguage = creatable && LANGUAGE_TYPE_SLUGS.has(typeSlug);
  const showCode = showContent && isCodeType(typeSlug);

  // A title is the one field no type can be stored without, so the guard is
  // here as well as in the schema — an obviously dead button beats a round trip
  // that comes back with a message.
  const canSave = creatable && values.title.trim() !== "" && !saving;

  function setField(name: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving || !creatable) return;

    const payload = {
      typeSlug,
      ...values,
      tags: values.tags.split(","),
    };

    // The same schema the action enforces, run here for the message alone. The
    // server parses the payload again — this copy is a convenience the client
    // controls, so it cannot be the rule.
    const parsed = createItemSchema.safeParse(payload);

    if (!parsed.success) {
      setError(firstIssueMessage(parsed.error));
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
            {PICKER_TYPES.map((option) => {
              const Icon = TYPE_ICONS[option.icon];

              return (
                <label
                  key={option.slug}
                  className="item-type-option"
                  data-type={option.slug}
                >
                  <input
                    type="radio"
                    name="typeSlug"
                    value={option.slug}
                    checked={option.slug === typeSlug}
                    onChange={() => setTypeSlug(option.slug)}
                    disabled={saving}
                  />
                  {Icon && <Icon size={16} aria-hidden />}
                  {option.label}
                  {!option.creatable && (
                    <Badge variant="outline" className="item-type-badge">
                      PRO
                    </Badge>
                  )}
                </label>
              );
            })}
          </div>
        </fieldset>

        {!creatable && (
          <p className="item-create-locked">
            {type?.label ?? "This type"} items need a file upload, which comes
            with Pro. Pick another type to create something now.
          </p>
        )}

        <div className="item-form-field">
          <Label htmlFor="create-item-title">Title</Label>
          <Input
            id="create-item-title"
            name="title"
            value={values.title}
            onChange={(event) => setField("title", event.target.value)}
            required
            autoFocus
          />
        </div>

        <div className="item-form-field">
          <Label htmlFor="create-item-description">Description</Label>
          <Textarea
            id="create-item-description"
            name="description"
            value={values.description}
            onChange={(event) => setField("description", event.target.value)}
            rows={2}
          />
        </div>

        {showContent && (
          <div className="item-form-field">
            {/* Monaco has no element to pair a label with, so the editor names
                itself through `ariaLabel` instead. */}
            <Label htmlFor={showCode ? undefined : "create-item-content"}>
              Content
            </Label>

            {showCode ? (
              <CodeEditor
                value={values.content}
                // The live field, so the highlighting follows what is being
                // typed into Language.
                language={values.language}
                fallbackLanguage={codeTypeLanguage(typeSlug)}
                onChange={(next) => setField("content", next)}
                ariaLabel="Content"
              />
            ) : (
              <Textarea
                id="create-item-content"
                name="content"
                className="item-form-content"
                value={values.content}
                onChange={(event) => setField("content", event.target.value)}
                rows={10}
                spellCheck={false}
              />
            )}
          </div>
        )}

        {showUrl && (
          <div className="item-form-field">
            <Label htmlFor="create-item-url">URL</Label>
            <Input
              id="create-item-url"
              name="url"
              type="url"
              value={values.url}
              onChange={(event) => setField("url", event.target.value)}
              placeholder="https://"
              required
            />
          </div>
        )}

        {showLanguage && (
          <div className="item-form-field">
            <Label htmlFor="create-item-language">Language</Label>
            <Input
              id="create-item-language"
              name="language"
              value={values.language}
              onChange={(event) => setField("language", event.target.value)}
              placeholder="typescript"
            />
          </div>
        )}

        <div className="item-form-field">
          <Label htmlFor="create-item-tags">Tags</Label>
          <Input
            id="create-item-tags"
            name="tags"
            value={values.tags}
            onChange={(event) => setField("tags", event.target.value)}
            placeholder="react, hooks"
          />
          <p className="item-form-hint">Separate tags with commas.</p>
        </div>
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

interface FormValues {
  title: string;
  description: string;
  content: string;
  url: string;
  language: string;
  /** The comma-separated field, split into the array on submit. */
  tags: string;
}

/** Inputs have no null, so every field starts as the empty string. */
const EMPTY_VALUES: FormValues = {
  title: "",
  description: "",
  content: "",
  url: "",
  language: "",
  tags: "",
};
