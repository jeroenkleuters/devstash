/**
 * Deletes R2 objects that no item points at.
 *
 *   npm run r2:sweep          # dry run — lists what would go, changes nothing
 *   npm run r2:sweep -- --yes # actually delete
 *
 * Two things leave objects behind, and this reclaims both:
 *
 *   - Every account deleted before `deleteAccount` learned to remove them, plus
 *     any account whose deletion could not reach R2 — that sweep is best effort
 *     by design, so the account goes even when the objects do not.
 *   - Every abandoned upload. The object is written before the item exists, so
 *     a file picked and then not saved is never referenced by anything.
 *
 * **It is only safe when the database it reads and the bucket it lists belong to
 * the same environment.** The diff is "every object with no row naming it", so
 * pointing it at one environment's database while `R2_BUCKET_NAME` names
 * another's bucket makes every object in that bucket look orphaned. Check both
 * before passing `--yes`.
 */
import { config } from "dotenv";
import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient } from "../src/generated/prisma/client";
import { deleteObjects, listObjects } from "../src/lib/r2";

// Prisma 7 does not load .env files, and Next keeps secrets in .env.local.
config({ path: [".env.local", ".env"], quiet: true });

// Destructive and irreversible. `--allow-production` exists because the backlog
// this reclaims is mostly in production, but it has to be asked for.
if (process.env.NODE_ENV === "production" && !process.argv.includes("--allow-production")) {
  throw new Error(
    "Refusing to sweep: NODE_ENV is production. Re-run with `--allow-production` if that is genuinely what you mean.",
  );
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

/** Everything the app writes lives under here. `objectKey` builds the rest. */
const PREFIX = "uploads/";

/**
 * How new an object has to be to be left alone.
 *
 * Without this the sweep races the create flow: an object is uploaded before
 * the item referencing it exists, so anything picked in a dialog still open
 * looks exactly like an orphan and would be deleted out from under it. A day is
 * far longer than that window and costs only a little delay in reclaiming.
 */
const MIN_AGE_MS = 24 * 60 * 60 * 1000;

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

const confirmed = process.argv.includes("--yes");

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

async function main() {
  const [objects, items] = await Promise.all([
    listObjects(PREFIX),
    prisma.item.findMany({
      where: { fileUrl: { not: null } },
      select: { fileUrl: true },
    }),
  ]);

  const referenced = new Set(
    items.map((item) => item.fileUrl).filter((key): key is string => key !== null),
  );

  console.log(
    `${objects.length} object(s) under ${PREFIX}, ${referenced.size} referenced by a live item.\n`,
  );

  const cutoff = Date.now() - MIN_AGE_MS;
  const orphans = [];
  let recent = 0;

  for (const object of objects) {
    if (referenced.has(object.key)) {
      continue;
    }

    // No timestamp is treated as too new: the point of the threshold is not to
    // delete anything whose age cannot be ruled out.
    if (!object.lastModified || object.lastModified.getTime() > cutoff) {
      recent += 1;
      continue;
    }

    orphans.push(object);
  }

  if (recent > 0) {
    console.log(
      `Skipping ${recent} unreferenced object(s) younger than 24 hours — an upload in progress looks exactly like an orphan.\n`,
    );
  }

  if (orphans.length === 0) {
    console.log("Nothing to sweep.");
    return;
  }

  const total = orphans.reduce((sum, object) => sum + object.size, 0);

  console.log(`${orphans.length} orphaned object(s), ${formatSize(total)}:`);

  for (const object of orphans) {
    const age = object.lastModified?.toISOString().slice(0, 10) ?? "unknown";

    console.log(`  ${object.key} — ${formatSize(object.size)}, ${age}`);
  }

  if (!confirmed) {
    console.log("\nDry run. Re-run with `--yes` to delete.");
    return;
  }

  await deleteObjects(orphans.map((object) => object.key));

  console.log(`\nDeleted ${orphans.length} object(s), reclaiming ${formatSize(total)}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
