"use client";

import { AiOptimizablePrompt } from "@/components/ai/ai-optimizable-prompt";
import { AiSummarySuggestion } from "@/components/ai/ai-summary-suggestion";
import { AiTagSuggestions } from "@/components/ai/ai-tag-suggestions";
import { CodeEditor } from "@/components/items/code-editor";
import { ItemCollectionsField } from "@/components/items/item-collections-field";
import { MarkdownEditor } from "@/components/items/markdown-editor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  LANGUAGE_TYPE_SLUGS,
  codeTypeLanguage,
  isBookType,
  isCodeType,
  isMarkdownType,
  isPromptType,
  uploadKindFor,
} from "@/constants/item-types";
import { languageOptions } from "@/lib/code-language";
import type { ItemContentType, ItemDetail } from "@/types/item";

/**
 * The fields an item is written through, shared by the create dialog and the
 * drawer's edit mode.
 *
 * Which of them render follows the content type: every item takes a title and
 * tags, a TEXT item adds a content box — a code editor, a markdown editor or a
 * plain textarea, depending on the type slug — a URL item takes a URL instead,
 * and only the types in `LANGUAGE_TYPE_SLUGS` carry a language. A FILE item
 * shows none of the three, since its payload is the upload its own form
 * renders, and it carries no description either.
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
  itemId,
}: ItemFormFieldsProps) {
  const isBook = isBookType(typeSlug);
  const showContent = contentType === "TEXT";
  // A file item is its file: the name, the size and the preview say everything
  // the description used to, so the two upload types do not carry one. A book
  // uploads a cover rather than a document, and its summary is the point.
  const showDescription = uploadKindFor(typeSlug) === undefined || isBook;
  const showUrl = contentType === "URL" || isBook;
  const showLanguage = LANGUAGE_TYPE_SLUGS.has(typeSlug);
  // A book's is a Summary rather than a Description — it is the point of
  // the type, not a note about it. Named once so the label, the button's
  // title and the accept button's copy all say the same word.
  const descriptionLabel = isBook ? "Summary" : "Description";
  const showCode = showContent && isCodeType(typeSlug);
  const showMarkdown = showContent && isMarkdownType(typeSlug);
  // Only a prompt is worth rewriting *as* a prompt — a note is markdown too,
  // and "make this instruction clearer" means nothing for prose about
  // something. Inside `showContent`, so the field it acts on is always there.
  const showOptimize = showContent && isPromptType(typeSlug);

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

      {isBook && (
        <div className="item-form-field">
          <Label htmlFor={`${idPrefix}-author`}>Author</Label>
          <Input
            id={`${idPrefix}-author`}
            name="author"
            value={values.author}
            onChange={(event) => setField("author", event.target.value)}
          />
        </div>
      )}

      {showDescription && (
        <div className="item-form-field">
          {/* Owns the label as well as the field, so the Suggest button can sit
              on the label row rather than under the textarea. Inside
              `showDescription`, so the types without the field get no button by
              construction rather than by a second list of slugs agreeing with
              the first. `itemId` is absent in the create dialog, which is what
              makes it summarise what has been typed instead of a stored row. */}
          <AiSummarySuggestion
            itemId={itemId}
            draft={{ title: values.title, content: values.content }}
            value={values.description}
            label={descriptionLabel}
            htmlFor={`${idPrefix}-description`}
            onAccept={(summary) => setField("description", summary)}
          >
            <Textarea
              id={`${idPrefix}-description`}
              name="description"
              value={values.description}
              onChange={(event) => setField("description", event.target.value)}
              rows={2}
            />
          </AiSummarySuggestion>
        </div>
      )}

      {/* Above Content, because it decides how the editor below it highlights:
          picking the language first and then writing reads in the order it
          takes effect, where a field underneath asks for it after the fact. */}
      {showLanguage && (
        <div className="item-form-field">
          <Label htmlFor={`${idPrefix}-language`}>Language</Label>
          <select
            id={`${idPrefix}-language`}
            name="language"
            className="item-form-select"
            value={values.language}
            onChange={(event) => setField("language", event.target.value)}
          >
            {/* No hint, rather than a language named "none" — the editor then
                falls back to what the type implies, shell for a command and
                plain text for a snippet. */}
            <option value="">Not set</option>
            {languageOptions(values.language).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}

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
          ) : showOptimize ? (
            // The same Markdown editor, with Optimize in its bar — the button
            // belongs where the actions on the content live, which is the
            // frame's own title bar rather than a row underneath it.
            <AiOptimizablePrompt
              itemId={itemId}
              value={values.content}
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
          <Label htmlFor={`${idPrefix}-url`}>{isBook ? "Link" : "URL"}</Label>
          <Input
            id={`${idPrefix}-url`}
            name="url"
            type="url"
            value={values.url}
            onChange={(event) => setField("url", event.target.value)}
            placeholder="https://"
            // A book's link is optional — a cover dropped on the listing
            // becomes a book with no link, and the drawer adds one later.
            required={urlRequired && !isBook}
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

        {/* Rendered for both forms: the drawer names the item it is editing,
            while the create dialog has no row yet and sends what has been
            typed instead. `AiTagSuggestions` picks the action from that. */}
        <AiTagSuggestions
          itemId={itemId}
          draft={{
            title: values.title,
            description: values.description,
            content: values.content,
          }}
          value={values.tags}
          onAccept={(tag) =>
            setField("tags", values.tags.trim() ? `${values.tags}, ${tag}` : tag)
          }
        />
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
  /** Books only — see `BOOK_TYPE_SLUGS`. */
  author: string;
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
  /**
   * The item being edited, when there is one.
   *
   * Absent in the create dialog, where the suggestions run against what has
   * been typed instead of a stored row — see `suggestTagsForDraft`.
   */
  itemId?: string;
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
  author: "",
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
    author: detail.author ?? "",
    tags: detail.tags.join(", "),
    collectionIds: detail.collections.map((collection) => collection.id),
  };
}
