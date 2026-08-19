"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toastIfRateLimited } from "@/lib/rate-limit-toast";
import { firstIssueMessage, registerSchema } from "@/lib/validations/auth";

/** The shape `POST /api/auth/register` answers with, either way. */
interface RegisterResponse {
  success?: boolean;
  error?: string;
  data?: { verificationRequired?: boolean; emailSent?: boolean };
}

const NETWORK_ERROR = "Could not reach the server. Try again.";
const UNKNOWN_ERROR = "Could not create the account.";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    // The same schema the route runs, so the rules the server enforces — the
    // password's byte cap included — are the ones shown here.
    const parsed = registerSchema.safeParse({
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      confirmPassword: String(formData.get("confirmPassword") ?? ""),
    });

    if (!parsed.success) {
      setError(firstIssueMessage(parsed.error));
      return;
    }

    setIsPending(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const result = (await response.json()) as RegisterResponse;

      if (!response.ok) {
        // The rate limit takes the toast instead of the slot above the form.
        if (!toastIfRateLimited(response.status, result.error)) {
          setError(result.error ?? UNKNOWN_ERROR);
        }

        setIsPending(false);

        return;
      }

      // Both branches stay pending on the way out: the navigation is already
      // under way, and re-enabling the button would invite a second submit for
      // an email that now exists. `replace` keeps the back button off the
      // filled-in form.

      // The server decides whether verification applies, so the flag never
      // reaches the browser. An absent field means the old behaviour, which is
      // the safe reading either way.
      if (result.data?.verificationRequired === false) {
        router.replace("/sign-in");

        return;
      }

      // The account exists but cannot sign in until the link is clicked, so the
      // visitor goes to `/verify` rather than to a sign-in form that would only
      // reject them. Its `sent` state also carries the resend form, which is the
      // way out when the mail never arrived.
      const status = result.data?.emailSent === false ? "send-failed" : "sent";

      router.replace(
        `/verify?status=${status}&email=${encodeURIComponent(parsed.data.email)}`,
      );
    } catch {
      setError(NETWORK_ERROR);
      setIsPending(false);
    }
  }

  return (
    <section className="auth-card">
      <header className="auth-card-header">
        <h1>Create an account</h1>
        <p>One place for your snippets, prompts, commands and links.</p>
      </header>

      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="auth-form" noValidate>
        <div className="auth-field">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            placeholder="Ada Lovelace"
            required
          />
        </div>

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
        </div>

        <div className="auth-field">
          <Label htmlFor="password">Password</Label>
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
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
          />
        </div>

        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="auth-switch">
        Already have an account? <Link href="/sign-in">Sign in</Link>
      </p>
    </section>
  );
}
