"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

import { signInWithGitHub } from "@/actions/auth";
import { GitHubMark } from "@/components/auth/github-mark";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface GitHubAuthFormProps {
  /**
   * What the button says. There is one action behind both call sites —
   * `signInWithGitHub` — because OAuth has no separate registration: the
   * adapter creates the row on a first sign-in. Only the wording differs, so
   * that is the only thing this takes.
   */
  label: string;
  /** Where to land afterwards — set by the proxy on a blocked request. */
  callbackUrl?: string;
}

/**
 * The button reports its own pending state, which is why it is a component
 * rather than markup: `useFormStatus` only reports to a component *inside*
 * the form it describes.
 *
 * The pending state matters more here than on a credentials button. That one
 * at least disables and relabels; this was a bare submit, and the round trip
 * it starts is the slowest of the three, so until the browser actually
 * navigates nothing on screen said anything had happened.
 */
function GitHubSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="outline"
      className="auth-provider-button"
      disabled={pending}
    >
      {/* The mark gives way to the spinner, and the label does not move —
          matching the credentials button above, where the spinner is likewise
          the only thing that changes. */}
      {pending ? (
        <Loader2 size={16} className="spinner" aria-hidden />
      ) : (
        <GitHubMark />
      )}
      {label}
    </Button>
  );
}

/**
 * The divider and the GitHub button under a credentials form.
 *
 * Shared by sign-in and register rather than written twice: register had none
 * of this, so someone who wanted GitHub had to guess their way to /sign-in
 * first, with nothing telling them that signing in there would create their
 * account.
 */
export function GitHubAuthForm({ label, callbackUrl }: GitHubAuthFormProps) {
  return (
    <>
      <div className="auth-divider">
        <Separator />
        <span>or</span>
        <Separator />
      </div>

      {/* Its own form: the provider redirect has nothing to do with the fields
          above, and submitting it must not carry them along. */}
      <form action={signInWithGitHub}>
        <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />
        <GitHubSubmit label={label} />
      </form>
    </>
  );
}
