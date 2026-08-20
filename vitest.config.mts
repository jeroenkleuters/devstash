import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    // Nothing under test renders, so there is no DOM to emulate. Component tests
    // are deliberately out of scope — `include` below is what enforces that.
    environment: "node",

    // Utilities and server actions only. A `*.test.ts` anywhere else is not
    // picked up, so the scope is a property of the config rather than a habit.
    include: ["src/lib/**/*.test.ts", "src/actions/**/*.test.ts"],

    // `vi.stubEnv` is how the modules that read `process.env` are exercised;
    // this puts the real value back after every test so order cannot matter.
    // Note Vitest does not load `.env` at all, which is the point: these tests
    // assert against values they set, not against whatever is on disk.
    unstubEnvs: true,

    // Spies and mock implementations do not leak between tests.
    restoreMocks: true,

    server: {
      deps: {
        // Left external, these are loaded by Node directly, which does not
        // apply Next's `exports` map — `next-auth/lib/env.js` imports
        // "next/server" and the resolve fails with "did you mean
        // next/server.js". Processing them through Vite resolves it the way
        // the bundler does.
        inline: ["next-auth", "@auth/core"],
      },
    },
  },
  resolve: {
    // The `@/*` alias from tsconfig.json. A bare "@" key only matches "@/…",
    // so scoped packages like @upstash/redis resolve normally.
    alias: { "@": resolve(rootDir, "src") },
  },
});
