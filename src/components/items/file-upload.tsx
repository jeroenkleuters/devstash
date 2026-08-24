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
import { formatFileSize } from "@/lib/utils";

/** What the upload route answers with, and what the create payload carries. */
export interface UploadedFile {
  /** The R2 object key. */
  key: string;
  name: string;
  size: number;
}

/** Said when the request never reached the route, so it named no reason. */
const UNREACHABLE = "Could not reach the server. Try again.";

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
 * `XMLHttpRequest` rather than `fetch`, which reports no upload progress: it
 * resolves when the response arrives, by which point the transfer it would have
 * been describing is over.
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

  function upload(file: File) {
    // The same rules the route enforces, run here so an obviously wrong file
    // costs no round trip. The route is still the rule.
    const problem = validateUpload(kind, {
      name: file.name,
      type: file.type,
      size: file.size,
    });

    if (problem) {
      setError(problem);
      return;
    }

    setError(null);
    setProgress(0);

    const body = new FormData();
    body.set("kind", kind);
    body.set("file", file);

    const request = new XMLHttpRequest();

    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        setProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    request.addEventListener("load", () => {
      setProgress(null);

      const payload = parse(request.responseText);

      if (request.status !== 200) {
        setError(payload?.error || UNREACHABLE);
        return;
      }

      if (!payload?.key) {
        setError(UNREACHABLE);
        return;
      }

      onChange({ key: payload.key, name: payload.name, size: payload.size });
    });

    // Offline, a dropped connection, or the visitor navigating away mid-upload.
    request.addEventListener("error", () => {
      setProgress(null);
      setError(UNREACHABLE);
    });

    request.addEventListener("abort", () => {
      setProgress(null);
    });

    request.open("POST", "/api/upload");
    request.send(body);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);

    if (busy) return;

    const [file] = Array.from(event.dataTransfer.files);

    if (file) {
      upload(file);
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
              upload(file);
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

interface UploadResponse {
  key?: string;
  name?: string;
  size?: number;
  error?: string;
}

/**
 * The route answers JSON either way, but a proxy or a crash in front of it may
 * not — so a body that will not parse is treated as no body at all.
 */
function parse(body: string): Required<UploadResponse> | null {
  try {
    const payload = JSON.parse(body) as UploadResponse;

    return {
      key: payload.key ?? "",
      name: payload.name ?? "",
      size: payload.size ?? 0,
      error: payload.error ?? "",
    };
  } catch {
    return null;
  }
}
