"use client";

import { Loader2 } from "lucide-react";
import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";

import { signInWithCredentials, signInWithGitHub } from "@/actions/auth";
import { GitHubMark } from "@/components/auth/github-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toastRateLimited } from "@/lib/rate-limit-toast";
import { SIGN_IN_INITIAL_STATE } from "@/types/auth";

interface SignInFormProps {
  /** Where to land after signing in — set by the proxy on a blocked request. */
  callbackUrl?: string;
  /** An `error` code NextAuth put on the URL, from a provider round trip. */
  providerError?: string;
  /** Set by the reset form on its way here, so the change is acknowledged. */
  passwordReset?: boolean;
}

/** The few provider failures worth naming; anything else gets the fallback. */
const PROVIDER_ERRORS: Record<string, string> = {
  OAuthAccountNotLinked:
    "That email already has an account. Sign in with the method you used first.",
  AccessDenied: "Access denied. The sign-in was not completed.",
};

const PROVIDER_ERROR_FALLBACK = "Could not sign you in. Try again.";

export function SignInForm({
  callbackUrl,
  providerError,
  passwordReset,
}: SignInFormProps) {
  const [state, formAction, isPending] = useActionState(
    signInWithCredentials,
    SIGN_IN_INITIAL_STATE,
  );

  // The action returns a fresh object every time it settles, so this runs once
  // per rejected submit rather than on every render.
  useEffect(() => {
    if (state.rateLimited && state.error) {
      toastRateLimited(state.error);
    }
  }, [state]);

  const error =
    (state.rateLimited ? null : state.error) ??
    (providerError
      ? (PROVIDER_ERRORS[providerError] ?? PROVIDER_ERROR_FALLBACK)
      : null);

  return (
    <section className="auth-card">
      <header className="auth-card-header">
        <h1>Sign in</h1>
        <p>Welcome back. Pick up where you left off.</p>
      </header>

      {/* Dropped once a sign-in has been rejected: "password updated" sitting
          above "incorrect email or password" reads as a contradiction. */}
      {passwordReset && !error && (
        <p className="auth-notice" role="status">
          Password updated. Sign in with your new one.
        </p>
      )}

      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}

      <form action={formAction} className="auth-form">
        <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />

        <div className="auth-field">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            defaultValue={state.email}
            required
          />
        </div>

        <div className="auth-field">
          <div className="auth-field-header">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="auth-field-link">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

        {/* The spinner rather than a changed label: the button keeps saying
            what it does, and the moving thing is what says it is working. */}
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 size={16} className="spinner" aria-hidden />}
          Sign in
        </Button>
      </form>

      <div className="auth-divider">
        <Separator />
        <span>or</span>
        <Separator />
      </div>

      {/* Its own form: the provider redirect has nothing to do with the fields
          above, and submitting it must not carry them along. */}
      <form action={signInWithGitHub}>
        <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />
        <GitHubSubmit />
      </form>

      <p className="auth-switch">
        Don&apos;t have an account? <Link href="/register">Create one</Link>
      </p>
    </section>
  );
}

/**
 * The GitHub button, as its own component so it can read the form's state.
 *
 * **`useFormStatus` rather than a second `useActionState`**, and that is forced
 * rather than preferred: `signInWithGitHub` redirects to github.com instead of
 * returning anything, so an action state would have nothing to hold and would
 * never settle. `useFormStatus` reports the submission itself — but only to a
 * component *inside* the form, which is the whole reason this is not inline.
 *
 * The pending state matters more here than on the credentials button beside it.
 * That one at least disables and relabels; this was a bare submit, and the
 * round trip it starts is the slowest of the three, so until the browser
 * actually navigates nothing on screen said anything had happened.
 */
function GitHubSubmit() {
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
      Sign in with GitHub
    </Button>
  );
}
