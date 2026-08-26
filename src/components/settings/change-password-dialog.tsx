"use client";

import { KeyRound } from "lucide-react";

import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Opens the change-password form, which is the only place it renders. Radix
 * unmounts the content when the dialog closes, so the form — and whatever it
 * last reported — starts clean each time it is opened.
 *
 * A client component like its delete-account sibling: the trigger is
 * interactive, and `asChild` clones the `Button` rather than rendering it.
 */
export function ChangePasswordDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <KeyRound aria-hidden />
          Change Password
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>
            This signs you out everywhere. You&apos;ll sign back in with the new
            password.
          </DialogDescription>
        </DialogHeader>

        <ChangePasswordForm />
      </DialogContent>
    </Dialog>
  );
}
