import { CalendarDays, Mail } from "lucide-react";

import { ChangePasswordDialog } from "@/components/profile/change-password-dialog";
import { DeleteAccountDialog } from "@/components/profile/delete-account-dialog";
import { UserAvatar } from "@/components/user/user-avatar";
import type { CurrentUser } from "@/lib/db/user";
import { formatLongDate } from "@/lib/utils";

/** Matches the `.profile-avatar` box in `globals.css` (4rem). */
const AVATAR_PIXELS = 64;

interface ProfileAccountProps {
  user: CurrentUser;
}

/**
 * Who is signed in — the GitHub picture where the account has one, initials
 * otherwise, the same fallback the sidebar uses — and the two things that can be
 * done to the account, each behind its own dialog.
 */
export function ProfileAccount({ user }: ProfileAccountProps) {
  return (
    <section className="profile-card">
      <h2 className="profile-card-title">Account Information</h2>

      <div className="profile-identity">
        <UserAvatar
          className="profile-avatar"
          name={user.name}
          email={user.email}
          image={user.image}
          size={AVATAR_PIXELS}
        />

        <div className="profile-identity-meta">
          <p className="profile-identity-name">{user.name ?? user.email}</p>
          {/* Account linking does not exist yet, so having a password is the
              same question as which provider this account signs in with. */}
          <p className="profile-identity-kind">
            {user.hasPassword ? "Email account" : "GitHub account"}
          </p>
        </div>
      </div>

      <dl className="profile-details">
        <div className="profile-detail">
          <dt className="profile-detail-label">
            <Mail size={14} aria-hidden />
            Email:
          </dt>
          <dd className="profile-detail-value">{user.email}</dd>
        </div>

        <div className="profile-detail">
          <dt className="profile-detail-label">
            <CalendarDays size={14} aria-hidden />
            Member since:
          </dt>
          <dd className="profile-detail-value">
            <time dateTime={user.createdAt.toISOString()}>
              {formatLongDate(user.createdAt)}
            </time>
          </dd>
        </div>
      </dl>

      <div className="profile-actions">
        {user.hasPassword ? (
          <ChangePasswordDialog />
        ) : (
          <p className="profile-actions-note">
            This account signs in with GitHub, so there is no password to change.
          </p>
        )}

        <DeleteAccountDialog email={user.email} />
      </div>
    </section>
  );
}
