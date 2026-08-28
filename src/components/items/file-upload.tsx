"use client";

import { FileUp, Loader2, X } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  acceptAttribute,
  uploadConstraint,
  validateUpload,
  type UploadKind,
} from "@/lib/file-constraints";
import {
  uploadFile,
  UploadError,
  UPLOAD_UNREACHABLE,
  type UploadedFile,
} from "@/lib/upload-file";
import { formatFileSize } from "@/lib/utils";

export type { UploadedFile };

interface FileUploadProps {
  kind: UploadKind;
  /** The file already uploaded, or null while there is none. */
  value: UploadedFile | null;
  onChange: (file: UploadedFile | null) => void;
  /** Blocks the picker while the surrounding form is submitting. */
  disabled?: boolean;
}

/**
 * The drop zone the create dialog shows for File and Image items.
 *
 * The file is uploaded as soon as it is chosen rather than with the form: the
 * item stores an object key, so the object has to exist before there is
 * anything to store. Cancelling the dialog afterwards leaves that object
 * behind — see the route for why that is the accepted cost.
 *
 * It takes two requests. The app authorises the upload and hands back a signed
 * URL; the browser then PUTs the file straight at R2, so the bytes never pass
 * through the app and a 100 MB file is not a 100 MB request to our own server.
 * Progress is measured on that second request, which is the long one.
 *
 * `XMLHttpRequest` rather than `fetch` for the PUT, which reports no upload
 * progress: it resolves when the response arrives, by which point the transfer
 * it would have been describing is over.
 */
export function FileUpload({
  kind,
  value,
  onChange,
  disabled = false,
}: FileUploadProps) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploading = progress !== null;
  const busy = uploading || disabled;
  const { maxBytes, extensions } = uploadConstraint(kind);

  async function upload(chosen: File) {
    // The same rules the route enforces, run here so an obviously wrong file
    // costs no round trip. The route is still the rule.
    const problem = validateUpload(kind, {
      name: chosen.name,
      type: chosen.type,
      size: chosen.size,
    });

    if (problem) {
      setError(problem);
      return;
    }

    setError(null);
    setProgress(0);

    try {
      const stored = await uploadFile(kind, chosen, setProgress);

      setProgress(null);

      // Aborted: nothing was stored, and nothing is worth saying about it.
      if (stored) {
        onChange(stored);
      }
    } catch (failure) {
      setProgress(null);
      // Anything that is not an `UploadError` is a throw we did not plan for —
      // a TypeError out of `fetch`, say — whose message is no use to a visitor.
      setError(
        failure instanceof UploadError ? failure.message : UPLOAD_UNREACHABLE,
      );
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);

    if (busy) return;

    const [file] = Array.from(event.dataTransfer.files);

    if (file) {
      void upload(file);
    }
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    // Without this the browser takes the drop itself and navigates to the file.
    event.preventDefault();

    if (!busy) {
      setDragging(true);
    }
  }

  function clear() {
    // Only the item's reference goes: the object stays in R2, since nothing has
    // pointed at it yet and there is no item to delete it with.
    onChange(null);
    setError(null);

    // The input keeps the cleared file otherwise, so choosing it again would
    // fire no change event.
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  if (value) {
    return (
      <div className="file-upload-chosen">
        <FileUp size={16} aria-hidden />

        <span className="file-upload-name">{value.name}</span>
        <span className="file-upload-size">{formatFileSize(value.size)}</span>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={clear}
          disabled={disabled}
          aria-label="Remove file"
        >
          <X size={16} aria-hidden />
        </Button>
      </div>
    );
  }

  return (
    <div className="file-upload">
      {/* The input covers the zone rather than being replaced by a button, so
          a click anywhere opens the picker while the real control keeps its own
          focus ring and keyboard behaviour. */}
      <div
        className="file-upload-zone"
        data-dragging={dragging}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          className="file-upload-input"
          accept={acceptAttribute(kind)}
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];

            if (file) {
              void upload(file);
            }
          }}
          aria-label={kind === "image" ? "Upload an image" : "Upload a file"}
        />

        {uploading ? (
          <>
            <Loader2 size={20} className="file-upload-spinner" aria-hidden />
            <p className="file-upload-label">Uploading… {progress}%</p>
            <progress className="file-upload-progress" value={progress} max={100}>
              {progress}%
            </progress>
          </>
        ) : (
          <>
            <FileUp size={20} aria-hidden />
            <p className="file-upload-label">
              Drop {kind === "image" ? "an image" : "a file"} here, or click to
              choose one.
            </p>
            <p className="file-upload-hint">
              {extensions.join(", ")} · up to {formatFileSize(maxBytes)}
            </p>
          </>
        )}
      </div>

      {error && (
        <p className="item-drawer-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
