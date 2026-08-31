"use client";

import { AlertCircle, Check, FileUp, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { createItem } from "@/actions/items";
import { Button } from "@/components/ui/button";
import {
  uploadConstraint,
  validateUpload,
  type UploadKind,
} from "@/lib/file-constraints";
import { titleFromFileName } from "@/lib/file-title";
import {
  uploadFile,
  UploadError,
  UploadNotAllowedError,
  UploadRateLimitedError,
  UPLOAD_UNREACHABLE,
} from "@/lib/upload-file";

/** Said when the create action never answered, so it named no reason. */
const CREATE_UNREACHABLE = "Could not reach the server. Try again.";

/** Said for a file the batch stopped before reaching. */
const NOT_ATTEMPTED = "Not uploaded — the batch stopped first.";

/** Stands in for a name the filename left nothing usable of. */
const UNTITLED = "Untitled";

/** Where one dropped file has got to. */
type DropStatus = "waiting" | "uploading" | "creating" | "done" | "failed";

interface DroppedFile {
  id: number;
  name: string;
  status: DropStatus;
  /** 0-100 while uploading. */
  progress: number;
  /** Set only when `status` is "failed". */
  error?: string;
}

interface ItemDropZoneProps {
  kind: UploadKind;
  /** The type every item in the batch is created as. */
  typeSlug: string;
  /** The listing the zone wraps. */
  children: ReactNode;
}

/**
 * Turns the file and image listings into a drop target for whole batches.
 *
 * There is no form here, so the item a dropped file becomes is the file: it is
 * titled after its name and nothing else is set. Description is already gated
 * off for these two types, and tags, collections and the rest are the drawer's
 * job afterwards.
 *
 * Files are taken one at a time rather than in parallel. `POST /api/upload` is
 * rate limited per account (30 in 15 minutes), so a large batch can run into it
 * — and a sequential run means that arrives as one clear stop with the rest
 * left alone, instead of a dozen simultaneous failures that read as a broken
 * drop.
 */
export function ItemDropZone({ kind, typeSlug, children }: ItemDropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<DroppedFile[]>([]);
  const [running, setRunning] = useState(false);
  const router = useRouter();

  /**
   * How many nested elements the drag is currently inside.
   *
   * `dragleave` fires every time the pointer crosses into a child, so a plain
   * boolean would flicker off the moment the drag moved over a card. Counting
   * enter against leave is what makes "left the zone" mean the zone.
   */
  const depth = useRef(0);

  const { extensions } = uploadConstraint(kind);
  const noun = kind === "image" ? "images" : "files";

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    if (!carriesFiles(event) || running) return;

    depth.current += 1;
    setDragging(true);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    if (!carriesFiles(event)) return;

    // Without this the browser takes the drop itself and navigates to the file.
    event.preventDefault();
  }

  function handleDragLeave() {
    depth.current = Math.max(0, depth.current - 1);

    if (depth.current === 0) {
      setDragging(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    if (!carriesFiles(event)) return;

    event.preventDefault();
    depth.current = 0;
    setDragging(false);

    if (running) return;

    const dropped = Array.from(event.dataTransfer.files);

    if (dropped.length > 0) {
      void run(dropped);
    }
  }

  /**
   * Uploads each file and creates its item, in order.
   *
   * Every file is validated up front so an obviously wrong one is named
   * immediately rather than after the ones before it have finished, and so a
   * batch that is entirely wrong costs no requests at all.
   */
  async function run(dropped: File[]) {
    const queue = dropped.map((file, index) => ({
      file,
      entry: {
        id: index,
        name: file.name,
        progress: 0,
        ...describe(kind, file),
      } satisfies DroppedFile,
    }));

    setFiles(queue.map(({ entry }) => entry));
    setRunning(true);

    let created = 0;
    let stopped = false;

    for (const { file, entry } of queue) {
      // Refused before anything was sent - its message is already on screen.
      if (entry.status === "failed") continue;

      if (stopped) {
        update(entry.id, { status: "failed", error: NOT_ATTEMPTED });
        continue;
      }

      update(entry.id, { status: "uploading", progress: 0 });

      try {
        const stored = await uploadFile(kind, file, (progress) =>
          update(entry.id, { progress }),
        );

        // Aborted rather than refused: nothing was stored, and nothing here
        // aborts an upload, so this is the visitor leaving the page.
        if (!stored) {
          update(entry.id, { status: "failed", error: NOT_ATTEMPTED });
          continue;
        }

        update(entry.id, { status: "creating", progress: 100 });

        // The action answers a failed *write* with `{ success: false }`, but a
        // failed *request* rejects instead — so without this catch one dropped
        // connection would reject out of the loop and abandon the rest.
        // Every optional text field is spelled out, empty. They are
        // `.nullable()` rather than `.optional()` in `createItemSchema`, so an
        // omitted one is not "nothing to say" — it is `undefined`, which fails
        // the parse *after* the object is already in R2 and orphans it. This
        // payload is hand-built rather than taken from `ItemFormValues`, so
        // adding a field to `itemFields` will not update it: the drop-zone
        // cases in `src/lib/validations/item.test.ts` are what catch that.
        const result = await createItem({
          typeSlug,
          title: titleFromFileName(stored.name) || UNTITLED,
          description: "",
          content: "",
          url: "",
          language: "",
          author: "",
          tags: [],
          collectionIds: [],
          file: { key: stored.key, name: stored.name },
        }).catch(() => null);

        if (!result?.success) {
          update(entry.id, {
            status: "failed",
            error: result?.error ?? CREATE_UNREACHABLE,
          });
          continue;
        }

        created += 1;
        update(entry.id, { status: "done" });
      } catch (failure) {
        // Either the account may not upload at all, or it is over its
        // allowance. Both are about the account rather than this file, so every
        // file still queued would be refused for the same reason — stop rather
        // than repeat the same notice once per file.
        if (
          failure instanceof UploadNotAllowedError ||
          failure instanceof UploadRateLimitedError
        ) {
          stopped = true;
        }

        update(entry.id, {
          status: "failed",
          error:
            failure instanceof UploadError
              ? failure.message
              : UPLOAD_UNREACHABLE,
        });
      }
    }

    setRunning(false);

    if (created > 0) {
      toast.success(
        created === 1 ? "1 item created" : `${created} items created`,
      );

      // The rows, the sidebar per-type counts and the stat cards are all
      // server-rendered. Once for the batch rather than once per file.
      router.refresh();
    }

    const failed = queue.length - created;

    if (failed > 0) {
      toast.error(
        failed === 1 ? "1 file was not added" : `${failed} files were not added`,
      );
    }
  }

  function update(id: number, patch: Partial<DroppedFile>) {
    setFiles((current) =>
      current.map((file) => (file.id === id ? { ...file, ...patch } : file)),
    );
  }

  return (
    <div
      className="item-drop-zone"
      data-type={typeSlug}
      data-dragging={dragging}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {files.length > 0 && (
        <div className="item-drop-progress">
          <div className="item-drop-progress-head">
            <h2>{running ? `Adding ${noun}…` : `Finished adding ${noun}`}</h2>

            {!running && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setFiles([])}
                aria-label="Dismiss"
              >
                <X size={16} aria-hidden />
              </Button>
            )}
          </div>

          <ul className="item-drop-list">
            {files.map((file) => (
              <li
                key={file.id}
                className="item-drop-row"
                data-status={file.status}
              >
                <DropStatusIcon status={file.status} />

                <span className="item-drop-name">{file.name}</span>

                {file.status === "uploading" && (
                  <span className="item-drop-note">{file.progress}%</span>
                )}

                {file.status === "creating" && (
                  <span className="item-drop-note">Saving…</span>
                )}

                {file.status === "failed" && (
                  <span className="item-drop-note">{file.error}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {children}

      {dragging && (
        <div className="item-drop-overlay" aria-hidden>
          <FileUp size={24} />
          <p className="item-drop-overlay-label">
            Drop to add {noun} to your stash
          </p>
          <p className="item-drop-overlay-hint">{extensions.join(", ")}</p>
        </div>
      )}
    </div>
  );
}

function DropStatusIcon({ status }: { status: DropStatus }) {
  switch (status) {
    case "done":
      return <Check size={16} aria-hidden />;
    case "failed":
      return <AlertCircle size={16} aria-hidden />;
    case "waiting":
      return <FileUp size={16} aria-hidden />;
    default:
      return <Loader2 size={16} className="spinner" aria-hidden />;
  }
}

/**
 * Whether a drag carries files, as against selected text or a dragged link.
 *
 * The file *contents* are not readable during a drag, but the types are, which
 * is enough to leave an unrelated drag alone rather than covering the listing
 * with an overlay it has no use for.
 */
function carriesFiles(event: DragEvent<HTMLDivElement>) {
  return Array.from(event.dataTransfer.types).includes("Files");
}

/** A file starting state: already refused, or waiting its turn. */
function describe(kind: UploadKind, file: File) {
  const problem = validateUpload(kind, {
    name: file.name,
    type: file.type,
    size: file.size,
  });

  return problem
    ? { status: "failed" as const, error: problem }
    : { status: "waiting" as const };
}
