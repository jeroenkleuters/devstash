"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UNREACHABLE } from "@/constants/messages";
import { toastIfRateLimited } from "@/lib/rate-limit-toast";
import { firstIssueMessage, forgotPasswordSchema } from "@/lib/validations/auth";

/** The shape `POST /api/auth/forgot-password` answers with, either way. */
interface ForgotPasswordResponse {
  message?: string;
  error?: string;
}

const UNKNOWN_ERROR = "Could not send a reset link.";

export function ForgotPasswordForm() {
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const parsed = forgotPasswordSchema.safeParse({
      email: String(formData.get("email") ?? ""),
    });

    if (!parsed.success) {
      setError(firstIssueMessage(parsed.error));
      return;
    }

    setIsPending(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = (await response.json()) as ForgotPasswordResponse;

      if (response.ok) {
        setResult(body.message ?? "If that account exists, a reset link is on its way.");
      } else if (!toastIfRateLimited(response.status, body.error)) {
        // The rate limit takes the toast instead of the slot above the form.
        setError(body.error ?? UNKNOWN_ERROR);
      }
    } catch {
      setError(UNREACHABLE);
    }

    setIsPending(false);
  }

  return (
    <section className="auth-card">
      <header className="auth-card-header">
        <h1>Reset your password</h1>
        <p>
          Give us the address you signed up with and we&apos;ll send a link to
          choose a new password.
        </p>
      </header>

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

      <form onSubmit={handleSubmit} className="auth-form" noValidate>
        <div className="auth-field">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
          />
          <p className="auth-hint">The link expires in 1 hour.</p>
        </div>

        <Button type="submit" disabled={isPending}>
          {isPending ? "Sending…" : "Send reset link"}
        </Button>
      </form>

      <p className="auth-switch">
        Remembered it? <Link href="/sign-in">Back to sign in</Link>
      </p>
    </section>
  );
}
