/**
 * Connection smoke test for the Neon database.
 *
 *   npx tsx scripts/test-db.ts
 *
 * Checks that the connection string works, the migration has been applied and
 * the system item types are seeded. Read-only — it writes nothing.
 */
import { config } from "dotenv";
import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient } from "../src/generated/prisma/client";

// Prisma 7 does not load .env files, and Next keeps secrets in .env.local.
config({ path: [".env.local", ".env"], quiet: true });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is not set — copy .env.example to .env.local.");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

async function main() {
  const startedAt = Date.now();

  // `name`-typed catalog columns cannot be deserialized by the adapter, so
  // everything coming out of information_schema is cast to text.
  const [connection] = await prisma.$queryRaw<
    { database: string; host: string }[]
  >`select current_database()::text as database, inet_server_addr()::text as host`;

  console.log(`Connected to "${connection.database}" (${connection.host})`);

  const tables = await prisma.$queryRaw<{ name: string }[]>`
    select table_name::text as name from information_schema.tables
    where table_schema = 'public' order by table_name
  `;
  console.log(`Tables (${tables.length}): ${tables.map((t) => t.name).join(", ")}`);

  const migrations = await prisma.$queryRaw<
    { name: string; applied: Date | null }[]
  >`
    select migration_name::text as name, finished_at as applied
    from "_prisma_migrations" order by started_at
  `;

  if (migrations.length === 0) {
    console.error("No migrations applied — run `npm run db:migrate`.");
    process.exitCode = 1;
  }

  for (const migration of migrations) {
    const state = migration.applied ? "applied" : "PENDING";
    console.log(`Migration ${migration.name}: ${state}`);
  }

  const counts = {
    users: await prisma.user.count(),
    itemTypes: await prisma.itemType.count(),
    items: await prisma.item.count(),
    collections: await prisma.collection.count(),
    tags: await prisma.tag.count(),
  };
  console.log("Row counts:", counts);

  const systemTypes = await prisma.itemType.findMany({
    where: { userId: null },
    orderBy: { name: "asc" },
    select: { name: true, slug: true },
  });

  if (systemTypes.length === 0) {
    console.error("No system item types — run `npm run db:seed`.");
    process.exitCode = 1;
  } else {
    console.log(
      `System item types (${systemTypes.length}): ${systemTypes
        .map((type) => type.slug)
        .join(", ")}`,
    );
  }

  console.log(`Done in ${Date.now() - startedAt}ms`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
