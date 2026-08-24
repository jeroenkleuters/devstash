import { randomUUID } from "node:crypto";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

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

export async function putFile(
  key: string,
  body: Uint8Array,
  contentType: string,
): Promise<void> {
  await getR2().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
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
