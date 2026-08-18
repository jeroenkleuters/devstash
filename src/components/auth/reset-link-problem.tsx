import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { PasswordResetState } from "@/lib/password-reset";

/** Everything `checkPasswordResetToken` reports other than a usable link. */
type UnusableLink = Exclude<PasswordResetState, "valid">;

interface ResetLinkProblemProps {
  state: UnusableLink;
}

const COPY: Record<UnusableLink, { heading: string; body: string; message: string }> = {
  expired: {
    heading: "Link expired",
    body: "Reset links last 1 hour. Ask for a new one and the next link will work.",
    message: "That reset link has expired.",
  },
  invalid: {
    heading: "Link not valid",
    body: "The link may already have been used, or it was only partly copied. Ask for a new one — or try signing in, in case the reset went through.",
    message: "That reset link is no longer valid.",
  },
};

/**
 * What `/reset-password` shows instead of the form. The token is only read
 * here, never spent, so this says nothing about whether an account exists —
 * only about the link that was clicked.
 */
export function ResetLinkProblem({ state }: ResetLinkProblemProps) {
  const copy = COPY[state];

  return (
    <section className="auth-card">
      <header className="auth-card-header">
        <h1>{copy.heading}</h1>
        <p>{copy.body}</p>
      </header>

      <p className="auth-error" role="alert">
        {copy.message}
      </p>

      <div className="auth-actions">
        <Button asChild>
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </div>

      <p className="auth-switch">
        <Link href="/sign-in">Back to sign in</Link>
      </p>
    </section>
  );
}
