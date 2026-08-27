import { ChangePasswordDialog } from "@/components/settings/change-password-dialog";
import { DeleteAccountDialog } from "@/components/settings/delete-account-dialog";
import type { CurrentUser } from "@/lib/db/user";

interface SettingsAccountProps {
  user: CurrentUser;
}

/**
 * The two things that can be done to the account, each behind its own dialog.
 * Who the account belongs to is the profile page's job; this one only acts.
 *
 * Three rows of one shape — a title and a sub-line on the left, the action that
 * belongs to them on the right. The first names the card and carries no action.
 */
export function SettingsAccount({ user }: SettingsAccountProps) {
  return (
    <section className="settings-card">
      <div className="settings-row">
        <div className="settings-row-text">
          <h2 className="settings-card-title">Account</h2>
          <p className="settings-row-description">
            Manage your account security and preferences
          </p>
        </div>
      </div>

      <div className="settings-row">
        <div className="settings-row-text">
          <h3 className="settings-row-title">Password</h3>
          <p className="settings-row-description">
            Update your password to keep your account secure
          </p>
        </div>

        {user.hasPassword ? (
          <ChangePasswordDialog />
        ) : (
          <p className="settings-row-note">
            This account signs in with GitHub, so there is no password to change.
          </p>
        )}
      </div>

      <div className="settings-row" data-danger>
        <div className="settings-row-text">
          <h3 className="settings-row-title">Delete Account</h3>
          <p className="settings-row-description">
            Permanently delete your account and all associated data
          </p>
        </div>

        <DeleteAccountDialog email={user.email} />
      </div>
    </section>
  );
}
