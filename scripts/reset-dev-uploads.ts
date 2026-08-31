/**
 * Removes every upload-backed item from the development database, and its
 * object from the bucket.
 *
 *   npm run dev:reset-uploads          # dry run — lists what would go
 *   npm run dev:reset-uploads -- --yes # actually delete
 *
 * Written for splitting development off onto its own R2 bucket. Development and
 * production shared one bucket (`devstash-files`) while reading different Neon
 * branches, so an object's key says nothing about which environment owns it.
 * Once `R2_BUCKET_NAME` points somewhere new, every `fileUrl` in this database
 * names a key the new bucket does not hold — the rows survive, the objects are
 * unreachable, and every file row, image tile and book cover breaks.
 *
 * So the rows go too. Run this **before** repointing `R2_BUCKET_NAME` and it
 * also clears development's own objects out of the shared bucket, which would
 * otherwise be stranded there forever with nothing referencing them. Run it
 * after and the object deletes are harmless no-ops against an empty bucket.
 *
 * Selection is `fileUrl IS NOT NULL` rather than a list of type slugs: files,
 * images and book covers all live in that one column, and a future type holding
 * an upload is covered without editing this.
 *
 * `--keep-objects` skips R2 and deletes only the rows.
 */
import { config } from "dotenv";
import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient } from "../src/generated/prisma/client";
import { deleteObjects, ownsObjectKey } from "../src/lib/r2";

// Prisma 7 does not load .env files, and Next keeps secrets in .env.local.
config({ path: [".env.local", ".env"], quiet: true });

// No override, unlike `r2:sweep`. This deletes content rather than reclaiming
// unreferenced objects, and there is no version of it that belongs in
// production.
if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to run: NODE_ENV is production");
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const bucketName = process.env.R2_BUCKET_NAME;

if (!bucketName) {
  throw new Error("R2_BUCKET_NAME is not set");
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

const confirmed = process.argv.includes("--yes");
const keepObjects = process.argv.includes("--keep-objects");

function formatSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;

  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }

  return `${unit === 0 ? size : size.toFixed(1)} ${units[unit]}`;
}

/** Which Neon endpoint this is pointed at, without printing the credentials. */
function databaseHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "unparseable DATABASE_URL";
  }
}

async function main() {
  // Printed before anything else and before the confirmation gate: the whole
  // reason this script exists is that one bucket was being shared by two
  // environments, so which bucket and which database is the thing to be sure of.
  console.log(`Bucket:   ${bucketName}`);
  console.log(`Database: ${databaseHost(connectionString!)}\n`);

  const items = await prisma.item.findMany({
    where: { fileUrl: { not: null } },
    select: {
      id: true,
      title: true,
      fileUrl: true,
      fileSize: true,
      userId: true,
      itemType: { select: { slug: true } },
    },
    orderBy: [{ itemType: { slug: "asc" } }, { title: "asc" }],
  });

  if (items.length === 0) {
    console.log("No upload-backed items. Nothing to do.");
    return;
  }

  const byType = new Map<string, { count: number; bytes: number }>();

  for (const item of items) {
    const slug = item.itemType.slug;
    const seen = byType.get(slug) ?? { count: 0, bytes: 0 };

    byType.set(slug, {
      count: seen.count + 1,
      bytes: seen.bytes + (item.fileSize ?? 0),
    });
  }

  const totalBytes = items.reduce((sum, item) => sum + (item.fileSize ?? 0), 0);

  console.log(`${items.length} upload-backed item(s), ${formatSize(totalBytes)}:`);

  for (const [slug, stats] of byType) {
    console.log(`  ${slug} — ${stats.count} item(s), ${formatSize(stats.bytes)}`);
  }

  // The keys come from these rows, so this should never drop anything. It is
  // the same check `deleteFiles` makes and for the same reason: `fileUrl` is a
  // stored string, and it is what stands between a data bug and deleting an
  // object belonging to someone else.
  const keys: string[] = [];
  const foreign: string[] = [];

  for (const item of items) {
    if (!item.fileUrl) {
      continue;
    }

    if (ownsObjectKey(item.userId, item.fileUrl)) {
      keys.push(item.fileUrl);
    } else {
      foreign.push(item.fileUrl);
    }
  }

  if (foreign.length > 0) {
    console.log(
      `\n${foreign.length} key(s) sit outside their owner's prefix and will be left in the bucket:`,
    );

    for (const key of foreign) {
      console.log(`  ${key}`);
    }
  }

  if (keepObjects) {
    console.log("\n--keep-objects: the objects stay, only the rows go.");
  }

  if (!confirmed) {
    console.log("\nDry run. Re-run with `--yes` to delete.");
    return;
  }

  // Objects first, rows second — the opposite of `deleteAccount`, deliberately.
  // There the account must go even when R2 is unreachable; here a failed object
  // delete should stop the run with the rows intact, because those rows are the
  // only record of which keys to retry. Losing them turns a retryable failure
  // into a permanent orphan.
  if (!keepObjects && keys.length > 0) {
    await deleteObjects(keys);
    console.log(`\nDeleted ${keys.length} object(s) from ${bucketName}.`);
  }

  const { count } = await prisma.item.deleteMany({
    where: { id: { in: items.map((item) => item.id) } },
  });

  console.log(`Deleted ${count} item(s) from the database.`);

  const remaining = await prisma.item.count({ where: { fileUrl: { not: null } } });

  console.log(`Upload-backed items still present: ${remaining}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
