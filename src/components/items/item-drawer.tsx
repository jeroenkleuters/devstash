"use client";

import { CalendarDays, ExternalLink, Folder, Tag } from "lucide-react";
import { useState } from "react";

import { ItemDrawerActions } from "@/components/items/item-drawer-actions";
import { ItemDrawerEdit } from "@/components/items/item-drawer-edit";
import { ItemDrawerHeading } from "@/components/items/item-drawer-heading";
import { ItemDrawerSkeleton } from "@/components/items/item-drawer-skeleton";
import type { ItemDetailState } from "@/components/items/item-drawer-provider";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { NUMBERED_TYPE_SLUGS } from "@/constants/item-types";
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
                isFavorite={detail?.isFavorite ?? summary.isFavorite}
                isPinned={detail?.isPinned ?? summary.isPinned}
                detail={detail}
                onEdit={() => setEditingId(summary.id)}
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

/**
 * The item's payload. Syntax highlighting and the per-type editors come later —
 * for now each content type is shown as what it is.
 */
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
    return detail.fileName ? (
      <p className="item-drawer-text">
        {detail.fileName}
        {detail.fileSize !== null && ` · ${formatFileSize(detail.fileSize)}`}
      </p>
    ) : (
      <p className="item-drawer-empty">No file attached.</p>
    );
  }

  if (!detail.content) {
    return <p className="item-drawer-empty">This item has no content.</p>;
  }

  return NUMBERED_TYPE_SLUGS.has(detail.type.slug) ? (
    <NumberedCode content={detail.content} />
  ) : (
    <pre className="item-drawer-code">
      <code>{detail.content}</code>
    </pre>
  );
}

/**
 * Code with a line-number gutter. The numbers are drawn by a CSS counter rather
 * than written out as text, so they can't land in the clipboard when the block
 * is drag-selected. Each line is its own `.line` element — the shape and the
 * class name Shiki emits — so this markup can be swapped for highlighted HTML
 * later without touching the gutter's styling.
 */
function NumberedCode({ content }: { content: string }) {
  const lines = content.split("\n");

  return (
    <pre className="item-drawer-code item-drawer-code-numbered">
      <code>
        {lines.map((line, index) => (
          <span className="line" key={index}>
            {line}
          </span>
        ))}
      </code>
    </pre>
  );
}
