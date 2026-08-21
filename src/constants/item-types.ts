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
 * `ItemType.slug`s whose content is code, and the Monaco language each one
 * falls back to when the item names none.
 *
 * Keyed on the slug rather than `ContentType` because TEXT also covers prompts
 * and notes, where a code editor over a paragraph of prose is noise — those
 * keep the plain block and the plain textarea.
 *
 * This replaces the hand-rolled line-number gutter these types used to get:
 * Monaco draws its own.
 */
const CODE_TYPE_LANGUAGES = new Map([
  ["snippets", "plaintext"],
  ["commands", "shell"],
]);

/** Whether a type's content is edited and shown in the code editor. */
export function isCodeType(slug: string): boolean {
  return CODE_TYPE_LANGUAGES.has(slug);
}

/**
 * The Monaco language a code type assumes when the item carries no hint, or
 * undefined for a type that is not code.
 */
export function codeTypeLanguage(slug: string): string | undefined {
  return CODE_TYPE_LANGUAGES.get(slug);
}

/**
 * `ItemType.slug`s that carry a syntax-highlighting hint. Slug again rather
 * than `ContentType`: a prompt and a note are TEXT too, and neither has a
 * language.
 */
export const LANGUAGE_TYPE_SLUGS = new Set(["snippets", "commands"]);

/** One of the system types the create dialog offers. */
export interface CreatableType {
  /** `ItemType.slug` — the id itself is resolved from the database. */
  slug: string;
  /** Singular, matching `ItemType.name`. */
  label: string;
  /** Key into `TYPE_ICONS`. */
  icon: string;
  /** Which of the item's mutually exclusive payload fields this type fills. */
  contentType: ItemContentType;
}

/**
 * The types an item can be created as, and the content kind each one stores.
 *
 * `ItemType` has no column saying whether a type holds text, a URL or a file
 * (project overview §4.2), so for a new item that mapping lives here — the same
 * split `contentTypeFor` in `prisma/seed.ts` makes for the seeded content.
 *
 * File and Image are absent deliberately: they are the Pro-gated types, and
 * nothing in the app uploads a file yet, so there is no payload to create them
 * with.
 */
export const CREATABLE_TYPES: readonly CreatableType[] = [
  { slug: "snippets", label: "Snippet", icon: "Code", contentType: "TEXT" },
  { slug: "prompts", label: "Prompt", icon: "Sparkles", contentType: "TEXT" },
  { slug: "commands", label: "Command", icon: "Terminal", contentType: "TEXT" },
  { slug: "notes", label: "Note", icon: "StickyNote", contentType: "TEXT" },
  { slug: "links", label: "Link", icon: "Link", contentType: "URL" },
];

/** The creatable type a slug names, or undefined when it names none. */
export function creatableType(slug: string): CreatableType | undefined {
  return CREATABLE_TYPES.find((type) => type.slug === slug);
}
