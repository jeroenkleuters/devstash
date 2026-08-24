import { NextResponse } from "next/server";

import { getCurrentUserId } from "@/lib/db/user";
import { uploadContentType, validateUpload } from "@/lib/file-constraints";
import { objectKey, presignPut } from "@/lib/r2";
import { rateLimit, tooManyAttemptsResponse } from "@/lib/rate-limit";
import { firstIssueMessage } from "@/lib/validations/auth";
import { presignUploadSchema } from "@/lib/validations/item";

// Reads the session and signs against live credentials, so there is nothing
// here to cache.
export const dynamic = "force-dynamic";

/**
 * Sized against storage rather than against guessing: every authorised call can
 * put an object in the bucket that nothing else deletes, and the app has no
 * quota of its own.
 */
const UPLOAD_LIMIT = 30;
const UPLOAD_WINDOW_MS = 15 * 60 * 1000;

/**
 * Authorises one upload and answers with a URL the browser PUTs the file to
 * directly.
 *
 * The file does not come through here. That is the point: a 100 MB body would
 * have to fit inside the platform's request-body limit and be held in a
 * serverless function while it arrived, so instead this signs a URL for the
 * object the caller says it is about to store, and the bytes go straight to R2.
 *
 * What that costs is that nothing here has seen the file — every value in the
 * request is a claim about one still sitting on the visitor's machine. Two
 * things make the claims safe to act on. The size is checked against the cap and
 * then **signed into the URL**, so R2 refuses a body of any other length; and
 * `createItem` asks R2 what it actually stored rather than believing anything
 * the browser reports afterwards.
 *
 * An API route rather than a server action, for the reason coding-standards
 * carves out — this is the endpoint an upload with progress is built around.
 *
 * Deliberately outside the proxy's matcher, like `/api/items/[id]`: the proxy
 * answers an unauthenticated request with a redirect to the sign-in page, which
 * a `fetch` would receive as an opaque 200 of HTML. The check lives here and
 * says 401 so the caller can tell.
 *
 * The object is written before any item exists, so a file uploaded and then
 * abandoned leaves an object behind. That is the accepted cost of uploading
 * before the item is created — and it is a larger cost than it was, since an
 * orphan can now be 100 MB.
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

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Send the upload details as JSON." },
      { status: 400 },
    );
  }

  const parsed = presignUploadSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: firstIssueMessage(parsed.error) },
      { status: 400 },
    );
  }

  const { kind, name, type, size } = parsed.data;

  // The same rules the form runs before it asks. That copy is the caller's to
  // skip, so this one is the rule — and the size it checks is the size the URL
  // is then signed for, which is what stops the claim and the body diverging.
  const problem = validateUpload(kind, { name, type, size });

  if (problem) {
    return NextResponse.json({ error: problem }, { status: 400 });
  }

  const key = objectKey(userId, name);
  // From the extension, not from what the browser reported — see
  // `uploadContentType`. Signed into the URL, so the object cannot be stored as
  // anything else, and returned so the caller knows what header to send.
  const contentType = uploadContentType(kind, name);

  try {
    const url = await presignPut(key, contentType, size);

    return NextResponse.json({ key, url, contentType });
  } catch (error) {
    // Missing credentials, or a bucket name that is not there. None of it is
    // the visitor's to fix, so log it and say the one useful thing.
    console.error("presign failed", error);

    return NextResponse.json(
      { error: "Could not start that upload. Try again." },
      { status: 502 },
    );
  }
}
