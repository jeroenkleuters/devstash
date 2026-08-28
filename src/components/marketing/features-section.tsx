import {
  Code,
  File,
  Library,
  Search,
  Sparkles,
  Terminal,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { Reveal } from "@/components/marketing/reveal";

/** `slug` is the plural `ItemType.slug` the `[data-type]` map is keyed on. */
const FEATURES: {
  slug: string;
  title: string;
  icon: LucideIcon;
  body: ReactNode;
}[] = [
  {
    slug: "snippets",
    title: "Code Snippets",
    icon: Code,
    body: "Syntax-highlighted in a real editor, with the language remembered and a copy button on every card.",
  },
  {
    slug: "prompts",
    title: "AI Prompts",
    icon: Sparkles,
    body: "Stop digging through chat history. Keep the prompts that worked, written in markdown with a live preview.",
  },
  {
    slug: "links",
    title: "Instant Search",
    icon: Search,
    body: (
      <>
        One palette over titles, tags, types and full content. Hit <kbd>Ctrl</kbd>{" "}
        <kbd>K</kbd> from anywhere in the app.
      </>
    ),
  },
  {
    slug: "commands",
    title: "Commands",
    icon: Terminal,
    body: "The incantation you looked up three times last month, saved once and pinned to the top of the list.",
  },
  {
    slug: "files",
    title: "Files & Docs",
    icon: File,
    body: "Drop files and images straight onto the page. Context files, diagrams and screenshots live beside the code.",
  },
  {
    slug: "images",
    title: "Collections",
    icon: Library,
    body: "Group anything with anything. An item can sit in as many collections as it earns a place in.",
  },
];

export function FeaturesSection() {
  return (
    <section className="section" id="features">
      <div className="shell">
        <Reveal as="header" className="section-head">
          <h2>Everything, in its place</h2>
          <p className="lede">
            Seven types out of the box. One drawer to capture them, one search to
            find them again.
          </p>
        </Reveal>
        <ul className="feature-grid">
          {FEATURES.map(({ slug, title, icon: Icon, body }) => (
            <Reveal key={title} as="li" className="feature-card" dataType={slug}>
              <span className="feature-icon">
                <Icon className="icon" aria-hidden />
              </span>
              <h3>{title}</h3>
              <p>{body}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
