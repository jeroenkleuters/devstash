import { itemTypes, type ItemType } from "@/lib/mock-data";

/** Looks up an `Item.itemTypeId` or `Collection.primaryTypeId`. */
export const ITEM_TYPES_BY_ID: Record<string, ItemType | undefined> =
  Object.fromEntries(itemTypes.map((type) => [type.id, type]));
