"use client";

import { useActionState } from "react";

import { changePassword } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CHANGE_PASSWORD_INITIAL_STATE } from "@/types/profile";

/**
 * Changes the password of an account that is already signed in, which is why it
 * asks for the current one instead of mailing a link. Rendered only for accounts
 * that have a password at all.
 *
 * No client-side copy of the rules: unlike registration, every rejection here
 * needs the server anyway — the current password is only checkable there — so
 * one round trip reports the byte cap and the mismatch along with it.
 */
export function ChangePasswordForm() {
  const [state, formAction, isPending] = useActionState(
    changePassword,
    CHANGE_PASSWORD_INITIAL_STATE,
  );

  return (
    <div className="profile-panel">
      <header className="profile-panel-header">
        <h3>Change password</h3>
        <p>You&apos;ll sign in with the new one from now on.</p>
      </header>

      {state.error && (
        <p className="auth-error" role="alert">
          {state.error}
        </p>
      )}

      {state.success && (
        <p className="auth-notice" role="status">
          Password updated.
        </p>
      )}

      {/* React clears the fields once the action settles, which is what should
          happen either way here — nothing typed into them is worth keeping. */}
      <form action={formAction} className="auth-form">
        <div className="auth-field">
          <Label htmlFor="currentPassword">Current password</Label>
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

        <div className="auth-field">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
          />
          <p className="auth-hint">At least 8 characters.</p>
        </div>

        <div className="auth-field">
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
          />
        </div>

        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Change password"}
        </Button>
      </form>
    </div>
  );
}
