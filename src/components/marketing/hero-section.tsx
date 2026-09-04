import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { ChaosField } from "@/components/marketing/chaos-field";
import { DashboardPreview } from "@/components/marketing/dashboard-preview";
import { Reveal } from "@/components/marketing/reveal";
import { Button } from "@/components/ui/button";
import squirrel from "@/img/DevSquirrel.png";

export function HeroSection() {
  return (
    <section className="hero">
      <div className="shell">
        <div className="hero-intro">
          <Reveal className="hero-text">
            <p className="eyebrow">
              <span className="eyebrow-dot" aria-hidden />
              One hub for everything you know
            </p>
            <h1>
              Stop Losing Your{" "}
              <span className="gradient-text">Developer Knowledge</span>
            </h1>
            <p className="lede">
              Snippets in VS Code. Prompts in a chat history. Commands in a
              scratch file. Links in a folder of bookmarks you never open again.
              DevSquirrel puts all of it in one fast, searchable place.
            </p>
            <div className="hero-actions">
              <Button asChild size="lg" className="cta-accent">
                <Link href="/register">
                  Get Started Free
                  <ArrowRight className="icon" aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="#features">See Features</Link>
              </Button>
            </div>
            <p className="hero-note">
              Free forever for 50 items. No card required.
            </p>
          </Reveal>

          <Reveal className="hero-mascot">
            {/* Decorative: the headline beside it already says what the product
                is, so an alt would only repeat it to a screen reader. `priority`
                because it is the largest thing above the fold and is the likely
                LCP element. */}
            <Image
              className="hero-mascot-image"
              src={squirrel}
              alt=""
              sizes="(max-width: 63.99rem) 22rem, 41rem"
              priority
            />
          </Reveal>
        </div>

        <Reveal className="hero-visual">
          <figure className="panel chaos">
            <figcaption className="panel-label">Your knowledge today...</figcaption>
            <ChaosField />
          </figure>

          <div className="transform-arrow" aria-hidden>
            <ArrowRight className="icon" />
          </div>

          <DashboardPreview />
        </Reveal>
      </div>
    </section>
  );
}
