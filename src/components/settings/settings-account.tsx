import { ChangePasswordDialog } from "@/components/settings/change-password-dialog";
import { DeleteAccountDialog } from "@/components/settings/delete-account-dialog";
import type { CurrentUser } from "@/lib/db/user";

interface SettingsAccountProps {
  user: CurrentUser;
}

/**
 * The two things that can be done to the account, each behind its own dialog.
 * Who the account belongs to is the profile page's job; this one only acts.
 */
export function SettingsAccount({ user }: SettingsAccountProps) {
  return (
    <section className="settings-card">
      <h2 className="settings-card-title">Account</h2>
      <p className="settings-card-description">
        Changing your password signs you out everywhere. Deleting the account
        takes everything stored under it with it.
      </p>

      <div className="settings-actions">
        {user.hasPassword ? (
          <ChangePasswordDialog />
        ) : (
          <p className="settings-actions-note">
            This account signs in with GitHub, so there is no password to change.
          </p>
        )}

        <DeleteAccountDialog email={user.email} />
      </div>
    </section>
  );
}
