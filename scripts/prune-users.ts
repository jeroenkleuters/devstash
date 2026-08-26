/**
 * Deletes every user except the demo account, along with everything they own.
 *
 *   npm run db:prune          # dry run — lists what would go, changes nothing
 *   npm run db:prune -- --yes # actually delete
 *
 * Written for clearing test accounts out of the development branch. Items,
 * collections, tags, custom item types, OAuth accounts and sessions all carry
 * `onDelete: Cascade` from User, so removing the row removes the content with
 * it. Two things do not follow automatically and are handled here:
 *
 *   - `VerificationToken` has no relation to User at all — it is keyed on the
 *     email string — so its rows would otherwise be left behind.
 *   - System item types have `userId: null`, which is what keeps them out of
 *     every cascade. The run asserts they are still there afterwards.
 */
import { config } from "dotenv";
import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient } from "../src/generated/prisma/client";

// Prisma 7 does not load .env files, and Next keeps secrets in .env.local.
config({ path: [".env.local", ".env"], quiet: true });

// Destructive and irreversible — never point it at a production branch.
if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to prune: NODE_ENV is production");
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

/** The one account that survives. Matches `prisma/seed.ts`. */
const KEEP_EMAIL = "demo@devstash.io";

/**
 * Every `VerificationToken` row belonging to the account being kept.
 *
 * Not simply `identifier: KEEP_EMAIL`. The password-reset flow namespaces its
 * rows as `password-reset:<email>` (see `passwordResetIdentifier` in
 * `src/lib/password-reset.ts`), so bare equality misses them and the run
 * silently invalidates demo's pending reset link along with everyone else's.
 * Matching on the address after a `:` covers that prefix and any later one.
 *
 * The helper is deliberately not imported: `@/lib/password-reset` reaches the
 * Prisma singleton at import time, which would evaluate before the `config()`
 * call above has put `DATABASE_URL` into the environment.
 */
const KEEPER_TOKENS = {
  OR: [
    { identifier: KEEP_EMAIL },
    { identifier: { endsWith: `:${KEEP_EMAIL}` } },
  ],
};

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

const confirmed = process.argv.includes("--yes");

async function main() {
  const [doomed, keeper, tokens] = await Promise.all([
    prisma.user.findMany({
      where: { email: { not: KEEP_EMAIL } },
      select: {
        id: true,
        email: true,
        _count: {
          select: {
            items: true,
            collections: true,
            tags: true,
            itemTypes: true,
            accounts: true,
            sessions: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findUnique({
      where: { email: KEEP_EMAIL },
      select: { id: true, _count: { select: { items: true, collections: true } } },
    }),
    prisma.verificationToken.count({
      where: { NOT: KEEPER_TOKENS },
    }),
  ]);

  // Without the demo account present this would empty the User table, which is
  // far more likely to be a un-seeded database than an intentional wipe.
  if (!keeper) {
    throw new Error(
      `Refusing to prune: ${KEEP_EMAIL} does not exist. Run \`npm run db:seed\` first.`,
    );
  }

  console.log(`Keeping ${KEEP_EMAIL} — ${keeper._count.items} items, ${keeper._count.collections} collections.\n`);

  if (doomed.length === 0 && tokens === 0) {
    console.log("Nothing to delete.");
    return;
  }

  console.log(`${doomed.length} user(s) to delete:`);

  for (const user of doomed) {
    const owned = [
      `${user._count.items} items`,
      `${user._count.collections} collections`,
      `${user._count.tags} tags`,
      `${user._count.itemTypes} custom types`,
      `${user._count.accounts} linked accounts`,
      `${user._count.sessions} sessions`,
    ].join(", ");

    console.log(`  ${user.email} — ${owned}`);
  }

  console.log(`\n${tokens} verification token(s) to delete.`);

  if (!confirmed) {
    console.log("\nDry run. Re-run with `--yes` to delete.");
    return;
  }

  // Tokens first: they are matched on email, so they have to go while the
  // addresses are still readable.
  const removedTokens = await prisma.verificationToken.deleteMany({
    where: { NOT: KEEPER_TOKENS },
  });
  const removedUsers = await prisma.user.deleteMany({
    where: { email: { not: KEEP_EMAIL } },
  });

  console.log(
    `\nDeleted ${removedUsers.count} user(s) and ${removedTokens.count} verification token(s).`,
  );

  const systemTypes = await prisma.itemType.count({ where: { userId: null } });

  console.log(`System item types still present: ${systemTypes}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
