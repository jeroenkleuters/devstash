import type { CollectionSummary } from "@/lib/db/collections";

/**
 * What `createCollection` in `src/actions/collections.ts` answers with — the
 * project's `{ success, data, error }` action shape, narrowed so a successful
 * result always carries the new collection and a failed one always carries a
 * message.
 *
 * `CollectionSummary` is imported as a type, which is erased, so a client
 * component reading this result never pulls `@/lib/db/collections` — and its
 * Prisma import — into a browser bundle.
 */
export type CreateCollectionResult =
  | { success: true; data: CollectionSummary }
  | { success: false; error: string };

/**
 * One collection as the item forms' picker lists it, shaped as it crosses the
 * wire from `GET /api/collections`. Just enough to show a row and name an id in
 * the payload — the picker has no use for counts, types or dates.
 */
export interface CollectionOption {
  id: string;
  name: string;
}
