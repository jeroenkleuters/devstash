import type { ReactNode } from "react";

import { MarketingNav } from "@/components/marketing/marketing-nav";

/**
 * The shell every auth page shares: the marketing nav over a centered card. A
 * route group, so `/sign-in` and friends keep their top-level URLs while
 * staying out of the dashboard's sidebar layout.
 *
 * The `.marketing` wrapper is what makes the nav render — every `.nav*` rule
 * in globals.css is nested inside that block, along with `.shell` and `.brand`.
 *
 * `signedIn` is hardcoded: every page in this group redirects a signed-in
 * visitor to the dashboard, so the nav's Dashboard branch is unreachable from
 * here and the layout needs no session of its own.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="marketing">
      <MarketingNav signedIn={false} />
      <div className="auth-shell">{children}</div>
    </div>
  );
}
