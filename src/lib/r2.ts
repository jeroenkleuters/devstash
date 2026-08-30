import { randomUUID } from "node:crypto";

import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  NoSuchKey,
  NotFound,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { fileExtension } from "@/lib/file-constraints";

/**
 * The R2 client, created once per process like the other third-party
 * singletons. R2 speaks S3, so this is the AWS client pointed at Cloudflare's
 * endpoint; `region: "auto"` is what R2 expects, since it has no regions.
 *
 * Credentials are read lazily rather than at module load: importing this file
 * must not crash a build, or a request that never touches a file.
 */
let client: S3Client | null = null;

function getR2(): S3Client {
  if (!client) {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error("R2 credentials are not set");
    }

    client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
      // Off unless an operation actually requires it, which none of ours does.
      //
      // The default ("WHEN_SUPPORTED") makes the SDK checksum every PutObject
      // body — and a presigned command has no body, so it takes the CRC32 of
      // nothing and hoists `x-amz-checksum-crc32=AAAAAA==` into the URL. The
      // browser then PUTs the real file against a checksum of an empty one,
      // which the store is entitled to reject. Nothing about that is visible
      // until an upload fails, so it is switched off here rather than worked
      // around at the call site.
      requestChecksumCalculation: "WHEN_REQUIRED",
    });
  }

  return client;
}

function bucket(): string {
  const name = process.env.R2_BUCKET_NAME;

  if (!name) {
    throw new Error("R2_BUCKET_NAME is not set");
  }

  return name;
}

/**
 * Where one user's upload lives.
 *
 * The original filename is not part of the key — it is stored on the item as
 * `fileName` instead, which sidesteps sanitizing user input into a path and
 * makes two files of the same name two objects. The user id prefix is what
 * `ownsObjectKey` reads.
 */
export function objectKey(userId: string, fileName: string): string {
  return `uploads/${userId}/${randomUUID()}${fileExtension(fileName)}`;
}

/**
 * Whether a key is inside this user's own prefix.
 *
 * Ownership is really settled by the item row the key hangs off, which is
 * always read with `userId` in the `where`. This is the second lock: a key that
 * arrives from a request — as it does on create — cannot name an object the
 * caller never uploaded.
 *
 * The trailing slash is load-bearing: without it `uploads/user-10/…` sits
 * inside `user-1`'s prefix. A `..` segment is refused as well — S3 keys are
 * opaque strings rather than paths, so it is not traversal at the store, but
 * the key arrives from a request and nothing is served by letting one climb.
 */
export function ownsObjectKey(userId: string, key: string): boolean {
  if (key.split("/").includes("..")) {
    return false;
  }

  return key.startsWith(`uploads/${userId}/`);
}

/**
 * How long an upload URL is good for. Long enough to cover a slow start on a
 * bad connection, short enough that a leaked URL is not a standing write
 * permission — the transfer itself may outlast it, since expiry is checked when
 * the request is received rather than while it streams.
 */
const UPLOAD_URL_TTL_SECONDS = 5 * 60;

/**
 * A URL the browser can PUT one object to, straight at the bucket.
 *
 * This is what keeps the bytes out of the app: a 100 MB upload through a Next
 * route would have to fit in the platform's request-body limit, and a serverless
 * function would be paid for holding it.
 *
 * **Both `content-type` and `content-length` are signed**, which is what turns
 * the size cap from a rule the form states into one the store enforces:
 *
 * - `content-type` is in the presigner's unsignable set by default, so naming it
 *   here is what makes R2 refuse a body sent as anything else.
 * - `content-length` is signed by default once the command carries one, and the
 *   browser sets that header itself from the body it is given — so a body of any
 *   other length fails the signature. It is named here anyway, because the
 *   guarantee is the whole point and a default is a quiet thing to rest one on.
 *
 * The payload itself is `UNSIGNED-PAYLOAD` — the SDK sets that for every
 * presigned URL — so this pins how many bytes may be stored, never which.
 */
export async function presignPut(
  key: string,
  contentType: string,
  contentLength: number,
): Promise<string> {
  return getSignedUrl(
    getR2(),
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    }),
    {
      expiresIn: UPLOAD_URL_TTL_SECONDS,
      signableHeaders: new Set(["content-type", "content-length"]),
    },
  );
}

/** What the bucket says about an object without sending it. */
export interface StoredObject {
  /** `null` for the rare object stored without a length R2 will report. */
  size: number | null;
}

/**
 * What the bucket holds under a key, or `null` when it holds nothing.
 *
 * The upload no longer passes through the app, so this is how the server learns
 * anything true about a file: `createItem` asks before attaching a key, which
 * both refuses a key nothing was ever uploaded to and gives the item R2's own
 * size rather than a number the client supplied.
 */
export async function headFile(key: string): Promise<StoredObject | null> {
  try {
    const object = await getR2().send(
      new HeadObjectCommand({ Bucket: bucket(), Key: key }),
    );

    return { size: object.ContentLength ?? null };
  } catch (error) {
    if (isMissing(error)) {
      return null;
    }

    throw error;
  }
}

/**
 * Whether an error means "no such object" rather than something worth raising.
 *
 * The status is checked as well as the modelled exceptions: a HEAD carries no
 * body for the SDK to read an error code out of, so a missing key can arrive as
 * a bare 404 rather than as `NotFound`.
 */
function isMissing(error: unknown): boolean {
  if (error instanceof NotFound || error instanceof NoSuchKey) {
    return true;
  }

  const status = (error as { $metadata?: { httpStatusCode?: number } } | null)
    ?.$metadata?.httpStatusCode;

  return status === 404;
}

/** What the download route needs to answer with. */
export interface StoredFile {
  body: ReadableStream<Uint8Array>;
  contentType: string;
  contentLength: number | null;
}

/**
 * The object itself, or `null` when the bucket no longer holds it — which is
 * possible for a row that still names it, since the two stores can only be kept
 * in step by convention.
 */
export async function getFile(key: string): Promise<StoredFile | null> {
  let object;

  try {
    object = await getR2().send(
      new GetObjectCommand({ Bucket: bucket(), Key: key }),
    );
  } catch (error) {
    if (error instanceof NoSuchKey) {
      return null;
    }

    throw error;
  }

  if (!object.Body) {
    return null;
  }

  return {
    body: object.Body.transformToWebStream(),
    contentType: object.ContentType ?? "application/octet-stream",
    contentLength: object.ContentLength ?? null,
  };
}

/**
 * Removes one object. S3 deletes are idempotent — a key that is already gone is
 * not an error — so this throwing means the delete genuinely did not happen,
 * which is what lets the item delete refuse to go ahead.
 */
export async function deleteFile(key: string): Promise<void> {
  await getR2().send(
    new DeleteObjectCommand({ Bucket: bucket(), Key: key }),
  );
}

/**
 * The S3 API's cap on one `DeleteObjects` request, which R2 implements.
 */
const DELETE_BATCH_SIZE = 1000;

/**
 * Removes many objects, in as few round trips as the API allows.
 *
 * **A partial failure is a 200 carrying an `Errors` array rather than a throw**,
 * so a `try`/`catch` alone would read one as a success. That matters most where
 * this is called from: account deletion treats a rejection as "these objects are
 * now orphans, log it and let the sweep find them", and a silent partial failure
 * would turn that best effort into no effort.
 *
 * Keys are not checked for ownership here — see `deleteFiles` for the account
 * path. The sweep has no single owner to check against, its keys coming from a
 * listing of the bucket diffed against the database.
 */
export async function deleteObjects(keys: string[]): Promise<void> {
  for (let start = 0; start < keys.length; start += DELETE_BATCH_SIZE) {
    const batch = keys.slice(start, start + DELETE_BATCH_SIZE);

    const response = await getR2().send(
      new DeleteObjectsCommand({
        Bucket: bucket(),
        Delete: { Objects: batch.map((Key) => ({ Key })) },
      }),
    );

    const errors = response.Errors ?? [];

    if (errors.length > 0) {
      const [first] = errors;

      throw new Error(
        `${errors.length} of ${batch.length} object(s) were not deleted — ${first.Key}: ${first.Code} ${first.Message}`,
      );
    }
  }
}

/**
 * Removes many of one user's objects.
 *
 * The keys come from that user's own item rows, so the `ownsObjectKey` filter
 * should never drop anything — but `fileUrl` is a stored string, and a value
 * edited by hand or written by a future bug could name another account's
 * object. It is the one check standing between a data bug and deleting someone
 * else's file, and it costs a string comparison.
 *
 * A dropped key is logged rather than thrown on: the caller is mid-erasure and
 * must not be stopped, but a key that fails this is a bug worth seeing.
 */
export async function deleteFiles(
  userId: string,
  keys: string[],
): Promise<void> {
  const owned = keys.filter((key) => ownsObjectKey(userId, key));

  if (owned.length !== keys.length) {
    console.error(
      `Refusing to delete ${keys.length - owned.length} object(s) outside the prefix of user ${userId}.`,
    );
  }

  if (owned.length === 0) {
    return;
  }

  await deleteObjects(owned);
}

/** One object as the bucket lists it. */
export interface ListedObject {
  key: string;
  size: number;
  /** `null` for the rare object listed without one. */
  lastModified: Date | null;
}

/**
 * Every object under a prefix, following the listing's pages.
 *
 * Only the reconciliation sweep needs this: the app itself never asks the
 * bucket what it holds, because the item rows are the index.
 */
export async function listObjects(prefix: string): Promise<ListedObject[]> {
  const objects: ListedObject[] = [];
  let continuationToken: string | undefined;

  do {
    const page = await getR2().send(
      new ListObjectsV2Command({
        Bucket: bucket(),
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    for (const object of page.Contents ?? []) {
      if (!object.Key) {
        continue;
      }

      objects.push({
        key: object.Key,
        size: object.Size ?? 0,
        lastModified: object.LastModified ?? null,
      });
    }

    // `NextContinuationToken` is only set while there is another page.
    continuationToken = page.IsTruncated
      ? page.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return objects;
}
