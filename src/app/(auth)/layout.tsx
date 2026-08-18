import type { ReactNode } from "react";
import Link from "next/link";
import { Layers } from "lucide-react";

/**
 * The shell both auth pages share: the brand above a centered card. A route
 * group, so `/sign-in` and `/register` keep their top-level URLs while staying
 * out of the dashboard's sidebar layout.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell">
      <Link href="/" className="auth-brand">
        <span className="auth-brand-mark">
          <Layers size={20} aria-hidden />
        </span>
        DevStash
      </Link>
      {children}
    </div>
  );
}
