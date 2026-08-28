import Link from "next/link";

import { MarketingBrand } from "@/components/marketing/brand";

/**
 * The prototype's footer named Changelog, Documentation, Privacy and four
 * other pages that do not exist. Rather than link them to 404s — which is what
 * "View all collections" did for weeks — the Product column keeps the two
 * anchors that are real and the rest are dropped until there is somewhere to
 * point them.
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
          </div>
          <div>
            <h4>Get started</h4>
            <Link href="/register">Create an account</Link>
            <Link href="/sign-in">Sign in</Link>
          </div>
        </nav>
      </div>
      <div className="shell footer-bottom">
        <p>&copy; {new Date().getFullYear()} DevStash. All rights reserved.</p>
        <p>Built for developers who are tired of looking for things.</p>
      </div>
    </footer>
  );
}
