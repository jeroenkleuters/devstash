import { PricingCards } from "@/components/marketing/pricing-cards";

interface PricingSectionProps {
  /** Passed through to the CTAs, which lead somewhere different once signed in. */
  signedIn: boolean;
}

export function PricingSection({ signedIn }: PricingSectionProps) {
  return (
    <section className="section" id="pricing">
      <div className="shell">
        <PricingCards signedIn={signedIn} />
      </div>
    </section>
  );
}
