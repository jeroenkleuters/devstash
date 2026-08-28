import type { ReactNode } from "react";

import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { getCurrentUser } from "@/lib/db/user";

/**
 * The public marketing shell. Not in the proxy matcher — these pages are open
 * to anyone — but it does read the session so the nav can offer the app rather
 * than a sign-up to someone already signed in.
 *
 * `.marketing` scopes the whole ported stylesheet; the generic class names
 * inside it (.nav, .hero, .section) mean nothing outside this subtree.
 */
export const dynamic = "force-dynamic";

export default async function MarketingLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <div className="marketing">
      <MarketingNav signedIn={user !== null} />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  );
}
