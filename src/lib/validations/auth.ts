import { z } from "zod";

/**
 * Emails are trimmed and lowercased before the format check, so the value that
 * reaches Prisma is the same on registration and on sign-in — otherwise
 * `Test@Example.com` would create a row that `test@example.com` never finds.
 */
const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."));

/** What the Credentials provider's `authorize` receives from the sign-in form. */
export const signInSchema = z.object({
  email: emailSchema,
  // Presence only — the length rule belongs to registration, and tightening it
  // here would lock out any account whose password predates the rule.
  password: z.string().min(1, "Password is required."),
});

/**
 * bcrypt hashes only the first 72 bytes and silently drops the rest, which
 * would make a long passphrase interchangeable with any string sharing its
 * first 72 bytes. Reject those instead of truncating them. The check counts
 * bytes rather than `.length`, since one character can encode to four.
 */
const BCRYPT_MAX_BYTES = 72;

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .refine(
    (value) => new TextEncoder().encode(value).length <= BCRYPT_MAX_BYTES,
    { error: `Password must be at most ${BCRYPT_MAX_BYTES} bytes.` },
  );

/** The `POST /api/auth/register` body. */
export const registerSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required.").max(80),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    error: "Passwords do not match.",
    path: ["confirmPassword"],
  });

/** The `POST /api/auth/resend-verification` body. */
export const resendVerificationSchema = z.object({ email: emailSchema });

/** The `POST /api/auth/forgot-password` body. */
export const forgotPasswordSchema = z.object({ email: emailSchema });

/**
 * The `POST /api/auth/reset-password` body. The token comes from the hidden
 * field the page filled in from the query string, so an empty one means a
 * mangled link rather than anything the visitor typed.
 */
export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "That reset link is missing its token."),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    error: "Passwords do not match.",
    path: ["confirmPassword"],
  });

/**
 * The profile page's change-password form. The current password is checked for
 * presence only, for the same reason sign-in is: an account whose password
 * predates a rule still has to be able to prove it knows it.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    error: "Passwords do not match.",
    path: ["confirmPassword"],
  });

/** The first issue's message, for responses that carry a single error string. */
export function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid request.";
}
