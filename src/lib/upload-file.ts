import type { UploadKind } from "@/lib/file-constraints";

/**
 * The two requests an upload takes, without the form field they were first
 * written inside.
 *
 * The app authorises the upload and hands back a signed URL; the browser then
 * PUTs the file straight at R2, so the bytes never pass through the app and a
 * 100 MB file is not a 100 MB request to our own server. Progress is measured
 * on that second request, which is the long one.
 *
 * Browser-only — `XMLHttpRequest` and a relative `fetch` — so nothing on the
 * server may import this.
 */

/** Said when the request never reached the route, so it named no reason. */
export const UPLOAD_UNREACHABLE = "Could not reach the server. Try again.";

/**
 * Said when R2 refused the PUT.
 *
 * Deliberately generic: the bucket answers in XML rather than in our JSON, and
 * for an expired URL it omits the CORS headers altogether, so the browser will
 * not let us read the reason even when there is one. The realistic causes — an
 * expired signature, or a bucket whose CORS policy does not allow this origin —
 * are all "start again", and none of them is the visitor's to fix.
 */
export const UPLOAD_STORAGE_REFUSED = "Could not store that file. Try again.";

/** A failure with something worth showing, as against an unexpected throw. */
export class UploadError extends Error {}

/**
 * The account has authorised too many uploads recently.
 *
 * Its own class because it is the one failure that says something about the
 * *batch* rather than about the file: every upload still queued behind it will
 * be refused for the same reason, so a caller running several should stop
 * rather than collect the same message once per file.
 */
export class UploadRateLimitedError extends UploadError {}

/**
 * The account may not upload at all — uploads are a Pro feature.
 *
 * Its own class for the reason `UploadRateLimitedError` has one: it says
 * something about the *account* rather than about the file, so every upload
 * queued behind it is refused for the same reason and a caller running several
 * should stop rather than repeat one notice per file. Unlike the rate limit it
 * will not pass with time, which makes stopping the more obviously right thing.
 */
export class UploadNotAllowedError extends UploadError {}

/** The stored object, and what a create payload then carries a part of. */
export interface UploadedFile {
  /** The R2 object key. */
  key: string;
  name: string;
  /**
   * Shown while the upload is on screen. It is not sent with the create
   * payload — the server asks R2 for the size it actually stored.
   */
  size: number;
}

/**
 * Uploads one file and answers with the object it stored, or `null` when the
 * transfer was aborted.
 *
 * Throws an `UploadError` for a failure with a message worth showing. Anything
 * else that comes out of here is a throw we did not plan for — a `TypeError`
 * out of `fetch`, say — whose message is no use to a visitor, so a caller
 * should fall back to `UPLOAD_UNREACHABLE` for those.
 */
export async function uploadFile(
  kind: UploadKind,
  file: File,
  onProgress: (percent: number) => void,
): Promise<UploadedFile | null> {
  const { key, url, contentType } = await authorise(kind, file);
  const outcome = await store(url, contentType, file, onProgress);

  if (outcome === "aborted") {
    return null;
  }

  return { key, name: file.name, size: file.size };
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

  if (response.status === 403) {
    throw new UploadNotAllowedError(payload?.error || UPLOAD_UNREACHABLE);
  }

  if (response.status === 429) {
    throw new UploadRateLimitedError(payload?.error || UPLOAD_UNREACHABLE);
  }

  if (!response.ok) {
    throw new UploadError(payload?.error || UPLOAD_UNREACHABLE);
  }

  if (!payload?.url || !payload.key || !payload.contentType) {
    throw new UploadError(UPLOAD_UNREACHABLE);
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
 * cap something R2 enforces rather than something a form asks for.
 *
 * `XMLHttpRequest` rather than `fetch`, which reports no upload progress: it
 * resolves when the response arrives, by which point the transfer it would have
 * been describing is over.
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

      reject(new UploadError(UPLOAD_STORAGE_REFUSED));
    });

    // Offline, a dropped connection, the visitor navigating away mid-upload —
    // and also a CORS rejection, which reaches the page as an indistinguishable
    // network error with a status of 0.
    request.addEventListener("error", () => {
      reject(new UploadError(UPLOAD_STORAGE_REFUSED));
    });

    request.addEventListener("abort", () => resolve("aborted"));

    request.open("PUT", url);
    request.setRequestHeader("Content-Type", contentType);
    request.send(file);
  });
}
