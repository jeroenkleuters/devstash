"use server";

import { createCollection as createCollectionRow } from "@/lib/db/collections";
import { getCurrentUserId } from "@/lib/db/user";
import { firstIssueMessage } from "@/lib/validations/auth";
import { createCollectionSchema } from "@/lib/validations/collection";
import type { CreateCollectionResult } from "@/types/collection";

/**
 * A session is not the same as a live account: the row can be gone while the
 * JWT still verifies, which is what `getCurrentUserId` returning null means.
 */
const SIGNED_OUT = "Your session has ended. Sign in again.";

const CREATE_FAILED = "Could not create this collection. Try again.";

/**
 * Creates a collection from the "New Collection" dialog.
 *
 * The owner comes from the session rather than the payload, so the schema has
 * nothing to say about it — there is no `userId` a request could name.
 */
export async function createCollection(
  input: unknown,
): Promise<CreateCollectionResult> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: SIGNED_OUT };
  }

  const parsed = createCollectionSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: firstIssueMessage(parsed.error) };
  }

  try {
    const collection = await createCollectionRow(userId, parsed.data);

    return { success: true, data: collection };
  } catch (error) {
    console.error("createCollection failed", error);
    return { success: false, error: CREATE_FAILED };
  }
}
