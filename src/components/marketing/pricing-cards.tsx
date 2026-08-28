"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";

import { Reveal } from "@/components/marketing/reveal";
import { Button } from "@/components/ui/button";

const FREE = [
  "50 items",
  "3 collections",
  "Snippets, prompts, notes, commands, links",
  "Full search",
  "Dark mode",
];

const PRO = [
  "Unlimited items and collections",
  "File and image uploads",
  "AI auto-tagging and summaries",
  "Explain this code, prompt optimizer",
  "Data export (JSON / ZIP)",
  "Priority support",
];

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
 * Both CTAs go to /register — there is no checkout yet, and someone choosing a
 * plan needs an account either way.
 */
export function PricingCards() {
  const [yearly, setYearly] = useState(false);
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
            <Link href="/register">Get Started</Link>
          </Button>
        </Reveal>

        <Reveal as="article" className="price-card featured">
          <span className="popular">Most Popular</span>
          <h3>Pro</h3>
          <p className="price">
            <span className="amount">{yearly ? "$72" : "$8"}</span>
            <span className="per">{yearly ? "per year" : "per month"}</span>
          </p>
          <p className="price-note">
            {yearly
              ? "Billed yearly — two months free."
              : "Billed monthly. Cancel any time."}
          </p>
          <Checklist items={PRO} />
          <Button asChild className="cta-accent cta-block">
            <Link href="/register">Go Pro</Link>
          </Button>
        </Reveal>
      </div>
    </>
  );
}
