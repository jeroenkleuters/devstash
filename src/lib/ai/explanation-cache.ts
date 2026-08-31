import { createHash } from "node:crypto";

/**
 * The key a cached explanation is kept under.
 *
 * **A digest of exactly what was sent to the model**, and deliberately not
 * `Item.updatedAt`. Prisma bumps that column on every write, so favouriting an
 * item, pinning it, renaming it or adding a tag would each discard an answer
 * that was paid for and is still correct — the code it describes has not
 * changed. Hashing the input invalidates when, and only when, the thing being
 * explained is different.
 *
 * The language hint is part of it because the prompt carries it: the same code
 * labelled `sh` and labelled `powershell` is two different questions, and the
 * answers should not be interchangeable.
 *
 * SHA-256 rather than a slow hash: there is no secret here and nothing to
 * defend against guessing. What matters is that it is stable across processes
 * and deploys, which rules out anything seeded per-run.
 */
export function explanationSourceHash(
  content: string,
  language: string | null,
): string {
  // Length-prefixed rather than joined with a separator, which is what keeps
  // the flattening injective: any character used as a delimiter can also occur
  // inside the content, and then one pair of inputs can be rearranged into a
  // string another pair also produces. Prefixing the hint's length cannot be
  // ambiguous, and unlike a NUL byte it stays readable in the source.
  const hint = language ?? "";

  return createHash("sha256")
    .update(`${hint.length}:${hint}${content}`)
    .digest("hex");
}
