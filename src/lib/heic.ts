import {
  fileExtension,
  HEIC_EXTENSIONS,
  HEIC_TYPES,
} from "@/lib/file-constraints";

/**
 * Turning a camera photo into something the app can actually store.
 *
 * A phone set to "high efficiency pictures" writes HEIC, which no browser can
 * display — so it is converted to JPEG here, in the browser, before it is
 * uploaded. Nothing server-side ever sees the original.
 *
 * Browser only: `convertHeicToJpeg` reaches a wasm decoder. The two predicates
 * above it are pure and safe anywhere.
 */

/** Said when the decoder was reached and could not read the photo. */
export const HEIC_CONVERSION_FAILED =
  "That photo could not be read. Try again, or save it as JPEG first.";

/**
 * Whether this needs converting before it can be uploaded.
 *
 * The extension is checked as well as the reported type, and it is the one that
 * carries: Android hands a HEIC over as `application/octet-stream` or as an
 * empty string often enough that trusting the type alone would let the original
 * through to be refused by validation instead.
 */
export function isHeicFile(file: { name: string; type: string }): boolean {
  return (
    HEIC_TYPES.has(file.type.toLowerCase()) ||
    HEIC_EXTENSIONS.has(fileExtension(file.name))
  );
}

/**
 * The same name as a JPEG: `IMG_0042.HEIC` becomes `IMG_0042.jpg`.
 *
 * The extension has to change or validation refuses the converted file — it
 * decides the stored content type from the extension rather than from what the
 * browser reports.
 */
export function jpegName(name: string): string {
  const dot = name.lastIndexOf(".");
  // A leading dot is the whole name rather than an extension, the reading
  // `fileExtension` already takes.
  const base = dot > 0 ? name.slice(0, dot) : name;

  return `${base.trim() || "photo"}.jpg`;
}

/**
 * Converts a HEIC photo to a JPEG of the same name.
 *
 * The decoder is imported here rather than at the top of the file, and that is
 * the point: it carries its wasm inline and comes to a few megabytes, so it is
 * fetched only by someone who has actually taken a HEIC photo, and never by
 * anyone else.
 */
export async function convertHeicToJpeg(file: File): Promise<File> {
  const { heicTo } = await import("heic-to");

  const converted = await heicTo({
    blob: file,
    type: "image/jpeg",
    quality: 0.9,
  });

  return new File([converted], jpegName(file.name), {
    type: "image/jpeg",
    lastModified: file.lastModified,
  });
}
