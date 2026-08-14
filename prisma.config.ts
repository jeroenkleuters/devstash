import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma 7 no longer loads .env files itself, and Next.js keeps secrets in
// .env.local — load both so the CLI sees the same values the app does.
config({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Prisma 7 no longer seeds automatically after migrate dev/reset — run
    // `npm run db:seed` (or `prisma db seed`) explicitly.
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations need a direct connection: Neon's pooled endpoint cannot hold
    // the advisory locks the schema engine takes. Runtime uses DATABASE_URL
    // (pooled) through the adapter in src/lib/prisma.ts.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
    // Optional: only needed if the Neon role cannot create the shadow database
    // that `prisma migrate dev` uses to detect drift.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
