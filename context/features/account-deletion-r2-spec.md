# Fix — account deletion leaves uploaded files in R2

## Overview

Deleting a single item removes its object from Cloudflare R2. **Deleting a whole
account does not**, so every file, image and book cover that account uploaded is
orphaned in the bucket the moment the row goes.

Found while writing the privacy page copy
(@context/features/privacy-page-content.md §7), which currently has to disclose
this as a limitation. **This feature is what lets that paragraph be rewritten.**

Two problems, not one:

- **Right to erasure.** Someone asked to be deleted and their files are still
  there. DevStash has EU users, so this is not hypothetical.
- **Cost.** Since the direct-to-R2 feature an object can be 100 MB, and nothing
  reclaims it.

## Why it is worse than it first looks

`Item.fileUrl` holds the R2 object key — the schema comment still says "Cloudflare
R2 URL", which has been wrong since the first upload feature. The cascade from
`User` deletes those rows, so **the only record of which objects to delete
disappears at the same moment they become orphans.**

They are recoverable in principle, since keys are `uploads/{userId}/…` and a
prefix scan diffed against live user ids would find them. Nothing does that scan,
and after deletion there is no list of which ids were removed. Hence part B.

## Requirements

- No migration, no new dependency, no new ShadCN primitive
- No user-visible change: the delete dialog, its action and its redirect all
  behave exactly as they do now
- `npm test`, `npx tsc --noEmit`, `npx eslint src` and `npm run build` clean

## Files to create

| File | Contents |
|---|---|
| `src/lib/account.test.ts` | The tests below — `account.ts` currently has none |
| `scripts/sweep-orphans.ts` | The reconciliation sweep (part B) |

## Files to modify

| File | Change |
|---|---|
| `src/lib/account.ts` | `deleteAccount` collects keys, then deletes, then sweeps |
| `src/lib/db/items.ts` | `getUserFileKeys(userId)` |
| `src/lib/r2.ts` | `deleteFiles(keys)` — bulk, and the `fileUrl` comment fix |
| `package.json` | `r2:sweep` script |
| `context/features/privacy-page-content.md` | Rewrite §7; drop the marker |

---

## Part A — delete the objects when the account goes

### Order: row first, then a best-effort sweep

**Decided.** The alternative — objects first, refusing the deletion if R2 is
unreachable, which is what `deleteItem` does — was rejected here for one reason:
it lets a vendor outage block someone from leaving. That is a bad answer to an
erasure request, and a worse one under GDPR than a logged orphan.

So the account always goes. A failed object delete is logged loudly and picked up
by part B, never surfaced to the person deleting their account — they asked for
the account to be gone, and it is.

**The deliberate consequence:** an R2 failure still produces an orphan. This
feature does not eliminate orphans, it makes them the exception rather than the
rule, and gives them a cleanup path.

### The sequence

```ts
export async function deleteAccount(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ ... });   // unchanged
  if (!user) return false;

  // 1. BEFORE anything is deleted. The cascade removes the Item rows that hold
  //    these keys, so collecting them afterwards is impossible.
  const keys = await getUserFileKeys(userId);

  await prisma.verificationToken.deleteMany({ ... });    // unchanged
  const { count } = await prisma.user.deleteMany({ ... }); // unchanged

  if (count === 0) return false;   // already gone — nothing to sweep

  // 2. Best effort, and it can never fail the deletion.
  if (keys.length > 0) {
    await deleteFiles(keys).catch((cause) => {
      console.error(
        `Account ${userId} deleted, but ${keys.length} R2 object(s) were not. Run npm run r2:sweep.`,
        cause,
      );
    });
  }

  return true;
}
```

Three things in there matter:

- **Step 1 is before the `deleteMany`, and the comment says why.** This is the
  whole bug. Someone tidying the function later will be tempted to move the read
  next to its use.
- **The `.catch` swallows deliberately.** Erasure must not depend on R2 being
  reachable. The message names the count and the recovery command, because a log
  line saying only "R2 delete failed" is one nobody can act on.
- **`count === 0` returns before the sweep.** A second submission of the
  confirmation dialog finds the row already gone; the first submission already
  swept, and deleting the same keys twice is harmless but the log noise is not.

### `getUserFileKeys` in `src/lib/db/items.ts`

```ts
prisma.item.findMany({
  where: { userId, fileUrl: { not: null } },
  select: { fileUrl: true },
})
```

`fileUrl` is the only column holding an R2 key — books put their cover there too,
which is why this needs no per-type branching.

**Not `cache()`d**, unlike most of that module: it is read once during a mutation
and memoizing it across a request would be pointless at best.

Unbounded, and that is accepted: the free tier caps at 50 items and a key is a
short string, so even a large Pro account is a small array. Worth a comment
rather than pagination.

### `deleteFiles` in `src/lib/r2.ts`

`deleteFile` today issues one `DeleteObjectCommand`. An account with 200 files
would mean 200 round trips, so add a bulk sibling using `DeleteObjectsCommand`:

- **Chunk at 1,000 keys** — the S3 API limit, which R2 implements.
- **`DeleteObjectsCommand` reports per-key failures in the response body rather
  than throwing.** A partial failure is a 200 with an `Errors` array, so a
  `try`/`catch` alone will not notice it. Read `Errors` and treat a non-empty
  array as a failure, or the "best effort" above silently becomes "no effort".
- **Filter the keys through `ownsObjectKey(userId, key)` first.** They came from
  that user's own rows, so this should never drop anything — but `fileUrl` is a
  stored string, and a value edited by hand or written by a future bug could name
  another account's object. Cheap, and the one check standing between a data bug
  and deleting someone else's file.

While in the file: **fix the `fileUrl` comment in `prisma/schema.prisma`.** It
says "Cloudflare R2 URL" and has held a key since the first upload feature.

---

## Part B — the reconciliation sweep

`npm run r2:sweep`, following `scripts/prune-users.ts` exactly.

**It is not only a backstop for part A.** It also cleans up the orphans that
already exist, from two sources this project has recorded as open for months:
every account deleted before this fix, and every abandoned upload — the object is
written before the item exists, so a file picked and then not saved leaves one
behind.

- **Lists** every object under `uploads/`, **diffs** against the `fileUrl` values
  of every live item, and reports what is orphaned with a total size.
- **Dry run by default**, `--yes` to delete. Same shape as `db:prune`.
- **Refuses when `NODE_ENV=production`** unless explicitly forced, as `db:prune`
  and `prisma/seed.ts` both do.
- **An age threshold — skip anything newer than 24 hours.** Without it the sweep
  races the create flow: an object uploaded seconds ago has no item pointing at
  it yet, and would be deleted out from under a dialog still open. This is the
  detail most likely to be missed and it destroys user data if it is.
- Needs `ListObjectsV2Command`, which is new to `r2.ts`.

> **`npm run r2:sweep -- --yes` silently no-ops under PowerShell**, which eats the
> `--` so npm never forwards the flag and the script reads it as a dry run. Run
> it through the Bash tool, or use PowerShell's `--%`. The email-verification
> entry records this costing real time on `db:prune`.

---

## Testing

`src/lib/account.ts` is collected by `vitest.config.mts` and **currently has no
test file at all**, so this adds one. Mock `@/lib/prisma` and `@/lib/r2`.

`scripts/` is not collected, so part B rests on a dry run against the real bucket.

### `src/lib/account.test.ts`

- **Keys are collected before the user row is deleted** — assert the call order,
  not just that both happened. This is the bug, so it is the test that matters
  most and the one to mutation-check: move the `getUserFileKeys` call after the
  `deleteMany` and confirm exactly this test fails.
- The collected keys are passed to `deleteFiles`
- **The account is still deleted when `deleteFiles` rejects**, and
  `deleteAccount` returns `true`
- A rejected `deleteFiles` logs, and the message names the count
- An account with no files does not call `deleteFiles` at all
- An already-deleted account (`count === 0`) returns `false` and does not call
  `deleteFiles`
- `VerificationToken` rows are still cleared under **both** identifiers — the
  existing behaviour, untested until now, and easy to break while editing around
  it

Note `restoreMocks` restores `vi.spyOn` spies only, so a `vi.fn()` keeps its call
history across tests. `vi.clearAllMocks()` in `beforeEach` is what makes the
"was not called" assertions mean anything.

### `src/lib/r2` bulk delete

If `deleteFiles` gets its own test, the case worth having is the one that is easy
to get wrong: **a 200 response carrying a non-empty `Errors` array is a failure**,
not a success.

---

## Verification

`npm test`, `npx tsc --noEmit`, `npx eslint src` and `npm run build` clean.

Against the dev branch and the real bucket, with a throwaway account:

1. Register, upload two files, confirm both objects exist (`headFile`)
2. Delete the account through the dialog
3. **Confirm both objects are gone** — `headFile` returns `null` for each
4. Confirm the user row, its items and both `VerificationToken` identifiers are
   gone, and that the system item types and the demo account are untouched
5. Run `npm run r2:sweep` as a dry run and confirm it reports nothing for that
   prefix

Then the failure path, which is the whole reason for the ordering: **force
`deleteFiles` to reject** and confirm the account is still deleted, the session
still ends on `/sign-in`, and the log names the count and the recovery command.

Finally, `npm run r2:sweep` dry run against the bucket as it stands — it should
find the orphans left by every account deleted before this fix. **Read that list
before running it with `--yes`.**

## Follow-up

Rewrite §7 of @context/features/privacy-page-content.md and remove its
`[REWRITE THIS PARAGRAPH]` marker. Deleting an account then genuinely removes the
files, and the page should say so plainly.
