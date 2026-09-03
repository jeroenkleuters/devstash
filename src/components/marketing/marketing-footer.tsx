import Link from "next/link";

import { MarketingBrand } from "@/components/marketing/brand";

/**
 * The prototype's footer named Changelog, Documentation, Privacy and four
 * other pages that do not exist. Rather than link them to 404s — which is what
 * "View all collections" did for weeks — the columns carry only what is real
 * and the rest stay dropped until there is somewhere to point them.
 *
 * Privacy is back: the page exists as of the AI controls feature, which is the
 * condition that entry set for restoring it. Terms is still absent, being a
 * different document that has not been written.
 */
export function MarketingFooter() {
  return (
    <footer className="footer">
      <div className="shell footer-inner">
        <div className="footer-brand">
          <MarketingBrand />
          <p>
            One fast, searchable, AI-enhanced hub for all developer knowledge.
          </p>
        </div>
        <nav className="footer-links" aria-label="Footer">
          <div>
            <h4>Product</h4>
            <Link href="#features">Features</Link>
            <Link href="#pricing">Pricing</Link>
            <Link href="/privacy">Privacy</Link>
          </div>
          <div>
            <h4>Get started</h4>
            <Link href="/register">Create an account</Link>
            <Link href="/sign-in">Sign in</Link>
          </div>
        </nav>
      </div>
      <div className="shell footer-bottom">
        <p>&copy; {new Date().getFullYear()} DevSquirrel. All rights reserved.</p>
        <p>Built for developers who are tired of looking for things.</p>
      </div>
    </footer>
  );
}
