/**
 * Connection and seed-data check for the Neon database.
 *
 *   npm run db:test
 *
 * Prints what is in the database and asserts it hangs together: migration
 * applied, system types present, demo account usable, every item wired to a
 * collection and carrying the right payload for its content type. Read-only.
 */
import { config } from "dotenv";
import { compare } from "bcryptjs";
import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient } from "../src/generated/prisma/client";

// Prisma 7 does not load .env files, and Next keeps secrets in .env.local.
config({ path: [".env.local", ".env"], quiet: true });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is not set — copy .env.example to .env.local.");
  process.exit(1);
}

const DEMO_EMAIL = "demo@devstash.io";
const DEMO_PASSWORD = "12345678";

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

const failures: string[] = [];

function check(ok: boolean, description: string) {
  console.log(`  ${ok ? "✓" : "✗"} ${description}`);
  if (!ok) failures.push(description);
}

async function checkConnection() {
  console.log("Connection");

  // `name`-typed catalog columns cannot be deserialized by the adapter, so
  // everything coming out of information_schema is cast to text.
  const [connection] = await prisma.$queryRaw<{ database: string }[]>`
    select current_database()::text as database
  `;
  console.log(`  database: ${connection.database}`);

  const migrations = await prisma.$queryRaw<
    { name: string; applied: Date | null }[]
  >`
    select migration_name::text as name, finished_at as applied
    from "_prisma_migrations" order by started_at
  `;

  for (const migration of migrations) {
    check(migration.applied !== null, `migration ${migration.name} applied`);
  }

  check(migrations.length > 0, "at least one migration applied");
}

async function checkItemTypes() {
  console.log("\nSystem item types");

  const types = await prisma.itemType.findMany({
    where: { userId: null },
    orderBy: { name: "asc" },
    include: { _count: { select: { items: true } } },
  });

  for (const type of types) {
    console.log(
      `  ${type.name.padEnd(8)} /${type.slug.padEnd(9)} ${type.color}  ${type.icon} (${type._count.items} items)`,
    );
  }

  check(types.length === 7, `7 system types seeded (found ${types.length})`);
  check(
    types.every((type) => type.isSystem),
    "all marked isSystem",
  );
  check(
    types.every((type) => /^#[0-9a-f]{6}$/i.test(type.color)),
    "all have a hex color",
  );
}

async function checkDemoUser() {
  console.log("\nDemo user");

  const user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });

  if (!user) {
    check(false, `${DEMO_EMAIL} exists — run \`npm run db:seed\``);
    return null;
  }

  console.log(`  ${user.name} <${user.email}>`);
  console.log(
    `  isPro: ${user.isPro} | verified: ${user.emailVerified?.toISOString().slice(0, 10) ?? "no"}`,
  );

  check(
    user.passwordHash !== null &&
      (await compare(DEMO_PASSWORD, user.passwordHash)),
    "password hash verifies",
  );
  check(user.emailVerified !== null, "email verified");

  return user;
}

async function checkContent(userId: string) {
  console.log("\nCollections");

  const collections = await prisma.collection.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    include: {
      defaultType: true,
      items: { include: { item: { include: { itemType: true } } } },
    },
  });

  for (const collection of collections) {
    console.log(
      `  ${collection.name} — ${collection.items.length} items, default ${collection.defaultType?.name ?? "none"}`,
    );
    console.log(`    ${collection.description ?? ""}`);

    for (const { item } of collection.items) {
      const payload = item.url ?? item.content?.split("\n")[0] ?? "";
      const preview =
        payload.length > 58 ? `${payload.slice(0, 58)}…` : payload;
      console.log(
        `    · [${item.itemType.name}] ${item.title} — ${preview || "(empty)"}`,
      );
    }
  }

  check(collections.length > 0, "collections seeded");
  check(
    collections.every((collection) => collection.items.length > 0),
    "every collection has items",
  );

  console.log("\nItems");

  const items = await prisma.item.findMany({
    where: { userId },
    include: { itemType: true, collections: true },
  });

  const orphans = items.filter((item) => item.collections.length === 0);
  const emptyText = items.filter(
    (item) => item.contentType === "TEXT" && !item.content,
  );
  const badLinks = items.filter(
    (item) => item.contentType === "URL" && !item.url?.startsWith("http"),
  );
  const mixed = items.filter((item) => item.content && item.url);

  console.log(`  ${items.length} items across ${collections.length} collections`);

  check(items.length > 0, "items seeded");
  check(orphans.length === 0, `every item is in a collection (${orphans.length} orphans)`);
  check(emptyText.length === 0, `every TEXT item has content (${emptyText.length} empty)`);
  check(badLinks.length === 0, `every URL item has an http url (${badLinks.length} bad)`);
  check(mixed.length === 0, `no item has both content and url (${mixed.length} mixed)`);
}

async function main() {
  const startedAt = Date.now();

  await checkConnection();
  await checkItemTypes();
  const user = await checkDemoUser();

  if (user) {
    await checkContent(user.id);
  }

  console.log(`\nDone in ${Date.now() - startedAt}ms`);

  if (failures.length > 0) {
    console.error(`\n${failures.length} check(s) failed:`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exitCode = 1;
  } else {
    console.log("All checks passed.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
