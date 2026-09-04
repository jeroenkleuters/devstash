"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";

import { Reveal } from "@/components/marketing/reveal";
import { Button } from "@/components/ui/button";
import { PLAN_PRICING } from "@/constants/pricing";
import { FREE_COLLECTION_LIMIT, FREE_ITEM_LIMIT } from "@/lib/usage-limits";

// Rendered from the constants the gates enforce rather than restated, so the
// page cannot promise a number the server refuses.
const FREE = [
  `${FREE_ITEM_LIMIT} items`,
  `${FREE_COLLECTION_LIMIT} collections`,
  "Snippets, prompts, notes, commands, links",
  "Full search",
  "Dark and light mode, switchable",
];

// One feature per line, and named the way the AI section above names it. The
// prompt optimizer used to arrive as the second half of the explain-this-code
// bullet, which sold the newest AI feature as an afterthought to another one.
const PRO = [
  "Unlimited items and collections",
  "File, image and book uploads",
  "AI auto-tagging and summaries",
  "Explain this code",
  "Prompt optimizer that sharpens what you wrote",
  "Data export (JSON / ZIP)",
  "Priority support",
];

interface PricingCardsProps {
  /** Whether anyone is signed in, which decides where both CTAs lead. */
  signedIn: boolean;
}

function Checklist({ items }: { items: string[] }) {
  return (
    <ul className="checklist tight">
      {items.map((item) => (
        <li key={item}>
          <span className="check">
            <Check className="icon" aria-hidden />
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The billing toggle plus the two plans it swaps between.
 *
 * A real checkbox drawn with `appearance: none`, following the settings page:
 * no `switch` primitive is installed, and the browser's own keyboard and touch
 * behaviour is worth more than a hand-built toggle.
 *
 * The CTAs depend on whether anyone is signed in. Signed out, both lead to
 * /register — checkout is a server action needing a session, and someone
 * choosing a plan needs an account either way. Signed in, Go Pro leads to
 * /settings rather than starting checkout directly: a marketing page should not
 * silently begin a payment flow.
 */
export function PricingCards({ signedIn }: PricingCardsProps) {
  const [yearly, setYearly] = useState(false);
  const pricing = PLAN_PRICING[yearly ? "yearly" : "monthly"];
  const switchId = useId();

  return (
    <>
      <Reveal as="header" className="section-head">
        <h2>Simple pricing</h2>
        <p className="lede">Start free. Upgrade when your stash outgrows it.</p>
        <div className="billing-toggle">
          <span className="billing-option" data-active={!yearly}>
            Monthly
          </span>
          <label className="switch" htmlFor={switchId}>
            <input
              id={switchId}
              type="checkbox"
              checked={yearly}
              onChange={(event) => setYearly(event.target.checked)}
              aria-label="Bill yearly"
            />
            <span className="switch-track" aria-hidden />
          </label>
          <span className="billing-option" data-active={yearly}>
            Yearly
          </span>
          <span className="save-badge">Save 25%</span>
        </div>
      </Reveal>

      <div className="pricing-grid">
        <Reveal as="article" className="price-card">
          <h3>Free</h3>
          <p className="price">
            <span className="amount">$0</span>
            <span className="per">forever</span>
          </p>
          <p className="price-note">
            Everything you need to stop losing things.
          </p>
          <Checklist items={FREE} />
          <Button asChild variant="outline" className="cta-block">
            <Link href={signedIn ? "/dashboard" : "/register"}>
              {signedIn ? "Go to your stash" : "Get Started"}
            </Link>
          </Button>
        </Reveal>

        <Reveal as="article" className="price-card featured">
          <span className="popular">Most Popular</span>
          <h3>Pro</h3>
          <p className="price">
            {/* From the shared table, so this page and the upgrade dialog
                cannot quote different figures. */}
            <span className="amount">{pricing.amount}</span>
            <span className="per">{pricing.period}</span>
          </p>
          <p className="price-note">
            {yearly
              ? "Billed yearly — two months free."
              : "Billed monthly. Cancel any time."}
          </p>
          <Checklist items={PRO} />
          <Button asChild className="cta-accent cta-block">
            <Link href={signedIn ? "/settings" : "/register"}>Go Pro</Link>
          </Button>
        </Reveal>
      </div>
    </>
  );
}
