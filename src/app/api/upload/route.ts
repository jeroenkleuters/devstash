import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/db/user";
import { uploadContentType, validateUpload } from "@/lib/file-constraints";
import { objectKey, presignPut } from "@/lib/r2";
import { rateLimit, tooManyAttemptsResponse } from "@/lib/rate-limit";
import { firstIssueMessage } from "@/lib/validations/auth";
import { presignUploadSchema } from "@/lib/validations/item";

// Reads the session and signs against live credentials, so there is nothing
// here to cache.
export const dynamic = "force-dynamic";

/**
 * The limit this route applies, and why there is one: sized against storage
 * rather than against guessing, since every authorised call can put an object
 * in the bucket that nothing else deletes and the app has no quota of its own.
 *
 * The numbers are no longer written here. They are the *defaults* now — 30 in
 * 15 minutes, in `DEFAULT_UPLOAD_PREFERENCES` — because an account can raise
 * them on the settings page, and stating them in two places would let this
 * route and that card disagree. What is still decided here is that the limit is
 * applied at all, and that it is keyed on the account.
 *
 * The ceiling is not here either, and deliberately so: `uploadPreferencesSchema`
 * accepts only the counts and windows the card offers, on the way in and again
 * on the way out, so nothing this route reads can exceed what the app offered.
 */

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
  // The whole row rather than the id alone: the account's own limit is on it,
  // and `getCurrentUser` is `cache`d, so this is the same one query either way.
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  // Ahead of the rate limit, because a free account should be told it needs Pro
  // rather than told to wait for a window that will refuse it again.
  //
  // `isPro` alone is enough only because every type holding an upload is a Pro
  // type — see `PRO_TYPE_SLUGS`. This route is given an `UploadKind`
  // (`"file"` / `"image"`) and never the item type slug, so it cannot tell a
  // book's cover from an ordinary image. **If a free type ever gains an upload,
  // this is the line that breaks first, and it breaks permissively:** the
  // upload would be authorised and only `createItem` would refuse the type,
  // leaving an object in the bucket with no item pointing at it.
  if (!user.isPro) {
    return NextResponse.json(
      { error: "Uploads are a Pro feature. Upgrade in Settings." },
      { status: 403 },
    );
  }

  // Whatever the account chose, or the defaults above. Read through
  // `parseUploadPreferences`, which refuses anything outside the offered set —
  // so a value written around the app cannot raise the ceiling either.
  const { limit: uploadLimit, windowMs } = user.uploadPreferences;

  // Keyed on the account rather than the caller: it is this user's storage
  // being spent, and they are already known by the time we get here.
  const limit = await rateLimit(`upload:${user.id}`, uploadLimit, windowMs);

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

  const key = objectKey(user.id, name);
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
