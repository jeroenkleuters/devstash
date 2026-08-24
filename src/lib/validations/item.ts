import { z } from "zod";

import { creatableType } from "@/constants/item-types";

/** Long enough for a sentence, short enough to stay one line on a card. */
const TITLE_MAX_LENGTH = 200;
const DESCRIPTION_MAX_LENGTH = 500;

/** A syntax-highlighting hint ("typescript"), not free text. */
const LANGUAGE_MAX_LENGTH = 32;

const TAG_MAX_LENGTH = 32;
const MAX_TAGS = 20;

/** Long enough for any real filename, short enough not to be a payload. */
const FILE_NAME_MAX_LENGTH = 255;

/**
 * What `POST /api/upload` hands back once the object is in R2, carried into the
 * create payload as-is.
 *
 * The key is checked against the caller's own prefix server-side — see
 * `ownsObjectKey` — so a crafted request cannot attach someone else's object to
 * its own item. Size is the uploaded object's, not a number worth trusting for
 * anything but display.
 */
const uploadedFileSchema = z.object({
  key: z.string().trim().min(1, "That upload is missing its file."),
  name: z
    .string()
    .trim()
    .min(1, "That upload is missing its file name.")
    .max(
      FILE_NAME_MAX_LENGTH,
      `File names are limited to ${FILE_NAME_MAX_LENGTH} characters.`,
    ),
  size: z.number().int().nonnegative(),
});

/**
 * The optional text fields arrive from inputs, which have no null — an emptied
 * field is `""`. Storing that instead of `null` would make "no description" and
 * "a description that is the empty string" two states the drawer then has to
 * tell apart, so it is normalized away here.
 */
function optionalText(maxLength: number, error: string) {
  return z
    .string()
    .max(maxLength, error)
    .transform((value) => value.trim() || null)
    .nullable();
}

/**
 * Tags are normalized rather than rejected: the field is one comma-separated
 * string, so stray whitespace and empty segments are typing artefacts, not
 * mistakes worth an error message.
 *
 * Duplicates have to go for a harder reason — the same name twice would make
 * `connectOrCreate` try to create a row that violates `Tag.@@unique([userId,
 * name])`, failing the whole write. Deduping is case-sensitive to match that
 * constraint: `React` and `react` are two rows as far as Postgres is concerned.
 */
const tagsSchema = z
  .array(z.string())
  .transform((values) => {
    const seen = new Set<string>();
    const tags: string[] = [];

    for (const value of values) {
      const tag = value.trim();

      if (tag !== "" && !seen.has(tag)) {
        seen.add(tag);
        tags.push(tag);
      }
    }

    return tags;
  })
  .pipe(
    z
      .array(
        z
          .string()
          .max(
            TAG_MAX_LENGTH,
            `Tags are limited to ${TAG_MAX_LENGTH} characters.`,
          ),
      )
      .max(MAX_TAGS, `An item can carry at most ${MAX_TAGS} tags.`),
  );

/**
 * The fields an item form submits, shared by create and edit — the two carry
 * the same set, and only the create payload also names a type.
 *
 * The three mutually exclusive payload fields (`content` / `url` / `fileUrl`)
 * are not policed against each other here. `updateItem` cannot be: this shape
 * does not say which type the item is, so `src/lib/db/items.ts` reads the
 * stored `contentType` and writes only the field that type owns, which is where
 * that rule from project overview §10 is enforced.
 */
const itemFields = {
  title: z
    .string()
    .trim()
    .min(1, "Title is required.")
    .max(
      TITLE_MAX_LENGTH,
      `Title is limited to ${TITLE_MAX_LENGTH} characters.`,
    ),
  description: optionalText(
    DESCRIPTION_MAX_LENGTH,
    `Description is limited to ${DESCRIPTION_MAX_LENGTH} characters.`,
  ),
  // Not length-capped: `content` is `@db.Text` and holds whole files.
  content: z
    .string()
    .transform((value) => value.trim() || null)
    .nullable(),
  // Trimmed before the format check, since a pasted URL often carries a space.
  url: z
    .string()
    .trim()
    .transform((value) => value || null)
    .nullable()
    .refine((value) => value === null || z.url().safeParse(value).success, {
      error: "Enter a valid URL, including https://",
    }),
  language: optionalText(
    LANGUAGE_MAX_LENGTH,
    `Language is limited to ${LANGUAGE_MAX_LENGTH} characters.`,
  ),
  tags: tagsSchema,
};

/**
 * The payload the drawer's edit mode submits. No `typeSlug`, because an item's
 * type cannot change here.
 */
export const updateItemSchema = z.object(itemFields);

export type UpdateItemInput = z.infer<typeof updateItemSchema>;

/**
 * The payload the create dialog submits.
 *
 * `typeSlug` rather than an `itemTypeId`: the id is the database's to hand out,
 * and accepting one from the caller would let a request name a type the dialog
 * does not offer. The slug is checked against `CREATABLE_TYPES` here and
 * resolved to a row server-side.
 *
 * Which payload field the chosen type owns is still `src/lib/db/items.ts`'s
 * call; the cross-field rules here are the two a form can act on — a link is
 * not a link without its URL, and a file item is not one without its file.
 */
export const createItemSchema = z
  .object({
    typeSlug: z.string().refine((slug) => creatableType(slug) !== undefined, {
      error: "Choose an item type.",
    }),
    ...itemFields,
    // Only the create payload carries one: the drawer's edit mode cannot
    // replace an item's file, so `updateItemSchema` has nothing to say about
    // it. An omitted field is the same as no file — the refine below is what
    // decides whether that is allowed.
    file: uploadedFileSchema.nullish().transform((value) => value ?? null),
  })
  .refine(
    (values) =>
      creatableType(values.typeSlug)?.contentType !== "URL" ||
      values.url !== null,
    { error: "A URL is required.", path: ["url"] },
  )
  .refine(
    (values) =>
      creatableType(values.typeSlug)?.contentType !== "FILE" ||
      values.file !== null,
    { error: "Upload a file first.", path: ["file"] },
  );

export type CreateItemInput = z.infer<typeof createItemSchema>;
