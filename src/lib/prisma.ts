import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient } from "@/generated/prisma/client";

// Prisma 7 requires a driver adapter; PrismaNeon talks to Neon's serverless
// driver, so the pooled connection string belongs here.
function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  return new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });
}

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Keep one client across hot reloads in development.
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
