import { formatFileSize } from "@/lib/utils";

/**
 * Which set of rules an upload is held to. The two file item types take
 * different things: an image is for looking at, a file is for keeping.
 */
export type UploadKind = "image" | "file";

const MEGABYTE = 1024 * 1024;

/**
 * The most one upload may be, for either kind.
 *
 * One number rather than two because the reason for a cap is the same for both
 * now: the bytes go straight from the browser to R2, so the app is not holding
 * them and the limit is about what an account may store rather than what a
 * request can carry. It is signed into the upload URL — see `presignPut` — so
 * this is the number R2 itself enforces, not a rule the form merely states.
 */
export const MAX_UPLOAD_BYTES = 100 * MEGABYTE;

/**
 * Extension → the content type the object is stored and served as.
 *
 * The extension decides, not what the browser reported: `.md`, `.toml` and
 * `.ini` have no registered type that browsers agree on, so a file picked on
 * one machine arrives as `text/markdown` and on another as `""`. Storing what
 * the extension says keeps the download route serving the same thing either way.
 *
 * `Map` rather than an object literal for the reason `src/lib/code-language.ts`
 * spells out: a lookup on a plain object can return something off the prototype.
 */
const IMAGE_TYPES = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".svg", "image/svg+xml"],
]);

const FILE_TYPES = new Map([
  [".pdf", "application/pdf"],
  [".txt", "text/plain"],
  [".md", "text/markdown"],
  [".json", "application/json"],
  [".yaml", "application/x-yaml"],
  [".yml", "application/x-yaml"],
  [".xml", "application/xml"],
  [".csv", "text/csv"],
  [".toml", "application/toml"],
  [".ini", "text/plain"],
]);

/**
 * Reported types accepted on top of the canonical ones above — the second
 * spellings the same formats travel under.
 */
const TYPE_ALIASES = new Map([
  ["text/yaml", "application/x-yaml"],
  ["text/xml", "application/xml"],
  ["text/markdown", "text/markdown"],
]);

/**
 * What the browser says when it does not know, which is common for the text
 * formats above. The extension has already been checked by then, so this is
 * not a way past the rules.
 */
const UNKNOWN_TYPES = new Set(["", "application/octet-stream"]);

interface UploadConstraint {
  maxBytes: number;
  /** Lowercase, with the leading dot. */
  extensions: readonly string[];
  /** Reported content types this kind accepts. */
  mimeTypes: ReadonlySet<string>;
  /** Extension → stored content type. */
  contentTypes: ReadonlyMap<string, string>;
  /** Names the kind in a message: "Images are limited to…". */
  plural: string;
}

const CONSTRAINTS = new Map<UploadKind, UploadConstraint>([
  [
    "image",
    {
      maxBytes: MAX_UPLOAD_BYTES,
      extensions: [...IMAGE_TYPES.keys()],
      mimeTypes: new Set(IMAGE_TYPES.values()),
      contentTypes: IMAGE_TYPES,
      plural: "Images",
    },
  ],
  [
    "file",
    {
      maxBytes: MAX_UPLOAD_BYTES,
      extensions: [...FILE_TYPES.keys()],
      mimeTypes: new Set([...FILE_TYPES.values(), ...TYPE_ALIASES.keys()]),
      contentTypes: FILE_TYPES,
      plural: "Files",
    },
  ],
]);

/** The rules one kind of upload is held to. */
export function uploadConstraint(kind: UploadKind): UploadConstraint {
  // Every `UploadKind` is a key, so this cannot miss — the assertion is what
  // saves every caller a null check.
  return CONSTRAINTS.get(kind) as UploadConstraint;
}

/** What an `<input type="file">` should accept for this kind. */
export function acceptAttribute(kind: UploadKind): string {
  return uploadConstraint(kind).extensions.join(",");
}

/** ".png" for "photo.PNG", or "" for a name with no extension at all. */
export function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");

  // A leading dot is the whole name of a dotfile, not an extension.
  if (dot <= 0) {
    return "";
  }

  return name.slice(dot).toLowerCase();
}

/** What the object is stored and served as, decided by its extension. */
export function uploadContentType(kind: UploadKind, name: string): string {
  return (
    uploadConstraint(kind).contentTypes.get(fileExtension(name)) ??
    "application/octet-stream"
  );
}

/** One file as the rules see it — what both `File` and a form part carry. */
export interface UploadCandidate {
  name: string;
  /** What the browser reported, which is often nothing useful. */
  type: string;
  size: number;
}

/**
 * Why a file cannot be uploaded, or `null` when it can.
 *
 * A message rather than a boolean because both callers show one: the form says
 * it before uploading, and the route says it again for a request that skipped
 * the form. The route is the rule; the form's copy is the courtesy.
 */
export function validateUpload(
  kind: UploadKind,
  file: UploadCandidate,
): string | null {
  const { maxBytes, extensions, mimeTypes, plural } = uploadConstraint(kind);
  const extension = fileExtension(file.name);

  if (!extensions.includes(extension)) {
    return `${plural} must be one of ${extensions.join(", ")}.`;
  }

  // Checked after the extension, so an unreported type is only ever forgiven
  // for a file whose extension is already allowed.
  if (!UNKNOWN_TYPES.has(file.type) && !mimeTypes.has(file.type)) {
    return `${file.type} is not a ${kind} type this accepts.`;
  }

  if (file.size <= 0) {
    return "That file is empty.";
  }

  if (file.size > maxBytes) {
    return `${plural} are limited to ${formatFileSize(maxBytes)}.`;
  }

  return null;
}
