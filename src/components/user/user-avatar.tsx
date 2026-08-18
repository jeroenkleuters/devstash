import Image from "next/image";

import { cn } from "@/lib/utils";

/** Matches the `.user-avatar` box in `globals.css` (2rem), for `next/image`. */
const AVATAR_PIXELS = 32;

interface UserAvatarProps {
  name: string | null;
  email: string | null;
  /** The OAuth provider's picture, when the account came from one. */
  image?: string | null;
  className?: string;
}

/**
 * Two letters for accounts with no picture. Accounts without a name fall back
 * to their email, which has no space to split on — use its local part and the
 * separators that actually show up there instead.
 */
export function initials(source: string) {
  const name = source.split("@")[0];
  const parts = name.split(/[\s._-]+/).filter(Boolean);

  if (parts.length > 1) {
    return parts
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("");
  }

  return name.slice(0, 2).toUpperCase();
}

/**
 * The account's picture where there is one, its initials otherwise. Decorative
 * either way: every call site sits next to the name in readable text, so the
 * image carries an empty `alt` rather than repeating it to a screen reader.
 */
export function UserAvatar({ name, email, image, className }: UserAvatarProps) {
  const label = name ?? email ?? "";

  return (
    <span className={cn("user-avatar", className)} aria-hidden>
      {image ? (
        <Image
          className="user-avatar-image"
          src={image}
          alt=""
          width={AVATAR_PIXELS}
          height={AVATAR_PIXELS}
        />
      ) : (
        initials(label)
      )}
    </span>
  );
}
