import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SIGN_IN_PATH } from "@/auth.config";
import { SettingsAccount } from "@/components/settings/settings-account";
import { SettingsBilling } from "@/components/settings/settings-billing";
import { SettingsEditor } from "@/components/settings/settings-editor";
import { SettingsUpload } from "@/components/settings/settings-upload";
import { getCurrentUser } from "@/lib/db/user";
import { firstParam } from "@/lib/search-params";

export const metadata: Metadata = {
  title: "Settings · DevStash",
};

// Reads the session and the account behind it on every request.
export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: PageProps<"/settings">) {
  const user = await getCurrentUser();

  // The proxy already turns an anonymous request away, so this covers what it
  // cannot: a token that still verifies against an account that is gone —
  // which is exactly the state deleting an account would leave behind if the
  // sign-out that follows it ever failed.
  if (!user) {
    redirect(SIGN_IN_PATH);
  }

  // Where checkout sent the visitor back to. Anything else is ignored rather
  // than rendered, so the notice cannot be summoned by a hand-typed URL saying
  // something the account did not do.
  const checkout = checkoutOutcome(firstParam((await searchParams).checkout));

  return (
    <>
      <div className="dashboard-heading">
        <h1>Settings</h1>
        <p>Manage your account settings</p>
      </div>

      <SettingsAccount user={user} />
      <SettingsBilling
        isPro={user.isPro}
        hasBilling={user.hasBilling}
        checkout={checkout}
      />
      <SettingsEditor />
      <SettingsUpload preferences={user.uploadPreferences} />
    </>
  );
}

/** The two outcomes the card has copy for, or nothing. */
function checkoutOutcome(value: string | undefined) {
  return value === "success" || value === "cancelled" ? value : undefined;
}
