import type { Metadata } from "next";

import { AiSection } from "@/components/marketing/ai-section";
import { CtaSection } from "@/components/marketing/cta-section";
import { FeaturesSection } from "@/components/marketing/features-section";
import { HeroSection } from "@/components/marketing/hero-section";
import { PricingSection } from "@/components/marketing/pricing-section";

export const metadata: Metadata = {
  title: "DevStash — One home for everything you know",
  description:
    "Snippets, prompts, commands, notes, files and links in one fast, searchable, AI-enhanced hub.",
};

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <FeaturesSection />
      <AiSection />
      <PricingSection />
      <CtaSection />
    </>
  );
}
