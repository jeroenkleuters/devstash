"use client";

import { CodeEditor } from "@/components/items/code-editor";
import { ItemCollectionsField } from "@/components/items/item-collections-field";
import { MarkdownEditor } from "@/components/items/markdown-editor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  LANGUAGE_TYPE_SLUGS,
  codeTypeLanguage,
  isCodeType,
  isMarkdownType,
} from "@/constants/item-types";
import type { ItemContentType, ItemDetail } from "@/types/item";

/**
 * The fields an item is written through, shared by the create dialog and the
 * drawer's edit mode.
 *
 * Which of them render follows the content type: every item takes a title, a
 * description and tags, a TEXT item adds a content box — a code editor, a
 * markdown editor or a plain textarea, depending on the type slug — a URL item
 * takes a URL instead, and only the types in `LANGUAGE_TYPE_SLUGS` carry a
 * language. A FILE item shows none of the three, since its payload is the
 * upload its own form renders.
 */
export function ItemFormFields({
  values,
  setField,
  setCollectionIds,
  idPrefix,
  typeSlug,
  contentType,
  urlRequired = false,
  contentRows,
}: ItemFormFieldsProps) {
  const showContent = contentType === "TEXT";
  const showUrl = contentType === "URL";
  const showLanguage = LANGUAGE_TYPE_SLUGS.has(typeSlug);
  const showCode = showContent && isCodeType(typeSlug);
  const showMarkdown = showContent && isMarkdownType(typeSlug);

  return (
    <>
      <div className="item-form-field">
        <Label htmlFor={`${idPrefix}-title`}>Title</Label>
        <Input
          id={`${idPrefix}-title`}
          name="title"
          value={values.title}
          onChange={(event) => setField("title", event.target.value)}
          required
          autoFocus
        />
      </div>

      <div className="item-form-field">
        <Label htmlFor={`${idPrefix}-description`}>Description</Label>
        <Textarea
          id={`${idPrefix}-description`}
          name="description"
          value={values.description}
          onChange={(event) => setField("description", event.target.value)}
          rows={2}
        />
      </div>

      {showContent && (
        <div className="item-form-field">
          {/* Neither editor has an element to pair a label with, so each names
              itself through `ariaLabel` instead. */}
          <Label
            htmlFor={
              showCode || showMarkdown ? undefined : `${idPrefix}-content`
            }
          >
            Content
          </Label>

          {showCode ? (
            <CodeEditor
              value={values.content}
              // The live field, so the highlighting follows what is being typed
              // into Language rather than what was last saved.
              language={values.language}
              fallbackLanguage={codeTypeLanguage(typeSlug)}
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
              id={`${idPrefix}-content`}
              name="content"
              className="item-form-content"
              value={values.content}
              onChange={(event) => setField("content", event.target.value)}
              rows={contentRows}
              spellCheck={false}
            />
          )}
        </div>
      )}

      {showUrl && (
        <div className="item-form-field">
          <Label htmlFor={`${idPrefix}-url`}>URL</Label>
          <Input
            id={`${idPrefix}-url`}
            name="url"
            type="url"
            value={values.url}
            onChange={(event) => setField("url", event.target.value)}
            placeholder="https://"
            required={urlRequired}
          />
        </div>
      )}

      {showLanguage && (
        <div className="item-form-field">
          <Label htmlFor={`${idPrefix}-language`}>Language</Label>
          <Input
            id={`${idPrefix}-language`}
            name="language"
            value={values.language}
            onChange={(event) => setField("language", event.target.value)}
            placeholder="typescript"
          />
        </div>
      )}

      <div className="item-form-field">
        <Label htmlFor={`${idPrefix}-tags`}>Tags</Label>
        <Input
          id={`${idPrefix}-tags`}
          name="tags"
          value={values.tags}
          onChange={(event) => setField("tags", event.target.value)}
          placeholder="react, hooks"
        />
        <p className="item-form-hint">Separate tags with commas.</p>
      </div>

      <ItemCollectionsField
        selected={values.collectionIds}
        onChange={setCollectionIds}
        idPrefix={idPrefix}
      />
    </>
  );
}

/** What both forms hold while an item is being written. */
export interface ItemFormValues {
  title: string;
  description: string;
  content: string;
  url: string;
  language: string;
  /** The comma-separated field, split into the array on submit. */
  tags: string;
  /**
   * The collections the item is filed into. The one field that is not a string:
   * a checkbox list has no single input to hold text, so `setField` — which is
   * every text field's setter — does not reach it and `setCollectionIds` does.
   */
  collectionIds: string[];
}

interface ItemFormFieldsProps {
  values: ItemFormValues;
  setField: (name: TextField, value: string) => void;
  setCollectionIds: (collectionIds: string[]) => void;
  /**
   * Namespaces the field ids, so the two forms cannot collide if they are ever
   * mounted at once.
   */
  idPrefix: string;
  /** Decides the content editor and whether a language field renders. */
  typeSlug: string;
  /**
   * Decides which payload field renders. Optional because the create form
   * resolves it from a slug, which may name no known type.
   */
  contentType: ItemContentType | undefined;
  /**
   * Create requires a URL up front; edit does not, so an existing link can be
   * saved while its URL is being retyped. The schema is the rule either way.
   */
  urlRequired?: boolean;
  /** Starting height of the plain content textarea. */
  contentRows: number;
}

/** The fields `setField` writes — every one whose input holds text. */
export type TextField = Exclude<keyof ItemFormValues, "collectionIds">;

/** Inputs have no null, so every text field starts as the empty string. */
export const EMPTY_ITEM_FORM_VALUES: ItemFormValues = {
  title: "",
  description: "",
  content: "",
  url: "",
  language: "",
  tags: "",
  collectionIds: [],
};

/** The stored item, as the edit form's starting values. */
export function itemFormValuesFrom(detail: ItemDetail): ItemFormValues {
  return {
    title: detail.title,
    description: detail.description ?? "",
    content: detail.content ?? "",
    url: detail.url ?? "",
    language: detail.language ?? "",
    tags: detail.tags.join(", "),
    collectionIds: detail.collections.map((collection) => collection.id),
  };
}
