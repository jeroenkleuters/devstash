import {
  Code,
  File,
  Image,
  Link,
  Sparkles,
  StickyNote,
  Terminal,
  type LucideIcon,
} from "lucide-react";

import type { ItemContentType } from "@/types/item";

/**
 * Maps an `ItemType.icon` value (a lucide-react icon name) to the component.
 * Type colors live in `globals.css` as `--type-*` custom properties.
 */
export const TYPE_ICONS: Record<string, LucideIcon> = {
  Code,
  Sparkles,
  Terminal,
  StickyNote,
  File,
  Image,
  Link,
};

/**
 * `ItemType.slug`s reserved for Pro accounts. Labelled only — nothing is gated
 * while all users get full access during development.
 */
export const PRO_TYPE_SLUGS = new Set(["files", "images"]);

/**
 * Which editor a type's content field uses.
 *
 * Keyed on the slug rather than `ContentType` because TEXT covers all four of
 * these: a code editor over a paragraph of prose is noise, and a Markdown
 * preview over a shell command is meaningless. Every TEXT type is one or the
 * other, so the pair partitions them.
 */
export type ItemEditor = "code" | "markdown";

/** Whether a type's content is edited and shown in the code editor. */
export function isCodeType(slug: string): boolean {
  return pickerType(slug)?.editor === "code";
}

/** Whether a type's content is written in Markdown. */
export function isMarkdownType(slug: string): boolean {
  return pickerType(slug)?.editor === "markdown";
}

/**
 * The Monaco language a code type assumes when the item carries no hint, or
 * undefined for a type that is not code.
 */
export function codeTypeLanguage(slug: string): string | undefined {
  return pickerType(slug)?.fallbackLanguage;
}

/**
 * `ItemType.slug`s that carry a syntax-highlighting hint. Slug again rather
 * than `ContentType`: a prompt and a note are TEXT too, and neither has a
 * language.
 */
export const LANGUAGE_TYPE_SLUGS = new Set(["snippets", "commands"]);

/** One of the system types the create dialog's picker shows. */
export interface CreatableType {
  /** `ItemType.slug` — the id itself is resolved from the database. */
  slug: string;
  /** Singular, matching `ItemType.name`. */
  label: string;
  /** Key into `TYPE_ICONS`. */
  icon: string;
  /** Which of the item's mutually exclusive payload fields this type fills. */
  contentType: ItemContentType;
  /**
   * Whether an item of this type can actually be stored yet. False for the
   * Pro-gated file types: nothing in the app uploads a file, so a created
   * item would be a title with no payload behind it.
   */
  creatable: boolean;
  /** Which editor its content field uses; absent when it has no text payload. */
  editor?: ItemEditor;
  /** Monaco language a code type assumes when the item names none. */
  fallbackLanguage?: string;
}

/**
 * Every system type the picker offers, and the content kind each one stores,
 * in the order the sidebar lists them.
 *
 * `ItemType` has no column saying whether a type holds text, a URL or a file
 * (project overview §4.2), so for a new item that mapping lives here — the same
 * split `contentTypeFor` in `prisma/seed.ts` makes for the seeded content.
 */
const ITEM_TYPE_OPTIONS: readonly CreatableType[] = [
  {
    slug: "snippets",
    label: "Snippet",
    icon: "Code",
    contentType: "TEXT",
    creatable: true,
    editor: "code",
    fallbackLanguage: "plaintext",
  },
  {
    slug: "prompts",
    label: "Prompt",
    icon: "Sparkles",
    contentType: "TEXT",
    creatable: true,
    editor: "markdown",
  },
  {
    slug: "commands",
    label: "Command",
    icon: "Terminal",
    contentType: "TEXT",
    creatable: true,
    editor: "code",
    fallbackLanguage: "shell",
  },
  {
    slug: "notes",
    label: "Note",
    icon: "StickyNote",
    contentType: "TEXT",
    creatable: true,
    editor: "markdown",
  },
  {
    slug: "files",
    label: "File",
    icon: "File",
    contentType: "FILE",
    creatable: false,
  },
  {
    slug: "images",
    label: "Image",
    icon: "Image",
    contentType: "FILE",
    creatable: false,
  },
  {
    slug: "links",
    label: "Link",
    icon: "Link",
    contentType: "URL",
    creatable: true,
  },
];

/** Every type the picker shows, storable or not. */
export const PICKER_TYPES = ITEM_TYPE_OPTIONS;

/**
 * The types an item can actually be created as. This is the server's rule:
 * `createItem` refuses a slug that is not in here, which is what stops a file
 * type being stored as a payload-less row while there is no upload flow.
 */
export const CREATABLE_TYPES: readonly CreatableType[] = ITEM_TYPE_OPTIONS.filter(
  (type) => type.creatable,
);

/** The type a slug names whether or not it can be stored, for the picker. */
export function pickerType(slug: string): CreatableType | undefined {
  return ITEM_TYPE_OPTIONS.find((type) => type.slug === slug);
}

/** The creatable type a slug names, or undefined when it names none. */
export function creatableType(slug: string): CreatableType | undefined {
  return CREATABLE_TYPES.find((type) => type.slug === slug);
}
