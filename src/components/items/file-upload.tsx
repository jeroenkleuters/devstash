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

/** The stored object, and what the create payload then carries a part of. */
export interface UploadedFile {
  /** The R2 object key. */
  key: string;
  name: string;
  /**
   * Shown while the dialog is open. It is not sent with the create payload —
   * the server asks R2 for the size it actually stored.
   */
  size: number;
}

/** Said when the request never reached the route, so it named no reason. */
const UNREACHABLE = "Could not reach the server. Try again.";

/**
 * Said when R2 refused the PUT.
 *
 * Deliberately generic: the bucket answers in XML rather than in our JSON, and
 * for an expired URL it omits the CORS headers altogether, so the browser will
 * not let us read the reason even when there is one. The realistic causes — an
 * expired signature, or a bucket whose CORS policy does not allow this origin —
 * are all "start again", and none of them is the visitor's to fix.
 */
const STORAGE_REFUSED = "Could not store that file. Try again.";

/** A failure with something worth showing, as against an unexpected throw. */
class UploadError extends Error {}

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
      const { key, url, contentType } = await authorise(kind, chosen);
      const outcome = await store(url, contentType, chosen, setProgress);

      setProgress(null);

      if (outcome === "aborted") {
        return;
      }

      onChange({ key, name: chosen.name, size: chosen.size });
    } catch (failure) {
      setProgress(null);
      // Anything that is not an `UploadError` is a throw we did not plan for —
      // a TypeError out of `fetch`, say — whose message is no use to a visitor.
      setError(failure instanceof UploadError ? failure.message : UNREACHABLE);
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

/** What the route answers with once it has signed an upload. */
interface Authorised {
  key: string;
  url: string;
  contentType: string;
}

interface AuthoriseResponse {
  key?: string;
  url?: string;
  contentType?: string;
  error?: string;
}

/**
 * Asks the app to authorise this upload, describing the file rather than
 * sending it.
 *
 * `fetch` here rather than XHR: this request is a few hundred bytes, so there
 * is no progress worth reporting until the PUT that follows it.
 */
async function authorise(kind: UploadKind, file: File): Promise<Authorised> {
  const response = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind,
      name: file.name,
      type: file.type,
      size: file.size,
    }),
  });

  // The route answers JSON either way, but a proxy or a crash in front of it
  // may not — so a body that will not parse is treated as no body at all.
  const payload = (await response
    .json()
    .catch(() => null)) as AuthoriseResponse | null;

  if (!response.ok) {
    throw new UploadError(payload?.error || UNREACHABLE);
  }

  if (!payload?.url || !payload.key || !payload.contentType) {
    throw new UploadError(UNREACHABLE);
  }

  return {
    key: payload.key,
    url: payload.url,
    contentType: payload.contentType,
  };
}

/**
 * Puts the file in R2 over the signed URL.
 *
 * `Content-Type` has to be the type the URL was signed for, or the signature
 * does not match and the bucket refuses the object. `Content-Length` is set by
 * the browser from the body — it is signed too, which is what makes the size
 * cap something R2 enforces rather than something this form asks for.
 */
function store(
  url: string,
  contentType: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<"done" | "aborted"> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        resolve("done");
        return;
      }

      reject(new UploadError(STORAGE_REFUSED));
    });

    // Offline, a dropped connection, the visitor navigating away mid-upload —
    // and also a CORS rejection, which reaches the page as an indistinguishable
    // network error with a status of 0.
    request.addEventListener("error", () => {
      reject(new UploadError(STORAGE_REFUSED));
    });

    request.addEventListener("abort", () => resolve("aborted"));

    request.open("PUT", url);
    request.setRequestHeader("Content-Type", contentType);
    request.send(file);
  });
}
