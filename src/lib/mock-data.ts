/**
 * Mock data for the dashboard UI — the single source of truth until the
 * database is wired up. Plain data only, no helpers.
 */

export type ContentType = "TEXT" | "URL" | "FILE";

export interface User {
  id: string;
  name: string;
  email: string;
  image: string | null;
  isPro: boolean;
}

export interface ItemType {
  id: string;
  /** URL segment used by /items/[type] */
  slug: string;
  name: string;
  /** lucide-react icon name */
  icon: string;
  /** hex value */
  color: string;
  /** total items of this type, shown in the sidebar */
  itemCount: number;
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  isFavorite: boolean;
  /** total items in this collection, shown on the card */
  itemCount: number;
  /** drives the card's color coding — the type it holds most of */
  primaryTypeId: string;
  /** type badges shown on the card, most common first */
  typeIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Item {
  id: string;
  title: string;
  description: string;
  itemTypeId: string;
  contentType: ContentType;
  /** text content for snippet/prompt/note/command */
  content: string | null;
  /** for link items */
  url: string | null;
  /** for file/image items */
  fileName: string | null;
  /** syntax highlighting hint */
  language: string | null;
  tags: string[];
  collectionIds: string[];
  isFavorite: boolean;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export const currentUser: User = {
  id: "user-1",
  name: "Jeroen Kleuters",
  email: "pierun@gmail.com",
  image: null,
  isPro: true,
};

export const itemTypes: ItemType[] = [
  {
    id: "type-snippet",
    slug: "snippets",
    name: "Snippets",
    icon: "Code",
    color: "#3b82f6",
    itemCount: 24,
  },
  {
    id: "type-prompt",
    slug: "prompts",
    name: "Prompts",
    icon: "Sparkles",
    color: "#8b5cf6",
    itemCount: 18,
  },
  {
    id: "type-command",
    slug: "commands",
    name: "Commands",
    icon: "Terminal",
    color: "#f97316",
    itemCount: 15,
  },
  {
    id: "type-note",
    slug: "notes",
    name: "Notes",
    icon: "StickyNote",
    color: "#fde047",
    itemCount: 12,
  },
  {
    id: "type-file",
    slug: "files",
    name: "Files",
    icon: "File",
    color: "#6b7280",
    itemCount: 5,
  },
  {
    id: "type-image",
    slug: "images",
    name: "Images",
    icon: "Image",
    color: "#ec4899",
    itemCount: 3,
  },
  {
    id: "type-link",
    slug: "links",
    name: "Links",
    icon: "Link",
    color: "#10b981",
    itemCount: 8,
  },
];

export const collections: Collection[] = [
  {
    id: "col-react-patterns",
    name: "React Patterns",
    description: "Common React patterns and hooks",
    isFavorite: true,
    itemCount: 12,
    primaryTypeId: "type-snippet",
    typeIds: ["type-snippet", "type-note", "type-link"],
    createdAt: "2026-06-02T09:15:00.000Z",
    updatedAt: "2026-08-09T14:20:00.000Z",
  },
  {
    id: "col-python-snippets",
    name: "Python Snippets",
    description: "Useful Python code snippets",
    isFavorite: false,
    itemCount: 8,
    primaryTypeId: "type-snippet",
    typeIds: ["type-snippet", "type-note"],
    createdAt: "2026-06-11T11:00:00.000Z",
    updatedAt: "2026-08-05T08:45:00.000Z",
  },
  {
    id: "col-context-files",
    name: "Context Files",
    description: "AI context files for projects",
    isFavorite: true,
    itemCount: 5,
    primaryTypeId: "type-file",
    typeIds: ["type-file", "type-note"],
    createdAt: "2026-06-20T16:30:00.000Z",
    updatedAt: "2026-08-10T10:05:00.000Z",
  },
  {
    id: "col-interview-prep",
    name: "Interview Prep",
    description: "Technical interview preparation",
    isFavorite: false,
    itemCount: 24,
    primaryTypeId: "type-note",
    typeIds: ["type-note", "type-snippet", "type-link", "type-prompt"],
    createdAt: "2026-07-01T13:10:00.000Z",
    updatedAt: "2026-08-08T19:40:00.000Z",
  },
  {
    id: "col-git-commands",
    name: "Git Commands",
    description: "Frequently used git commands",
    isFavorite: true,
    itemCount: 15,
    primaryTypeId: "type-command",
    typeIds: ["type-command", "type-note"],
    createdAt: "2026-07-04T07:25:00.000Z",
    updatedAt: "2026-08-11T09:00:00.000Z",
  },
  {
    id: "col-ai-prompts",
    name: "AI Prompts",
    description: "Curated AI prompts for coding",
    isFavorite: false,
    itemCount: 18,
    primaryTypeId: "type-prompt",
    typeIds: ["type-prompt", "type-snippet", "type-note"],
    createdAt: "2026-07-15T12:00:00.000Z",
    updatedAt: "2026-08-07T15:30:00.000Z",
  },
];

export const items: Item[] = [
  {
    id: "item-use-auth-hook",
    title: "useAuth Hook",
    description: "Custom authentication hook for React applications",
    itemTypeId: "type-snippet",
    contentType: "TEXT",
    content: `import { useContext } from 'react'
import { AuthContext } from './AuthContext'

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}`,
    url: null,
    fileName: null,
    language: "typescript",
    tags: ["react", "auth", "hooks"],
    collectionIds: ["col-react-patterns"],
    isFavorite: true,
    isPinned: true,
    createdAt: "2026-07-15T10:00:00.000Z",
    updatedAt: "2026-07-15T10:00:00.000Z",
  },
  {
    id: "item-api-error-handling",
    title: "API Error Handling Pattern",
    description: "Fetch wrapper with exponential backoff retry logic",
    itemTypeId: "type-snippet",
    contentType: "TEXT",
    content: `export async function fetchWithRetry(url: string, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url)
    if (res.ok) return res.json()
    await new Promise((r) => setTimeout(r, 2 ** attempt * 250))
  }
  throw new Error(\`Request failed after \${retries} attempts\`)
}`,
    url: null,
    fileName: null,
    language: "typescript",
    tags: ["api", "fetch", "errors"],
    collectionIds: ["col-react-patterns", "col-interview-prep"],
    isFavorite: false,
    isPinned: true,
    createdAt: "2026-07-12T09:30:00.000Z",
    updatedAt: "2026-07-12T09:30:00.000Z",
  },
  {
    id: "item-code-review-prompt",
    title: "Code Review Prompt",
    description: "Ask an LLM for a focused review of a diff",
    itemTypeId: "type-prompt",
    contentType: "TEXT",
    content:
      "Review the following diff for correctness bugs, edge cases and security issues. List findings most severe first. Do not comment on style.",
    url: null,
    fileName: null,
    language: null,
    tags: ["review", "ai"],
    collectionIds: ["col-ai-prompts"],
    isFavorite: true,
    isPinned: false,
    createdAt: "2026-07-20T08:10:00.000Z",
    updatedAt: "2026-08-02T11:45:00.000Z",
  },
  {
    id: "item-git-undo-commit",
    title: "Undo Last Commit",
    description: "Keep the changes, drop the commit",
    itemTypeId: "type-command",
    contentType: "TEXT",
    content: "git reset --soft HEAD~1",
    url: null,
    fileName: null,
    language: "bash",
    tags: ["git", "undo"],
    collectionIds: ["col-git-commands"],
    isFavorite: false,
    isPinned: false,
    createdAt: "2026-07-22T14:00:00.000Z",
    updatedAt: "2026-07-22T14:00:00.000Z",
  },
  {
    id: "item-prune-branches",
    title: "Prune Merged Branches",
    description: "Delete local branches already merged into master",
    itemTypeId: "type-command",
    contentType: "TEXT",
    content:
      "git branch --merged master | grep -v master | xargs -n 1 git branch -d",
    url: null,
    fileName: null,
    language: "bash",
    tags: ["git", "cleanup"],
    collectionIds: ["col-git-commands"],
    isFavorite: false,
    isPinned: false,
    createdAt: "2026-07-25T16:20:00.000Z",
    updatedAt: "2026-07-25T16:20:00.000Z",
  },
  {
    id: "item-server-components-notes",
    title: "Server Components Cheatsheet",
    description: "When to reach for 'use client' and when not to",
    itemTypeId: "type-note",
    contentType: "TEXT",
    content:
      "## Server Components\n\n- Default in the App Router\n- Can read from the database directly\n- No hooks, no browser APIs\n\n## Client Components\n\n- Add `'use client'` only for interactivity or browser APIs",
    url: null,
    fileName: null,
    language: "markdown",
    tags: ["nextjs", "react"],
    collectionIds: ["col-react-patterns", "col-interview-prep"],
    isFavorite: false,
    isPinned: false,
    createdAt: "2026-07-28T10:40:00.000Z",
    updatedAt: "2026-08-04T09:15:00.000Z",
  },
  {
    id: "item-prisma-docs-link",
    title: "Prisma Docs",
    description: "Official Prisma ORM documentation",
    itemTypeId: "type-link",
    contentType: "URL",
    content: null,
    url: "https://www.prisma.io/docs",
    fileName: null,
    language: null,
    tags: ["prisma", "docs"],
    collectionIds: ["col-react-patterns"],
    isFavorite: false,
    isPinned: false,
    createdAt: "2026-08-01T12:00:00.000Z",
    updatedAt: "2026-08-01T12:00:00.000Z",
  },
  {
    id: "item-project-context-file",
    title: "project-overview.md",
    description: "AI context file describing the DevStash architecture",
    itemTypeId: "type-file",
    contentType: "FILE",
    content: null,
    url: null,
    fileName: "project-overview.md",
    language: null,
    tags: ["context", "ai"],
    collectionIds: ["col-context-files"],
    isFavorite: true,
    isPinned: false,
    createdAt: "2026-08-03T15:30:00.000Z",
    updatedAt: "2026-08-10T10:05:00.000Z",
  },
];
