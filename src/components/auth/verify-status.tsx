"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toastIfRateLimited } from "@/lib/rate-limit-toast";
import { firstIssueMessage, resendVerificationSchema } from "@/lib/validations/auth";
import type { VerifyStatus } from "@/types/auth";

interface VerifyStatusPanelProps {
  status: VerifyStatus;
  /** Carried over from registration, to save typing the address again. */
  email?: string;
}

interface Copy {
  heading: string;
  body: string;
  /** Which callout the message sits in — success reads green, failure red. */
  tone: "notice" | "error" | null;
  message?: string;
  /** Whether the state is recoverable by asking for another link. */
  canResend: boolean;
}

const COPY: Record<VerifyStatus, Copy> = {
  sent: {
    heading: "Check your email",
    body: "We sent you a link to confirm your address. It expires in 24 hours.",
    tone: null,
    canResend: true,
  },
  "send-failed": {
    heading: "Almost there",
    body: "Your account was created, but the verification email could not be sent.",
    tone: "error",
    message: "We could not send the email. Request a new link below.",
    canResend: true,
  },
  verified: {
    heading: "Email verified",
    body: "Your address is confirmed. You can sign in now.",
    tone: "notice",
    message: "Email verified.",
    canResend: false,
  },
  already: {
    heading: "Already verified",
    body: "This address was confirmed earlier, so there is nothing left to do.",
    tone: "notice",
    message: "This email is already verified.",
    canResend: false,
  },
  expired: {
    heading: "Link expired",
    body: "Verification links last 24 hours. Request a new one below.",
    tone: "error",
    message: "That link has expired.",
    canResend: true,
  },
  invalid: {
    heading: "Link not valid",
    body: "The link may already have been used, or it was only partly copied. Request a new one below — or try signing in, in case it worked the first time.",
    tone: "error",
    message: "That verification link is no longer valid.",
    canResend: true,
  },
};

const NETWORK_ERROR = "Could not reach the server. Try again.";
const UNKNOWN_ERROR = "Could not send a new link.";

/** The shape `POST /api/auth/resend-verification` answers with, either way. */
interface ResendResponse {
  message?: string;
  error?: string;
}

export function VerifyStatusPanel({ status, email }: VerifyStatusPanelProps) {
  const copy = COPY[status];
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleResend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const parsed = resendVerificationSchema.safeParse({
      email: String(formData.get("email") ?? ""),
    });

    if (!parsed.success) {
      setError(firstIssueMessage(parsed.error));
      return;
    }

    setIsPending(true);

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = (await response.json()) as ResendResponse;

      if (response.ok) {
        setResult(body.message ?? "A new link is on its way.");
      } else if (!toastIfRateLimited(response.status, body.error)) {
        // The rate limit takes the toast instead of the slot above the form.
        setError(body.error ?? UNKNOWN_ERROR);
      }
    } catch {
      setError(NETWORK_ERROR);
    }

    setIsPending(false);
  }

  return (
    <section className="auth-card">
      <header className="auth-card-header">
        <h1>{copy.heading}</h1>
        <p>{copy.body}</p>
      </header>

      {copy.tone && copy.message && (
        <p
          className={copy.tone === "notice" ? "auth-notice" : "auth-error"}
          role={copy.tone === "notice" ? "status" : "alert"}
        >
          {copy.message}
        </p>
      )}

      {result && (
        <p className="auth-notice" role="status">
          {result}
        </p>
      )}

      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}

      {copy.canResend ? (
        <form onSubmit={handleResend} className="auth-form" noValidate>
          <div className="auth-field">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              defaultValue={email ?? ""}
              required
            />
            <p className="auth-hint">
              Didn&apos;t get the email? Check spam, then send a new link.
            </p>
          </div>

          <Button type="submit" variant="outline" disabled={isPending}>
            {isPending ? "Sending…" : "Send a new link"}
          </Button>
        </form>
      ) : (
        <div className="auth-actions">
          <Button asChild>
            <Link href="/sign-in">Go to sign in</Link>
          </Button>
        </div>
      )}

      {/* The states without a resend form already carry a sign-in button. */}
      {copy.canResend && (
        <p className="auth-switch">
          <Link href="/sign-in">Back to sign in</Link>
        </p>
      )}
    </section>
  );
}
