"use client";

import {
  CalendarDays,
  Download,
  ExternalLink,
  File as FileIcon,
  Folder,
  Tag,
} from "lucide-react";
import { useState } from "react";

import { CodeEditor } from "@/components/items/code-editor";
import { MarkdownEditor } from "@/components/items/markdown-editor";
import { ItemDrawerActions } from "@/components/items/item-drawer-actions";
import { ItemDrawerEdit } from "@/components/items/item-drawer-edit";
import { ItemDrawerHeading } from "@/components/items/item-drawer-heading";
import { ItemDrawerSkeleton } from "@/components/items/item-drawer-skeleton";
import type { ItemDetailState } from "@/components/items/item-drawer-provider";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import {
  codeTypeLanguage,
  isCodeType,
  isMarkdownType,
  uploadKindFor,
} from "@/constants/item-types";
import type { ItemSummary } from "@/lib/db/items";
import { formatFileSize, formatLongDate } from "@/lib/utils";
import type { ItemDetail } from "@/types/item";

interface ItemDrawerProps {
  /** What the clicked card already knew — enough to paint the header at once. */
  summary: ItemSummary;
  state: ItemDetailState;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Passes the saved item up so the provider can refresh what it holds. */
  onSaved: (detail: ItemDetail) => void;
  /** Passes a favorite or pin up, so the summary the header reads stays current. */
  onFlagsChanged: (patch: { isFavorite?: boolean; isPinned?: boolean }) => void;
  /** Closes the drawer on the item that was just deleted. */
  onDeleted: () => void;
}

/** The item detail view. There is no item page — this is it. */
export function ItemDrawer({
  summary,
  state,
  open,
  onOpenChange,
  onSaved,
  onFlagsChanged,
  onDeleted,
}: ItemDrawerProps) {
  // Which item edit mode was entered on, rather than a bare boolean: clicking a
  // second card swaps `summary` without remounting the drawer, and comparing
  // the two here means the new item cannot inherit the old one's open form.
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = editingId === summary.id;

  const detail = state.status === "ready" ? state.detail : null;

  function handleSaved(saved: ItemDetail) {
    setEditingId(null);
    onSaved(saved);
  }

  function handleDeleted() {
    // Edit mode cannot survive the item it was editing, and the drawer would
    // otherwise reopen into a form for a row that is gone.
    setEditingId(null);
    onDeleted();
  }

  function handleOpenChange(next: boolean) {
    // Reopening the same item should start in view mode, so the drawer cannot
    // be closed mid-edit and come back to a stale form.
    if (!next) {
      setEditingId(null);
    }

    onOpenChange(next);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      {/* `aria-describedby={undefined}` because the drawer has no one-line
          summary to point at: the description is a section of the body, and
          Radix would otherwise warn about the missing `Sheet.Description`. */}
      <SheetContent
        className="item-drawer"
        side="right"
        aria-describedby={undefined}
      >
        {editing && detail ? (
          <ItemDrawerEdit
            detail={detail}
            onSaved={handleSaved}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <>
            <SheetHeader className="item-drawer-header">
              <ItemDrawerHeading
                title={detail?.title ?? summary.title}
                type={summary.type}
                language={detail?.language ?? null}
              />

              <ItemDrawerActions
                itemId={summary.id}
                title={summary.title}
                // Both flags come from the summary rather than the detail: the
                // provider patches it on every toggle, so a change made while
                // the detail fetch is still in flight is not overwritten by the
                // older value that response carries.
                isFavorite={summary.isFavorite}
                isPinned={summary.isPinned}
                detail={detail}
                onEdit={() => setEditingId(summary.id)}
                onFlagsChanged={onFlagsChanged}
                onDeleted={handleDeleted}
              />
            </SheetHeader>

            {state.status === "loading" && <ItemDrawerSkeleton />}

            {state.status === "error" && (
              <div className="item-drawer-body">
                <p className="item-drawer-error">{state.message}</p>
              </div>
            )}

            {detail && <ItemDrawerBody detail={detail} />}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ItemDrawerBody({ detail }: { detail: ItemDetail }) {
  return (
    <div className="item-drawer-body">
      {detail.description && (
        <section className="item-drawer-section">
          <h3 className="item-drawer-label">Description</h3>
          <p className="item-drawer-text">{detail.description}</p>
        </section>
      )}

      <section className="item-drawer-section">
        <h3 className="item-drawer-label">Content</h3>
        <ItemContent detail={detail} />
      </section>

      <hr className="item-drawer-divider" />

      {detail.tags.length > 0 && (
        <section className="item-drawer-section">
          <h3 className="item-drawer-label">
            <Tag size={14} aria-hidden />
            Tags
          </h3>
          <ul className="item-drawer-chips">
            {detail.tags.map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
        </section>
      )}

      {detail.collections.length > 0 && (
        <section className="item-drawer-section">
          <h3 className="item-drawer-label">
            <Folder size={14} aria-hidden />
            Collections
          </h3>
          <ul className="item-drawer-chips">
            {detail.collections.map((collection) => (
              <li key={collection.id}>{collection.name}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="item-drawer-section">
        <h3 className="item-drawer-label">
          <CalendarDays size={14} aria-hidden />
          Details
        </h3>
        <dl className="item-drawer-details">
          <dt>Created</dt>
          <dd>{formatLongDate(detail.createdAt)}</dd>
          <dt>Updated</dt>
          <dd>{formatLongDate(detail.updatedAt)}</dd>
        </dl>
      </section>
    </div>
  );
}

/** The item's payload, shown as whatever its content type makes it. */
function ItemContent({ detail }: { detail: ItemDetail }) {
  if (detail.contentType === "URL") {
    return detail.url ? (
      <a
        className="item-drawer-url"
        href={detail.url}
        target="_blank"
        rel="noreferrer"
      >
        {detail.url}
        <ExternalLink size={14} aria-hidden />
      </a>
    ) : (
      <p className="item-drawer-empty">No link set.</p>
    );
  }

  if (detail.contentType === "FILE") {
    return <ItemFile detail={detail} />;
  }

  if (!detail.content) {
    return <p className="item-drawer-empty">This item has no content.</p>;
  }

  if (isCodeType(detail.type.slug)) {
    return (
      <CodeEditor
        value={detail.content}
        language={detail.language}
        fallbackLanguage={codeTypeLanguage(detail.type.slug)}
        readOnly
      />
    );
  }

  // Notes and prompts are prose, so they render rather than being shown as
  // their source.
  if (isMarkdownType(detail.type.slug)) {
    return <MarkdownEditor value={detail.content} readOnly />;
  }

  return (
    <pre className="item-drawer-code">
      <code>{detail.content}</code>
    </pre>
  );
}

/**
 * A File or Image item's payload: the picture itself for an image, the file's
 * name and size for anything else, and a download either way.
 *
 * Both are served by `/api/items/[id]/file` rather than from R2 directly — the
 * bucket is private, and the item's own ownership check is what opens it. A
 * plain `<img>` and not `next/image`: the route is same-origin and per-account,
 * so there is nothing for the optimizer to cache and no remote host to allow.
 */
function ItemFile({ detail }: { detail: ItemDetail }) {
  if (!detail.fileUrl) {
    return <p className="item-drawer-empty">No file attached.</p>;
  }

  const source = `/api/items/${detail.id}/file`;
  const isImage = uploadKindFor(detail.type.slug) === "image";

  return (
    <div className="item-drawer-file">
      {isImage && (
        // `next/image` cannot serve this: its optimizer fetches the source
        // server-side without the visitor's cookies, and this route answers 401
        // without a session. There is nothing to optimize either — the response
        // is per-account and uncacheable.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="item-drawer-image"
          src={source}
          alt={detail.description ?? detail.title}
        />
      )}

      <div className="item-drawer-file-meta">
        <FileIcon size={16} aria-hidden />

        <span className="item-drawer-file-name">
          {detail.fileName ?? "Attached file"}
        </span>

        {detail.fileSize !== null && (
          <span className="item-drawer-file-size">
            {formatFileSize(detail.fileSize)}
          </span>
        )}

        {/* An anchor rather than a button: the response carries
            `Content-Disposition: attachment`, so the browser saves it without
            the page going anywhere. */}
        <a className="item-drawer-download" href={`${source}?download`}>
          <Download size={16} aria-hidden />
          Download
        </a>
      </div>
    </div>
  );
}
