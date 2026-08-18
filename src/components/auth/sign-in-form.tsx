"use client";

import { useActionState } from "react";
import Link from "next/link";

import { signInWithCredentials, signInWithGitHub } from "@/actions/auth";
import { GitHubMark } from "@/components/auth/github-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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

  const error =
    state.error ??
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

        <Button type="submit" disabled={isPending}>
          {isPending ? "Signing in…" : "Sign in"}
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
        <Button
          type="submit"
          variant="outline"
          className="auth-provider-button"
        >
          <GitHubMark />
          Sign in with GitHub
        </Button>
      </form>

      <p className="auth-switch">
        Don&apos;t have an account? <Link href="/register">Create one</Link>
      </p>
    </section>
  );
}
