"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { firstIssueMessage, resetPasswordSchema } from "@/lib/validations/auth";

interface ResetPasswordFormProps {
  /** Checked by the page before this renders, but only spent on submit. */
  token: string;
}

/** The shape `POST /api/auth/reset-password` answers with, either way. */
interface ResetPasswordResponse {
  error?: string;
}

const NETWORK_ERROR = "Could not reach the server. Try again.";
const UNKNOWN_ERROR = "Could not reset the password.";

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    // The same schema the route runs, so the rules the server enforces — the
    // password's byte cap included — are the ones shown here.
    const parsed = resetPasswordSchema.safeParse({
      token,
      password: String(formData.get("password") ?? ""),
      confirmPassword: String(formData.get("confirmPassword") ?? ""),
    });

    if (!parsed.success) {
      setError(firstIssueMessage(parsed.error));
      return;
    }

    setIsPending(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (!response.ok) {
        const body = (await response.json()) as ResetPasswordResponse;

        setError(body.error ?? UNKNOWN_ERROR);
        setIsPending(false);

        return;
      }

      // Stays pending on the way out: the navigation is under way, and the
      // token is spent, so a second submit could only fail. `replace` keeps the
      // back button off a form whose link no longer works.
      router.replace("/sign-in?reset=1");
    } catch {
      setError(NETWORK_ERROR);
      setIsPending(false);
    }
  }

  return (
    <section className="auth-card">
      <header className="auth-card-header">
        <h1>Choose a new password</h1>
        <p>You&apos;ll be signed in with it from now on.</p>
      </header>

      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="auth-form" noValidate>
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
          {isPending ? "Saving…" : "Save new password"}
        </Button>
      </form>

      <p className="auth-switch">
        <Link href="/sign-in">Back to sign in</Link>
      </p>
    </section>
  );
}
