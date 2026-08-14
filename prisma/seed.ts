/**
 * Seeds the database with the demo account and sample content.
 *
 *   npm run db:seed
 *
 * Re-runnable: the demo user's collections and items are cleared and rebuilt
 * on every run, so the result is always exactly what this file describes.
 */
import { config } from "dotenv";
import { hash } from "bcryptjs";
import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient } from "../src/generated/prisma/client";
import type { ContentType } from "../src/generated/prisma/enums";

config({ path: [".env.local", ".env"], quiet: true });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

const DEMO_USER = {
  email: "demo@devstash.io",
  name: "Demo User",
  password: "12345678",
};

const PASSWORD_SALT_ROUNDS = 12;

/** `slug` is the URL segment used by /items/[type]. */
const SYSTEM_ITEM_TYPES = [
  { name: "Snippet", slug: "snippets", icon: "Code", color: "#3b82f6" },
  { name: "Prompt", slug: "prompts", icon: "Sparkles", color: "#8b5cf6" },
  { name: "Command", slug: "commands", icon: "Terminal", color: "#f97316" },
  { name: "Note", slug: "notes", icon: "StickyNote", color: "#fde047" },
  { name: "File", slug: "files", icon: "File", color: "#6b7280" },
  { name: "Image", slug: "images", icon: "Image", color: "#ec4899" },
  { name: "Link", slug: "links", icon: "Link", color: "#10b981" },
];

interface SeedItem {
  title: string;
  description: string;
  typeSlug: string;
  content?: string;
  url?: string;
  language?: string;
}

interface SeedCollection {
  name: string;
  description: string;
  defaultTypeSlug: string;
  items: SeedItem[];
}

const COLLECTIONS: SeedCollection[] = [
  {
    name: "React Patterns",
    description: "Reusable React patterns and hooks",
    defaultTypeSlug: "snippets",
    items: [
      {
        title: "useDebounce",
        description: "Delays a value until it stops changing",
        typeSlug: "snippets",
        language: "typescript",
        content: `import { useEffect, useState } from 'react'

export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}`,
      },
      {
        title: "Theme Context Provider",
        description: "Context provider with a typed hook that guards its scope",
        typeSlug: "snippets",
        language: "typescript",
        content: `'use client'

import { createContext, useContext, useMemo, useState } from 'react'

type Theme = 'light' | 'dark'

const ThemeContext = createContext<{
  theme: Theme
  toggle: () => void
} | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')

  const value = useMemo(
    () => ({
      theme,
      toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    }),
    [theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}`,
      },
      {
        title: "groupBy",
        description: "Groups an array into a record keyed by a selector",
        typeSlug: "snippets",
        language: "typescript",
        content: `export function groupBy<T, K extends PropertyKey>(
  items: readonly T[],
  key: (item: T) => K,
): Record<K, T[]> {
  return items.reduce(
    (groups, item) => {
      const group = key(item)
      groups[group] ??= []
      groups[group].push(item)
      return groups
    },
    {} as Record<K, T[]>,
  )
}`,
      },
    ],
  },
  {
    name: "AI Workflows",
    description: "AI prompts and workflow automations",
    defaultTypeSlug: "prompts",
    items: [
      {
        title: "Code Review",
        description: "Focused review of a diff, severity ordered",
        typeSlug: "prompts",
        content: `Review the diff below for correctness bugs, unhandled edge cases and security issues.

Rules:
- List findings most severe first, with file and line.
- For each finding give a concrete failure scenario, not a general concern.
- Ignore formatting and naming style.
- If you find nothing, say so instead of inventing minor nits.

Diff:
"""
{{diff}}
"""`,
      },
      {
        title: "Documentation Generator",
        description: "Turns a module into reference docs with examples",
        typeSlug: "prompts",
        content: `Write reference documentation for the module below.

Include:
- One sentence on what it is for.
- Every exported function: signature, parameters, return value, thrown errors.
- A short runnable example per export.
- A "Gotchas" section only if the code has non-obvious behaviour.

Match the tone of the existing docs: terse, second person, no marketing.

Code:
"""
{{code}}
"""`,
      },
      {
        title: "Refactoring Assistant",
        description: "Proposes refactors without changing behaviour",
        typeSlug: "prompts",
        content: `Refactor the code below. Behaviour must not change.

Priorities, in order:
1. Remove duplication and dead code.
2. Reduce nesting and shorten functions.
3. Name things for what they do.

Output the refactored code, then a bullet list of what changed and why.
Flag anything you could not refactor safely without more context.

Code:
"""
{{code}}
"""`,
      },
    ],
  },
  {
    name: "DevOps",
    description: "Infrastructure and deployment resources",
    defaultTypeSlug: "links",
    items: [
      {
        title: "Multi-stage Node Dockerfile",
        description: "Slim production image for a Next.js standalone build",
        typeSlug: "snippets",
        language: "dockerfile",
        content: `FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]`,
      },
      {
        title: "Build and Push Release Image",
        description: "Tags the image with the current commit and pushes it",
        typeSlug: "commands",
        language: "bash",
        content: `docker build -t registry.example.com/devstash:$(git rev-parse --short HEAD) . \\
  && docker push registry.example.com/devstash:$(git rev-parse --short HEAD)`,
      },
      {
        title: "Docker Multi-stage Builds",
        description: "Official guide to multi-stage build syntax",
        typeSlug: "links",
        url: "https://docs.docker.com/build/building/multi-stage/",
      },
      {
        title: "GitHub Actions Documentation",
        description: "Workflow syntax and CI/CD reference",
        typeSlug: "links",
        url: "https://docs.github.com/en/actions",
      },
    ],
  },
  {
    name: "Terminal Commands",
    description: "Useful shell commands for everyday development",
    defaultTypeSlug: "commands",
    items: [
      {
        title: "Undo Last Commit, Keep Changes",
        description: "Moves HEAD back one commit and leaves the work staged",
        typeSlug: "commands",
        language: "bash",
        content: "git reset --soft HEAD~1",
      },
      {
        title: "Reclaim Docker Disk Space",
        description: "Removes unused containers, images, networks and volumes",
        typeSlug: "commands",
        language: "bash",
        content: "docker system prune --all --volumes --force",
      },
      {
        title: "Kill Whatever Holds a Port",
        description: "Frees a port after a dev server refuses to die",
        typeSlug: "commands",
        language: "bash",
        content: "lsof -ti:3000 | xargs --no-run-if-empty kill -9",
      },
      {
        title: "Audit Outdated Dependencies",
        description: "Lists outdated packages and known vulnerabilities",
        typeSlug: "commands",
        language: "bash",
        content: "npm outdated; npm audit --omit=dev",
      },
    ],
  },
  {
    name: "Design Resources",
    description: "UI/UX resources and references",
    defaultTypeSlug: "links",
    items: [
      {
        title: "Tailwind CSS Documentation",
        description: "Utility reference and theme configuration",
        typeSlug: "links",
        url: "https://tailwindcss.com/docs",
      },
      {
        title: "shadcn/ui",
        description: "Copy-in component library built on Radix",
        typeSlug: "links",
        url: "https://ui.shadcn.com",
      },
      {
        title: "Material Design 3",
        description: "Design system guidelines, tokens and patterns",
        typeSlug: "links",
        url: "https://m3.material.io",
      },
      {
        title: "Lucide Icons",
        description: "Icon set used across the app",
        typeSlug: "links",
        url: "https://lucide.dev/icons",
      },
    ],
  },
];

function contentTypeFor(typeSlug: string): ContentType {
  if (typeSlug === "links") return "URL";
  if (typeSlug === "files" || typeSlug === "images") return "FILE";
  return "TEXT";
}

/** Returns the item type ids keyed by slug. */
async function seedSystemItemTypes() {
  const idsBySlug = new Map<string, string>();

  for (const type of SYSTEM_ITEM_TYPES) {
    // Postgres treats NULLs as distinct, so the (userId, slug) unique index
    // does not cover system types — look the row up before writing it.
    const existing = await prisma.itemType.findFirst({
      where: { userId: null, slug: type.slug },
    });

    const saved = existing
      ? await prisma.itemType.update({
          where: { id: existing.id },
          data: { ...type, isSystem: true },
        })
      : await prisma.itemType.create({
          data: { ...type, isSystem: true },
        });

    idsBySlug.set(saved.slug, saved.id);
  }

  return idsBySlug;
}

async function seedDemoUser() {
  const passwordHash = await hash(DEMO_USER.password, PASSWORD_SALT_ROUNDS);

  const data = {
    name: DEMO_USER.name,
    passwordHash,
    emailVerified: new Date(),
    isPro: false,
  };

  return prisma.user.upsert({
    where: { email: DEMO_USER.email },
    update: data,
    create: { email: DEMO_USER.email, ...data },
  });
}

async function seedCollections(userId: string, typeIds: Map<string, string>) {
  // Start from a clean slate so re-running cannot duplicate content. Items and
  // collections cascade to their ItemCollection rows.
  await prisma.item.deleteMany({ where: { userId } });
  await prisma.collection.deleteMany({ where: { userId } });

  let itemCount = 0;

  for (const seedCollection of COLLECTIONS) {
    const collection = await prisma.collection.create({
      data: {
        userId,
        name: seedCollection.name,
        description: seedCollection.description,
        defaultTypeId: typeIds.get(seedCollection.defaultTypeSlug),
      },
    });

    for (const item of seedCollection.items) {
      const itemTypeId = typeIds.get(item.typeSlug);

      if (!itemTypeId) {
        throw new Error(`Unknown item type "${item.typeSlug}"`);
      }

      await prisma.item.create({
        data: {
          userId,
          itemTypeId,
          title: item.title,
          description: item.description,
          contentType: contentTypeFor(item.typeSlug),
          content: item.content ?? null,
          url: item.url ?? null,
          language: item.language ?? null,
          collections: { create: { collectionId: collection.id } },
        },
      });

      itemCount += 1;
    }
  }

  return { collections: COLLECTIONS.length, items: itemCount };
}

async function main() {
  const typeIds = await seedSystemItemTypes();
  console.log(`Seeded ${typeIds.size} system item types.`);

  const user = await seedDemoUser();
  console.log(`Seeded demo user ${user.email}.`);

  const { collections, items } = await seedCollections(user.id, typeIds);
  console.log(`Seeded ${collections} collections with ${items} items.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
