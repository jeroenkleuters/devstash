"use client";

import { CalendarDays, ExternalLink, Folder, Tag } from "lucide-react";

import { ItemDrawerActions } from "@/components/items/item-drawer-actions";
import { ItemDrawerSkeleton } from "@/components/items/item-drawer-skeleton";
import type { ItemDetailState } from "@/components/items/item-drawer-provider";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { NUMBERED_TYPE_SLUGS, TYPE_ICONS } from "@/constants/item-types";
import type { ItemSummary } from "@/lib/db/items";
import { formatFileSize, formatLongDate } from "@/lib/utils";
import type { ItemDetail } from "@/types/item";

interface ItemDrawerProps {
  /** What the clicked card already knew — enough to paint the header at once. */
  summary: ItemSummary;
  state: ItemDetailState;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** The item detail view. There is no item page — this is it. */
export function ItemDrawer({
  summary,
  state,
  open,
  onOpenChange,
}: ItemDrawerProps) {
  const Icon = TYPE_ICONS[summary.type.icon];
  const detail = state.status === "ready" ? state.detail : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* `aria-describedby={undefined}` because the drawer has no one-line
          summary to point at: the description is a section of the body, and
          Radix would otherwise warn about the missing `Sheet.Description`. */}
      <SheetContent
        className="item-drawer"
        side="right"
        aria-describedby={undefined}
      >
        <SheetHeader className="item-drawer-header">
          <div className="item-drawer-heading" data-type={summary.type.slug}>
            <span className="item-drawer-icon">
              {Icon && <Icon size={20} aria-hidden />}
            </span>

            <div className="item-drawer-heading-text">
              <SheetTitle className="item-drawer-title">
                {summary.title}
              </SheetTitle>

              <div className="item-drawer-badges">
                <Badge variant="secondary">{summary.type.name}</Badge>
                {detail?.language && (
                  <Badge variant="secondary">{detail.language}</Badge>
                )}
              </div>
            </div>
          </div>

          <ItemDrawerActions
            isFavorite={detail?.isFavorite ?? summary.isFavorite}
            isPinned={detail?.isPinned ?? summary.isPinned}
            detail={detail}
          />
        </SheetHeader>

        {state.status === "loading" && <ItemDrawerSkeleton />}

        {state.status === "error" && (
          <div className="item-drawer-body">
            <p className="item-drawer-error">{state.message}</p>
          </div>
        )}

        {detail && <ItemDrawerBody detail={detail} />}
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
