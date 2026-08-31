import { prisma } from "@/lib/prisma";

/**
 * Reading and writing the cached explanation for one item.
 *
 * **These are not an access-control boundary.** They take an item id and check
 * nothing about who owns it, because the caller has already read the item
 * through `getItemDetail`, which puts the session's user in the `where` — so an
 * id that reaches here is provably the caller's own. Keep it that way: calling
 * either of these on an id that has not been through that read would be a
 * second path around the ownership scoping.
 */

/**
 * The cached explanation, if there is one that still applies.
 *
 * A hit requires **both** the source digest and the model to match. The digest
 * covers the code and the language hint, so an edit invalidates it and a
 * favourite does not; the model is there so switching models does not keep
 * serving answers the new one never produced.
 */
export async function getCachedExplanation(
  itemId: string,
  sourceHash: string,
  model: string,
): Promise<string | null> {
  const row = await prisma.itemExplanation.findUnique({
    where: { itemId },
    select: { explanation: true, sourceHash: true, model: true },
  });

  if (!row || row.sourceHash !== sourceHash || row.model !== model) {
    return null;
  }

  return row.explanation;
}

/**
 * Stores an explanation, replacing whatever was there.
 *
 * An `upsert` on the unique `itemId` rather than a create: the row this
 * replaces is a *stale* answer for the same item, and keeping both would need a
 * rule for which one to serve. One item, one explanation.
 */
export async function cacheExplanation(
  itemId: string,
  explanation: string,
  sourceHash: string,
  model: string,
): Promise<void> {
  await prisma.itemExplanation.upsert({
    where: { itemId },
    create: { itemId, explanation, sourceHash, model },
    update: { explanation, sourceHash, model },
  });
}
