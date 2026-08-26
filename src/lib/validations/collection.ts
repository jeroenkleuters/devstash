import { z } from "zod";

/**
 * A label on a sidebar row and a card heading, not a sentence — shorter than an
 * item's title, which can carry one.
 */
const NAME_MAX_LENGTH = 100;

const DESCRIPTION_MAX_LENGTH = 500;

/**
 * The metadata a collection carries, shared by the create and update payloads
 * so the two cannot state different rules for the same two fields.
 *
 * `isFavorite` and `defaultTypeId` are columns a collection has and neither
 * form sets: a new collection is not a favorite, and nothing in the app reads a
 * default type yet. Both stay the schema's defaults rather than becoming fields
 * the caller can name.
 */
const collectionFields = {
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
};

/** The payload the "New Collection" dialog submits. */
export const createCollectionSchema = z.object(collectionFields);

export type CreateCollectionInput = z.infer<typeof createCollectionSchema>;

/**
 * The payload the edit dialog submits. Identical to create's for now — the id
 * travels as its own argument rather than in the payload, so a request cannot
 * name one collection and edit another.
 */
export const updateCollectionSchema = z.object(collectionFields);

export type UpdateCollectionInput = z.infer<typeof updateCollectionSchema>;
