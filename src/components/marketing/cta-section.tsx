import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Reveal } from "@/components/marketing/reveal";
import { Button } from "@/components/ui/button";

export function CtaSection() {
  return (
    <section className="section cta">
      <Reveal className="shell cta-inner">
        <h2>Ready to Organize Your Knowledge?</h2>
        <p className="lede">
          It takes about a minute to save the first thing. After that you never go
          looking for it again.
        </p>
        <Button asChild size="lg" className="cta-accent">
          <Link href="/register">
            Start Stashing
            <ArrowRight className="icon" aria-hidden />
          </Link>
        </Button>
      </Reveal>
    </section>
  );
}
