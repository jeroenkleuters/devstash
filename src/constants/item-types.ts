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
