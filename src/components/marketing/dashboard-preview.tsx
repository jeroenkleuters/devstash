import {
  Code,
  FileImage,
  Layers,
  Link as LinkIcon,
  Search,
  Sparkles,
  StickyNote,
  Terminal,
  type LucideIcon,
} from "lucide-react";

/**
 * The "...with DevStash" half of the hero: a still of the real dashboard.
 *
 * Presentational only — no query, no data. `data-type` carries the plural
 * `ItemType.slug` because that is what the `[data-type]` map in globals.css is
 * keyed on, so the rows and cards color-code from the app's own tokens.
 */

const NAV: { slug: string; label: string; icon: LucideIcon }[] = [
  { slug: "snippets", label: "Snippets", icon: Code },
  { slug: "prompts", label: "Prompts", icon: Sparkles },
  { slug: "commands", label: "Commands", icon: Terminal },
  { slug: "notes", label: "Notes", icon: StickyNote },
  { slug: "links", label: "Links", icon: LinkIcon },
];

const CARDS: { slug: string; title: string; icon: LucideIcon }[] = [
  { slug: "snippets", title: "useDebounce", icon: Code },
  { slug: "prompts", title: "Code review", icon: Sparkles },
  { slug: "commands", title: "docker prune", icon: Terminal },
  { slug: "notes", title: "Standup", icon: StickyNote },
  { slug: "images", title: "Palette", icon: FileImage },
  { slug: "links", title: "Auth docs", icon: LinkIcon },
];

export function DashboardPreview() {
  return (
    <figure className="panel preview">
      <figcaption className="panel-label">...with DevStash</figcaption>
      <div className="mock">
        <div className="mock-sidebar">
          <div className="mock-brand">
            <span className="brand-mark small">
              <Layers className="icon" aria-hidden />
            </span>
            <span className="mock-label strong">DevStash</span>
          </div>
          <div className="mock-nav">
            {NAV.map(({ slug, label, icon: Icon }) => (
              <span key={slug} className="mock-nav-row" data-type={slug}>
                <Icon className="icon" aria-hidden />
                <span className="mock-label">{label}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="mock-main">
          <div className="mock-search">
            <Search className="icon" aria-hidden />
            <span className="mock-label">Search everything</span>
          </div>
          <div className="mock-grid">
            {CARDS.map(({ slug, title, icon: Icon }) => (
              <span key={title} className="mock-card" data-type={slug}>
                <Icon className="icon" aria-hidden />
                <span className="mock-label">{title}</span>
                <span className="mock-bar w-lg" />
              </span>
            ))}
          </div>
        </div>
      </div>
    </figure>
  );
}
