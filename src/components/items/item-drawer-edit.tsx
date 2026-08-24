"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { updateItem } from "@/actions/items";
import { CodeEditor } from "@/components/items/code-editor";
import { ItemDrawerHeading } from "@/components/items/item-drawer-heading";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SheetHeader } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownEditor } from "@/components/items/markdown-editor";
import {
  LANGUAGE_TYPE_SLUGS,
  codeTypeLanguage,
  isCodeType,
  isMarkdownType,
} from "@/constants/item-types";
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
  const [values, setValues] = useState(() => initialValues(detail));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const showContent = detail.contentType === "TEXT";
  const showUrl = detail.contentType === "URL";
  const showLanguage = LANGUAGE_TYPE_SLUGS.has(detail.type.slug);
  const showCode = showContent && isCodeType(detail.type.slug);
  const showMarkdown = showContent && isMarkdownType(detail.type.slug);

  // A title is the one field the item cannot be stored without, so the guard is
  // here as well as in the schema — an obviously dead Save button beats a round
  // trip that comes back with a message.
  const canSave = values.title.trim() !== "" && !saving;

  function setField(name: keyof EditValues, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
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

          <div className="item-form-field">
            <Label htmlFor="item-title">Title</Label>
            <Input
              id="item-title"
              name="title"
              value={values.title}
              onChange={(event) => setField("title", event.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="item-form-field">
            <Label htmlFor="item-description">Description</Label>
            <Textarea
              id="item-description"
              name="description"
              value={values.description}
              onChange={(event) => setField("description", event.target.value)}
              rows={2}
            />
          </div>

          {showContent && (
            <div className="item-form-field">
              {/* Neither editor has an element to pair a label with, so each
                  names itself through `ariaLabel` instead. */}
              <Label
                htmlFor={showCode || showMarkdown ? undefined : "item-content"}
              >
                Content
              </Label>

              {showCode ? (
                <CodeEditor
                  value={values.content}
                  // The live field, so the highlighting follows what is being
                  // typed into Language rather than what was last saved.
                  language={values.language}
                  fallbackLanguage={codeTypeLanguage(detail.type.slug)}
                  onChange={(next) => setField("content", next)}
                  ariaLabel="Content"
                />
              ) : showMarkdown ? (
                <MarkdownEditor
                  value={values.content}
                  onChange={(next) => setField("content", next)}
                  ariaLabel="Content"
                />
              ) : (
                <Textarea
                  id="item-content"
                  name="content"
                  className="item-form-content"
                  value={values.content}
                  onChange={(event) => setField("content", event.target.value)}
                  rows={12}
                  spellCheck={false}
                />
              )}
            </div>
          )}

          {showUrl && (
            <div className="item-form-field">
              <Label htmlFor="item-url">URL</Label>
              <Input
                id="item-url"
                name="url"
                type="url"
                value={values.url}
                onChange={(event) => setField("url", event.target.value)}
                placeholder="https://"
              />
            </div>
          )}

          {showLanguage && (
            <div className="item-form-field">
              <Label htmlFor="item-language">Language</Label>
              <Input
                id="item-language"
                name="language"
                value={values.language}
                onChange={(event) => setField("language", event.target.value)}
                placeholder="typescript"
              />
            </div>
          )}

          <div className="item-form-field">
            <Label htmlFor="item-tags">Tags</Label>
            <Input
              id="item-tags"
              name="tags"
              value={values.tags}
              onChange={(event) => setField("tags", event.target.value)}
              placeholder="react, hooks"
            />
            <p className="item-form-hint">Separate tags with commas.</p>
          </div>
        </form>
      </div>
    </>
  );
}

const FORM_ID = "item-edit-form";

interface EditValues {
  title: string;
  description: string;
  content: string;
  url: string;
  language: string;
  /** The comma-separated field, split into the array on save. */
  tags: string;
}

/** Inputs have no null, so every absent value starts as the empty string. */
function initialValues(detail: ItemDetail): EditValues {
  return {
    title: detail.title,
    description: detail.description ?? "",
    content: detail.content ?? "",
    url: detail.url ?? "",
    language: detail.language ?? "",
    tags: detail.tags.join(", "),
  };
}
