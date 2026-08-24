import { NextResponse } from "next/server";

import { getCurrentUserId } from "@/lib/db/user";
import {
  uploadContentType,
  validateUpload,
  type UploadKind,
} from "@/lib/file-constraints";
import { objectKey, putFile } from "@/lib/r2";
import { rateLimit, tooManyAttemptsResponse } from "@/lib/rate-limit";

// Reads the session and writes to R2, so there is nothing here to cache.
export const dynamic = "force-dynamic";

/**
 * Sized against storage rather than against guessing: every accepted call
 * writes an object nothing else deletes, and the app has no quota of its own.
 */
const UPLOAD_LIMIT = 30;
const UPLOAD_WINDOW_MS = 15 * 60 * 1000;

const UPLOAD_KINDS: readonly string[] = ["image", "file"];

function isUploadKind(value: unknown): value is UploadKind {
  return typeof value === "string" && UPLOAD_KINDS.includes(value);
}

/**
 * Takes one file for a File or Image item and puts it in R2, answering with the
 * object key the create payload then carries.
 *
 * An API route rather than a server action, for the reason coding-standards
 * carves out: an action gives the browser no upload progress to show, and this
 * is a multipart body rather than a form of fields.
 *
 * Deliberately outside the proxy's matcher, like `/api/items/[id]`: the proxy
 * answers an unauthenticated request with a redirect to the sign-in page, which
 * a `fetch` would receive as an opaque 200 of HTML. The check lives here and
 * says 401 so the caller can tell.
 *
 * The object is written before any item exists, so a file picked and then
 * abandoned leaves an object behind. That is the accepted cost of showing
 * progress before the item is created — nothing else can be uploading while the
 * form is still being filled in.
 */
export async function POST(request: Request) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  // Keyed on the account rather than the caller: it is this user's storage
  // being spent, and they are already known by the time we get here.
  const limit = await rateLimit(
    `upload:${userId}`,
    UPLOAD_LIMIT,
    UPLOAD_WINDOW_MS,
  );

  if (!limit.success) {
    return tooManyAttemptsResponse(limit);
  }

  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Send the file as multipart form data." },
      { status: 400 },
    );
  }

  const kind = form.get("kind");
  const file = form.get("file");

  if (!isUploadKind(kind)) {
    return NextResponse.json(
      { error: "Say whether this is an image or a file." },
      { status: 400 },
    );
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was sent." }, { status: 400 });
  }

  // The same rules the form runs before it uploads. That copy is the caller's
  // to skip, so this one is the rule.
  const problem = validateUpload(kind, {
    name: file.name,
    type: file.type,
    size: file.size,
  });

  if (problem) {
    return NextResponse.json({ error: problem }, { status: 400 });
  }

  const key = objectKey(userId, file.name);

  try {
    await putFile(
      key,
      new Uint8Array(await file.arrayBuffer()),
      // From the extension, not from what the browser reported — see
      // `uploadContentType`.
      uploadContentType(kind, file.name),
    );
  } catch (error) {
    // Missing credentials, a bucket that is not there, R2 being down. None of
    // it is the visitor's to fix, so log it and say the one useful thing.
    console.error("upload failed", error);

    return NextResponse.json(
      { error: "Could not store that file. Try again." },
      { status: 502 },
    );
  }

  return NextResponse.json({ key, name: file.name, size: file.size });
}
