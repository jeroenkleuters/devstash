import { createHash, randomBytes } from "node:crypto";

import { hash } from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { MAIL_FROM, getResend } from "@/lib/resend";

/**
 * Deliberately shorter than the 24 hours a verification link gets: a live reset
 * token is worth more, since it takes over an account rather than confirming
 * one that already belongs to whoever clicked.
 */
const TOKEN_TTL_MS = 60 * 60 * 1000;

/** 32 bytes of entropy, base64url so it survives a query string untouched. */
const TOKEN_BYTES = 32;

/** Matches `prisma/seed.ts` and the register route, so every hash costs alike. */
const PASSWORD_SALT_ROUNDS = 12;

/**
 * `VerificationToken` carries no column saying what a token is for, and both
 * flows clear an address's earlier rows before writing a new one. Prefixing the
 * identifier keeps them out of each other's rows: asking for a reset no longer
 * silently kills a pending verification link, or the other way round.
 */
const IDENTIFIER_PREFIX = "password-reset:";

/** What the reset page and the reset endpoint report back. */
export type PasswordResetState = "valid" | "expired" | "invalid";

export type PasswordResetOutcome = "reset" | "expired" | "invalid";

/**
 * The row key a reset token is stored under. Exported because deleting an
 * account has to clear these rows by hand — they have no relation to `User` to
 * cascade through — and rebuilding the prefix there would leave two copies of
 * it to keep in step.
 */
export function passwordResetIdentifier(email: string): string {
  return `${IDENTIFIER_PREFIX}${email}`;
}

/**
 * Whether a `VerificationToken` row belongs to this flow. The verification side
 * reads it too, so that a reset token clicked against its endpoint is left
 * alone instead of being found by digest and thrown away.
 */
export function isPasswordResetIdentifier(identifier: string): boolean {
  return identifier.startsWith(IDENTIFIER_PREFIX);
}

function emailFrom(identifier: string): string | null {
  return isPasswordResetIdentifier(identifier)
    ? identifier.slice(IDENTIFIER_PREFIX.length)
    : null;
}

/**
 * The raw token travels in the email; only its digest is stored, so a read of
 * `VerificationToken` yields nothing that can take over an account. SHA-256
 * rather than bcrypt for the same reason as verification: 32 random bytes have
 * no low-entropy guess for a slow hash to defend against.
 */
function digest(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Issues a fresh reset link and mails it. Any earlier reset token for the
 * address is dropped first, so only the newest email works.
 *
 * Returns whether the mail was accepted. The caller answers generically either
 * way — whether an address is registered is exactly what this endpoint must not
 * confirm — so the result is for logging, not for the response.
 */
export async function issuePasswordReset({
  email,
  name,
  origin,
}: {
  email: string;
  name: string | null;
  origin: string;
}): Promise<boolean> {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");

  await prisma.verificationToken.deleteMany({
    where: { identifier: passwordResetIdentifier(email) },
  });
  await prisma.verificationToken.create({
    data: {
      identifier: passwordResetIdentifier(email),
      token: digest(token),
      expires: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  // A page rather than a route handler, because the link lands on a form: there
  // is nothing to spend until a new password has been typed.
  const url = `${origin}/reset-password?token=${encodeURIComponent(token)}`;

  // The SDK reports failures on the response rather than by throwing, so an
  // unreachable Resend still has to be caught separately.
  try {
    const { error } = await getResend().emails.send({
      from: MAIL_FROM,
      to: [email],
      subject: "Reset your DevSquirrel password",
      text: resetText(name, url),
      html: resetHtml(name, url),
    });

    if (error) {
      // Pulled apart rather than passed whole: the SDK's error object logs as
      // `{}`, so the reason for the rejection would otherwise be lost.
      console.error(`Password reset email rejected: ${error.name} — ${error.message}`);

      return false;
    }

    return true;
  } catch (cause) {
    console.error("Password reset email failed to send", cause);

    return false;
  }
}

/**
 * Reads a token without spending it, so the page behind the link can decide
 * between showing the form and explaining why it cannot. The token is only
 * consumed once a new password has actually been submitted.
 */
export async function checkPasswordResetToken(
  token: string,
): Promise<PasswordResetState> {
  const existing = await prisma.verificationToken.findUnique({
    where: { token: digest(token) },
    select: { identifier: true, expires: true },
  });

  // A verification token would also be found here — its digest lives in the
  // same table — so the prefix is what keeps one flow's link from opening the
  // other's form.
  if (!existing || !emailFrom(existing.identifier)) {
    return "invalid";
  }

  return existing.expires.getTime() < Date.now() ? "expired" : "valid";
}

/**
 * Spends a token and writes the new password. The row is removed whatever the
 * outcome, so a link works once; a second submit reports `invalid`, which the
 * form words to cover "already used" as well as "never existed".
 */
export async function resetPasswordWithToken(
  token: string,
  password: string,
): Promise<PasswordResetOutcome> {
  const existing = await prisma.verificationToken.findUnique({
    where: { token: digest(token) },
    select: { identifier: true, expires: true },
  });

  if (!existing) {
    return "invalid";
  }

  const email = emailFrom(existing.identifier);

  // A verification token, reaching the wrong endpoint. Left in place rather
  // than deleted: it is not this flow's row to spend.
  if (!email) {
    return "invalid";
  }

  // `deleteMany` rather than `delete`: the latter throws when the row is
  // already gone, so two submissions of one token would race between the read
  // above and here, and the loser would answer 500 instead of saying the link
  // was spent. The count is what makes single-use hold — only the request that
  // actually removed the row goes on to write a password.
  const { count } = await prisma.verificationToken.deleteMany({
    where: { token: digest(token) },
  });

  if (count === 0) {
    return "invalid";
  }

  if (existing.expires.getTime() < Date.now()) {
    return "expired";
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, emailVerified: true },
  });

  if (!user) {
    return "invalid";
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hash(password, PASSWORD_SALT_ROUNDS),
      // Clicking a link sent to the address proves the same thing verification
      // asks for, so an unverified account is confirmed by getting this far.
      // Without it, a reset would succeed and sign-in would still refuse.
      emailVerified: user.emailVerified ?? new Date(),
    },
  });

  return "reset";
}

/** The name is interpolated into markup, and a user chose it. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function greeting(name: string | null): string {
  return name ? `Hi ${name},` : "Hi,";
}

function resetText(name: string | null, url: string): string {
  return [
    greeting(name),
    "",
    "Use this link to choose a new DevSquirrel password:",
    url,
    "",
    "The link expires in 1 hour. If you didn't ask to reset your password, ignore this email — your current one still works.",
  ].join("\n");
}

function resetHtml(name: string | null, url: string): string {
  // Inline styles throughout — email clients strip stylesheets, so the usual
  // class-based approach does not survive the trip.
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#0b0b0e;font-family:ui-sans-serif,system-ui,sans-serif;color:#e5e5e8">
    <table role="presentation" style="max-width:480px;margin:0 auto;border-collapse:collapse">
      <tr><td style="padding-bottom:24px;font-size:18px;font-weight:600">DevSquirrel</td></tr>
      <tr><td style="font-size:14px;line-height:1.6">
        <p style="margin:0 0 16px">${escapeHtml(greeting(name))}</p>
        <p style="margin:0 0 24px">Choose a new password for your DevSquirrel account.</p>
        <p style="margin:0 0 24px">
          <a href="${url}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#3b82f6;color:#fff;font-weight:500;text-decoration:none">Reset password</a>
        </p>
        <p style="margin:0 0 16px;color:#9a9aa2">The link expires in 1 hour.</p>
        <p style="margin:0;color:#9a9aa2">If you didn't ask to reset your password, you can ignore this email — your current one still works.</p>
      </td></tr>
    </table>
  </body>
</html>`;
}
