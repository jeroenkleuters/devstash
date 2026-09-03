import { createHash, randomBytes } from "node:crypto";

import { isPasswordResetIdentifier } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import { MAIL_FROM, getResend } from "@/lib/resend";

/** How long a verification link stays usable. */
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/** 32 bytes of entropy, base64url so it survives a query string untouched. */
const TOKEN_BYTES = 32;

/** What `consumeVerificationToken` reports back, straight onto `/verify`. */
export type VerificationOutcome =
  | "verified"
  | "already"
  | "expired"
  | "invalid";

/**
 * The raw token travels in the email; only its digest is stored. A read of the
 * `VerificationToken` table therefore yields nothing that can verify an
 * account. SHA-256 rather than bcrypt is the right tool here: the token is 32
 * random bytes, so there is no low-entropy guess for a slow hash to defend.
 */
function digest(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Issues a fresh link and mails it. Any earlier token for the address is
 * dropped first, so only the newest email works — a resend invalidates the one
 * before it rather than leaving a widening set of live links.
 *
 * Returns whether the mail was accepted; the caller decides what a failure
 * means, since a registration should not be thrown away over it.
 */
export async function issueEmailVerification({
  email,
  name,
  origin,
}: {
  email: string;
  name: string | null;
  origin: string;
}): Promise<boolean> {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");

  await prisma.verificationToken.deleteMany({ where: { identifier: email } });
  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token: digest(token),
      expires: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  const url = `${origin}/api/auth/verify?token=${encodeURIComponent(token)}`;

  // The SDK reports failures on the response rather than by throwing, so an
  // unreachable Resend still has to be caught separately.
  try {
    const { error } = await getResend().emails.send({
      from: MAIL_FROM,
      to: [email],
      subject: "Verify your CodeSquirrel email",
      text: verificationText(name, url),
      html: verificationHtml(name, url),
    });

    if (error) {
      // Pulled apart rather than passed whole: the SDK's error object logs as
      // `{}`, so the reason for the rejection would otherwise be lost.
      console.error(
        `Verification email rejected: ${error.name} — ${error.message}`,
      );

      return false;
    }

    return true;
  } catch (cause) {
    console.error("Verification email failed to send", cause);

    return false;
  }
}

/**
 * Spends a link. The row is removed whatever the outcome, so a token works
 * once; a second click on the same link reports `invalid`, which the page
 * words to cover "already used" as well as "never existed".
 */
export async function consumeVerificationToken(
  token: string,
): Promise<VerificationOutcome> {
  const existing = await prisma.verificationToken.findUnique({
    where: { token: digest(token) },
    select: { identifier: true, expires: true },
  });

  if (!existing) {
    return "invalid";
  }

  // A password-reset token, reaching the wrong endpoint — both flows share this
  // table and are told apart by the identifier. Left in place rather than
  // deleted: it is not this flow's row to spend.
  if (isPasswordResetIdentifier(existing.identifier)) {
    return "invalid";
  }

  await prisma.verificationToken.delete({ where: { token: digest(token) } });

  if (existing.expires.getTime() < Date.now()) {
    return "expired";
  }

  const user = await prisma.user.findUnique({
    where: { email: existing.identifier },
    select: { id: true, emailVerified: true },
  });

  if (!user) {
    return "invalid";
  }

  if (user.emailVerified) {
    return "already";
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: new Date() },
  });

  return "verified";
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

function verificationText(name: string | null, url: string): string {
  return [
    greeting(name),
    "",
    "Confirm your email address to finish setting up your CodeSquirrel account:",
    url,
    "",
    "The link expires in 24 hours. If you didn't create an account, ignore this email.",
  ].join("\n");
}

function verificationHtml(name: string | null, url: string): string {
  // Inline styles throughout — email clients strip stylesheets, so the usual
  // class-based approach does not survive the trip.
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#0b0b0e;font-family:ui-sans-serif,system-ui,sans-serif;color:#e5e5e8">
    <table role="presentation" style="max-width:480px;margin:0 auto;border-collapse:collapse">
      <tr><td style="padding-bottom:24px;font-size:18px;font-weight:600">CodeSquirrel</td></tr>
      <tr><td style="font-size:14px;line-height:1.6">
        <p style="margin:0 0 16px">${escapeHtml(greeting(name))}</p>
        <p style="margin:0 0 24px">Confirm your email address to finish setting up your CodeSquirrel account.</p>
        <p style="margin:0 0 24px">
          <a href="${url}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#3b82f6;color:#fff;font-weight:500;text-decoration:none">Verify email</a>
        </p>
        <p style="margin:0 0 16px;color:#9a9aa2">The link expires in 24 hours.</p>
        <p style="margin:0;color:#9a9aa2">If you didn't create an account, you can ignore this email.</p>
      </td></tr>
    </table>
  </body>
</html>`;
}
