import { z } from "zod";

/**
 * A label on a sidebar row and a card heading, not a sentence — shorter than an
 * item's title, which can carry one.
 */
const NAME_MAX_LENGTH = 100;

const DESCRIPTION_MAX_LENGTH = 500;

/**
 * The payload the "New Collection" dialog submits.
 *
 * `isFavorite` and `defaultTypeId` are columns a collection has and this form
 * does not set: a new collection is not a favorite, and nothing in the app
 * reads a default type yet. Both stay the schema's defaults rather than
 * becoming fields the caller can name.
 */
export const createCollectionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(NAME_MAX_LENGTH, `Name is limited to ${NAME_MAX_LENGTH} characters.`),
  // `description` is nullable in the schema, so an empty field is stored as
  // null rather than as an empty string — the same rule the item schemas hold.
  description: z
    .string()
    .max(
      DESCRIPTION_MAX_LENGTH,
      `Description is limited to ${DESCRIPTION_MAX_LENGTH} characters.`,
    )
    .transform((value) => value.trim() || null)
    .nullable(),
});

export type CreateCollectionInput = z.infer<typeof createCollectionSchema>;
