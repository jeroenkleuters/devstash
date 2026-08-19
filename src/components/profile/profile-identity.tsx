import { UserAvatar } from "@/components/user/user-avatar";
import type { CurrentUser } from "@/lib/db/user";
import { formatLongDate } from "@/lib/utils";

/** Matches the `.profile-avatar` box in `globals.css` (4rem). */
const AVATAR_PIXELS = 64;

interface ProfileIdentityProps {
  user: CurrentUser;
}

/**
 * Who is signed in: the GitHub picture where the account has one, initials
 * otherwise — the same fallback the sidebar uses, since it is the same avatar.
 */
export function ProfileIdentity({ user }: ProfileIdentityProps) {
  return (
    <section className="profile-identity">
      <UserAvatar
        className="profile-avatar"
        name={user.name}
        email={user.email}
        image={user.image}
        size={AVATAR_PIXELS}
      />

      <div className="profile-identity-meta">
        <h2 className="profile-identity-name">{user.name ?? user.email}</h2>
        <p className="profile-identity-email">{user.email}</p>
        <p className="profile-identity-joined">
          Joined{" "}
          <time dateTime={user.createdAt.toISOString()}>
            {formatLongDate(user.createdAt)}
          </time>
        </p>
      </div>
    </section>
  );
}
