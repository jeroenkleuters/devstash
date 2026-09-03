import type { Metadata } from "next";

import { AiSection } from "@/components/marketing/ai-section";
import { CtaSection } from "@/components/marketing/cta-section";
import { FeaturesSection } from "@/components/marketing/features-section";
import { HeroSection } from "@/components/marketing/hero-section";
import { PricingSection } from "@/components/marketing/pricing-section";
import { getCurrentUser } from "@/lib/db/user";

export const metadata: Metadata = {
  title: "CodeSquirrel — One home for everything you know",
  description:
    "Snippets, prompts, commands, notes, files and links in one fast, searchable, AI-enhanced hub.",
};

export default async function HomePage() {
  // The layout already resolves the visitor for the nav, and `getCurrentUser`
  // is `cache`d — so asking again here costs nothing and keeps the pricing
  // CTAs from offering an account to someone who has one.
  const signedIn = (await getCurrentUser()) !== null;

  return (
    <>
      <HeroSection />
      <FeaturesSection />
      <AiSection />
      <PricingSection signedIn={signedIn} />
      <CtaSection />
    </>
  );
}
