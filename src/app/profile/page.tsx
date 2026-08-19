import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SIGN_IN_PATH } from "@/auth.config";
import { ChangePasswordForm } from "@/components/profile/change-password-form";
import { DeleteAccount } from "@/components/profile/delete-account";
import { ProfileIdentity } from "@/components/profile/profile-identity";
import { ProfileUsage } from "@/components/profile/profile-usage";
import { ProfileUsageSkeleton } from "@/components/profile/profile-usage-skeleton";
import { getCurrentUser } from "@/lib/db/user";

export const metadata: Metadata = {
  title: "Profile · DevStash",
};

// Reads the session and the account behind it on every request.
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
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
        <h1>Profile</h1>
        <p>Your account and what it holds</p>
      </div>

      <ProfileIdentity user={user} />

      {/* Its own boundary: the identity above needs only the user query this
          page already awaited, so it paints while the counts resolve. */}
      <Suspense fallback={<ProfileUsageSkeleton />}>
        <ProfileUsage userId={user.id} />
      </Suspense>

      <section className="dashboard-section">
        <h2 className="dashboard-section-title">Account</h2>

        <div className="profile-panels">
          {user.hasPassword ? (
            <ChangePasswordForm />
          ) : (
            <div className="profile-panel">
              <header className="profile-panel-header">
                <h3>Password</h3>
                <p>
                  This account signs in with GitHub, so there is no password to
                  change.
                </p>
              </header>
            </div>
          )}

          <DeleteAccount email={user.email} />
        </div>
      </section>
    </>
  );
}
