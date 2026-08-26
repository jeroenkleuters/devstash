import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SIGN_IN_PATH } from "@/auth.config";
import { SettingsAccount } from "@/components/settings/settings-account";
import { getCurrentUser } from "@/lib/db/user";

export const metadata: Metadata = {
  title: "Settings · DevStash",
};

// Reads the session and the account behind it on every request.
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();

  // The proxy already turns an anonymous request away, so this covers what it
  // cannot: a token that still verifies against an account that is gone —
  // which is exactly the state deleting an account would leave behind if the
  // sign-out that follows it ever failed.
  if (!user) {
    redirect(SIGN_IN_PATH);
  }

  return (
    <>
      <div className="dashboard-heading">
        <h1>Settings</h1>
        <p>Manage your account</p>
      </div>

      <SettingsAccount user={user} />
    </>
  );
}
