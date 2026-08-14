import { config } from "dotenv";
import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient } from "../src/generated/prisma/client";
import { itemTypes } from "../src/lib/mock-data";

config({ path: [".env.local", ".env"], quiet: true });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

/**
 * Seeds the system item types. They are shared by every user (`userId: null`)
 * and are the only rows the app cannot run without.
 *
 * The definitions ride along with the mock data for now; they should move to a
 * constants module once the UI reads types from the database.
 */
async function seedSystemItemTypes() {
  for (const { name, slug, icon, color } of itemTypes) {
    // Postgres treats NULLs as distinct, so the (userId, slug) unique index
    // does not cover system types — look the row up before writing it.
    const existing = await prisma.itemType.findFirst({
      where: { userId: null, slug },
    });

    if (existing) {
      await prisma.itemType.update({
        where: { id: existing.id },
        data: { name, icon, color, isSystem: true },
      });
    } else {
      await prisma.itemType.create({
        data: { name, slug, icon, color, isSystem: true },
      });
    }
  }

  return prisma.itemType.count({ where: { userId: null } });
}

async function main() {
  const systemTypes = await seedSystemItemTypes();
  console.log(`Seeded ${systemTypes} system item types.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
