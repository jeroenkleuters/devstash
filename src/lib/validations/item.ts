import { z } from "zod";

/** Long enough for a sentence, short enough to stay one line on a card. */
const TITLE_MAX_LENGTH = 200;
const DESCRIPTION_MAX_LENGTH = 500;

/** A syntax-highlighting hint ("typescript"), not free text. */
const LANGUAGE_MAX_LENGTH = 32;

const TAG_MAX_LENGTH = 32;
const MAX_TAGS = 20;

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
 * The payload the drawer's edit mode submits.
 *
 * `contentType` is absent because an item's type cannot change here, and the
 * three mutually exclusive payload fields (`content` / `url` / `fileUrl`) are
 * not policed against each other here — this schema cannot see which type the
 * item is. `updateItem` in `src/lib/db/items.ts` reads the stored `contentType`
 * and writes only the field that type owns, which is where that rule from
 * project overview §10 is actually enforced.
 */
export const updateItemSchema = z.object({
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
});

export type UpdateItemInput = z.infer<typeof updateItemSchema>;
