"use client";

import { useActionState } from "react";

import { deleteAccountAction } from "@/actions/profile";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DELETE_ACCOUNT_INITIAL_STATE,
  type DeleteAccountState,
} from "@/types/profile";

interface DeleteAccountProps {
  /** Named in the dialog, so the confirmation says which account is going. */
  email: string;
}

/**
 * Deletes the account and everything in it, behind a confirmation dialog. A
 * successful deletion signs out and leaves for the sign-in page, so the only
 * thing this renders afterwards is a failure.
 */
export function DeleteAccount({ email }: DeleteAccountProps) {
  // The action takes no arguments — there is nothing to submit but the intent —
  // so the payload type is spelled out for the form that dispatches it.
  const [state, formAction, isPending] = useActionState<
    DeleteAccountState,
    FormData
  >(deleteAccountAction, DELETE_ACCOUNT_INITIAL_STATE);

  return (
    <div className="profile-panel profile-panel-danger">
      <header className="profile-panel-header">
        <h3>Delete account</h3>
        <p>
          Removes your items, collections and tags. This cannot be undone.
        </p>
      </header>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive">Delete account</Button>
        </AlertDialogTrigger>

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this account?</AlertDialogTitle>
            <AlertDialogDescription>
              Everything stored under {email} — items, collections and tags —
              is deleted along with the account. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {state.error && (
            <p className="auth-error" role="alert">
              {state.error}
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Keep account</AlertDialogCancel>

            {/* A plain submit button rather than `AlertDialogAction`, which
                closes the dialog as soon as it is clicked: the deletion would
                then run with nothing on screen, and a failure would have
                nowhere to report itself. */}
            <form action={formAction}>
              <Button type="submit" variant="destructive" disabled={isPending}>
                {isPending ? "Deleting…" : "Delete everything"}
              </Button>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
