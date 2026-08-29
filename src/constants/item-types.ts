import {
  BookOpen,
  Code,
  File,
  FileCode,
  FileJson,
  FileSpreadsheet,
  FileText,
  Image,
  Link,
  Sparkles,
  StickyNote,
  Terminal,
  type LucideIcon,
} from "lucide-react";

import type { UploadKind } from "@/lib/file-constraints";
import type { ItemContentType } from "@/types/item";

/**
 * Maps an `ItemType.icon` value (a lucide-react icon name) to the component.
 * Type colors live in `globals.css` as `--type-*` custom properties.
 */
export const TYPE_ICONS: Record<string, LucideIcon> = {
  BookOpen,
  Code,
  Sparkles,
  Terminal,
  StickyNote,
  File,
  Image,
  Link,
};

/**
 * Extension → the icon a file row shows, for the extensions uploads accept.
 *
 * A plain object here, unlike the `Map`s in `file-constraints.ts` and
 * `code-language.ts`: those are keyed on bare words, where a lookup can answer
 * with something off the prototype, but every key below carries a leading dot
 * and so does everything `fileExtension` returns — `".constructor"` is not a
 * prototype member.
 */
export const FILE_ICONS: Record<string, LucideIcon> = {
  ".pdf": FileText,
  ".txt": FileText,
  ".md": FileText,
  ".ini": FileText,
  ".json": FileJson,
  ".yaml": FileCode,
  ".yml": FileCode,
  ".toml": FileCode,
  ".xml": FileCode,
  ".csv": FileSpreadsheet,
};

/**
 * `ItemType.slug`s that require a Pro subscription — both the badge the sidebar
 * shows and the rule the server enforces, so the two cannot disagree.
 *
 * `books` is here because a book's cover goes through the image upload path, so
 * it costs the same storage that gates images. That also makes this set exactly
 * the set of types holding an upload, which is what lets `POST /api/upload`
 * check `isPro` alone: the route sees an `UploadKind` and never the item type
 * slug, so a free type in this group would force the payload to start carrying
 * one just so the route could branch.
 *
 * **If a free type ever gains an upload, that route is what breaks first, and
 * it breaks permissively** — the upload is allowed and only `createItem`
 * refuses the type.
 */
export const PRO_TYPE_SLUGS = new Set(["files", "images", "books"]);

/** Whether a type requires a Pro subscription. */
export function isProType(slug: string): boolean {
  return PRO_TYPE_SLUGS.has(slug);
}

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
  return creatableType(slug)?.editor === "code";
}

/** Whether a type's content is written in Markdown. */
export function isMarkdownType(slug: string): boolean {
  return creatableType(slug)?.editor === "markdown";
}

/**
 * The Monaco language a code type assumes when the item carries no hint, or
 * undefined for a type that is not code.
 */
export function codeTypeLanguage(slug: string): string | undefined {
  return creatableType(slug)?.fallbackLanguage;
}

/**
 * Which upload rules a type's file takes, or undefined for a type that holds
 * no file. This is what makes an image a `.png` and a file a `.pdf` — both are
 * `ContentType.FILE`, so the column cannot say it.
 */
export function uploadKindFor(slug: string): UploadKind | undefined {
  return creatableType(slug)?.upload;
}

/**
 * Whether a type's items carry something worth putting on the clipboard.
 *
 * The slug again rather than `ContentType`: a file and an image are both
 * `ContentType.FILE`, and their payload is an R2 object key that means nothing
 * outside the server. Every other type holds either text or a URL, so "holds no
 * file" is the same question as "has something to copy".
 */
export function isCopyableType(slug: string): boolean {
  return uploadKindFor(slug) === undefined;
}

/**
 * `ItemType.slug`s that carry a syntax-highlighting hint. Slug again rather
 * than `ContentType`: a prompt and a note are TEXT too, and neither has a
 * language.
 */
export const LANGUAGE_TYPE_SLUGS = new Set(["snippets", "commands"]);

/**
 * `ItemType.slug`s that carry the book fields — an author, and a link beside
 * their cover.
 *
 * A book is the one type that fills two of the mutually exclusive payload
 * columns: `fileUrl` holds the cover, which is what makes it `ContentType.FILE`,
 * and `url` holds the link. The column cannot say that, so the slug does, the
 * same way `LANGUAGE_TYPE_SLUGS` says which types carry a language.
 */
export const BOOK_TYPE_SLUGS = new Set(["books"]);

/** Whether a type carries an author, and a link alongside its file. */
export function isBookType(slug: string): boolean {
  return BOOK_TYPE_SLUGS.has(slug);
}

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
  /** Which editor its content field uses; absent when it has no text payload. */
  editor?: ItemEditor;
  /** Monaco language a code type assumes when the item names none. */
  fallbackLanguage?: string;
  /** Which upload rules its file takes; absent when it holds no file. */
  upload?: UploadKind;
}

/**
 * Every system type an item can be created as, and the content kind each one
 * stores, in the order the sidebar lists them.
 *
 * `ItemType` has no column saying whether a type holds text, a URL or a file
 * (project overview §4.2), so for a new item that mapping lives here — the same
 * split `contentTypeFor` in `prisma/seed.ts` makes for the seeded content.
 *
 * This is the server's rule as well as the picker's: `createItem` refuses a
 * slug that is not in here, so a type cannot be stored without the payload
 * field its entry says it owns.
 */
export const CREATABLE_TYPES: readonly CreatableType[] = [
  {
    slug: "snippets",
    label: "Snippet",
    icon: "Code",
    contentType: "TEXT",
    editor: "code",
    fallbackLanguage: "plaintext",
  },
  {
    slug: "prompts",
    label: "Prompt",
    icon: "Sparkles",
    contentType: "TEXT",
    editor: "markdown",
  },
  {
    slug: "commands",
    label: "Command",
    icon: "Terminal",
    contentType: "TEXT",
    editor: "code",
    fallbackLanguage: "shell",
  },
  {
    slug: "notes",
    label: "Note",
    icon: "StickyNote",
    contentType: "TEXT",
    editor: "markdown",
  },
  {
    slug: "files",
    label: "File",
    icon: "File",
    contentType: "FILE",
    upload: "file",
  },
  {
    slug: "images",
    label: "Image",
    icon: "Image",
    contentType: "FILE",
    upload: "image",
  },
  {
    slug: "links",
    label: "Link",
    icon: "Link",
    contentType: "URL",
  },
  {
    slug: "books",
    label: "Book",
    icon: "BookOpen",
    // The cover is the payload, so a book is a FILE type taking the image
    // upload rules. Its link lives in `url` besides — see `BOOK_TYPE_SLUGS`.
    contentType: "FILE",
    upload: "image",
  },
];

/** The creatable type a slug names, or undefined when it names none. */
export function creatableType(slug: string): CreatableType | undefined {
  return CREATABLE_TYPES.find((type) => type.slug === slug);
}
