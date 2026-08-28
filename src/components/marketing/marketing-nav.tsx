"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { MarketingBrand } from "@/components/marketing/brand";
import { Button } from "@/components/ui/button";

interface MarketingNavProps {
  /** Someone already signed in is offered the app, not another sign-up. */
  signedIn: boolean;
}

export function MarketingNav({ signedIn }: MarketingNavProps) {
  const [scrolled, setScrolled] = useState(false);
  // The nav also sits on the auth pages, where one of its two actions would
  // link to the page you are already on. Drop that one; the other reads as the
  // cross-link each form already offers underneath it.
  const pathname = usePathname();

  useEffect(() => {
    const sync = () => setScrolled(window.scrollY > 16);
    sync(); // the page can load already scrolled
    window.addEventListener("scroll", sync, { passive: true });
    return () => window.removeEventListener("scroll", sync);
  }, []);

  return (
    <header className="nav" data-scrolled={scrolled}>
      <div className="shell nav-inner">
        <MarketingBrand />
        <nav className="nav-links" aria-label="Primary">
          {/* Rooted, not bare fragments: off the homepage there is no section
              to jump to, so these have to be cross-page links. */}
          <Link href="/#features">Features</Link>
          <Link href="/#pricing">Pricing</Link>
        </nav>
        <div className="nav-actions">
          {signedIn ? (
            <Button asChild className="cta-accent">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <>
              {pathname !== "/sign-in" && (
                <Button asChild variant="ghost">
                  <Link href="/sign-in">Sign In</Link>
                </Button>
              )}
              {pathname !== "/register" && (
                <Button asChild className="cta-accent">
                  <Link href="/register">Get Started</Link>
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
