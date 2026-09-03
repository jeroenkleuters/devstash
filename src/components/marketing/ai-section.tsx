import { Check, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { Reveal } from "@/components/marketing/reveal";
import { Badge } from "@/components/ui/badge";

const CAPABILITIES: ReactNode[] = [
  <>
    <strong>Auto-tag suggestions</strong> the moment you paste something in
  </>,
  <>
    <strong>Summaries</strong> for long notes and documents
  </>,
  <>
    <strong>Explain this code</strong> for the snippet you saved and forgot
  </>,
  <>
    <strong>Prompt optimizer</strong> that sharpens what you wrote
  </>,
];

const TAGS = ["react", "hooks", "typescript", "debounce", "performance"];

/**
 * A still of a snippet in the editor — decorative, not real content, so the
 * highlighting is hand-written spans rather than a highlighter running on the
 * client. `.ln` is an empty span the CSS counts to draw the line number, so
 * the digits are generated content and never land on the clipboard.
 */
const Ln = () => <span className="ln" />;
const K = ({ children }: { children: ReactNode }) => (
  <span className="k">{children}</span>
);
const F = ({ children }: { children: ReactNode }) => (
  <span className="f">{children}</span>
);

export function AiSection() {
  return (
    <section className="section ai">
      <div className="shell ai-grid">
        <Reveal className="ai-copy">
          <Badge className="badge-pro" variant="outline">
            <Sparkles className="icon" aria-hidden />
            Pro Feature
          </Badge>
          <h2>Let the model do the filing</h2>
          <p className="lede">
            Capturing is easy. Describing what you captured is the part nobody
            does. CodeSquirrel handles it for you.
          </p>
          <ul className="checklist">
            {CAPABILITIES.map((line, index) => (
              <li key={index}>
                <span className="check">
                  <Check className="icon" aria-hidden />
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal className="editor">
          <div className="editor-bar">
            <span className="dots">
              <i />
              <i />
              <i />
            </span>
            <span className="editor-name">use-debounce.ts</span>
            <span className="editor-lang">typescript</span>
          </div>
          <pre className="editor-body">
            <code>
              <Ln />
              <K>export function</K> <F>useDebounce</F>&lt;T&gt;(value: T, delay ={" "}
              <span className="n">300</span>) {"{\n"}
              <Ln />
              {"  "}
              <K>const</K> [debounced, setDebounced] = <F>useState</F>(value);
              {"\n"}
              <Ln />
              {"\n"}
              <Ln />
              {"  "}
              <F>useEffect</F>(() =&gt; {"{\n"}
              <Ln />
              {"    "}
              <K>const</K> id = <F>setTimeout</F>(() =&gt; <F>setDebounced</F>(value),
              delay);
              {"\n"}
              <Ln />
              {"    "}
              <K>return</K> () =&gt; <F>clearTimeout</F>(id);
              {"\n"}
              <Ln />
              {"  }, [value, delay]);\n"}
              <Ln />
              {"\n"}
              <Ln />
              {"  "}
              <K>return</K> debounced;
              {"\n"}
              <Ln />
              {"}"}
            </code>
          </pre>
          <div className="editor-tags">
            <span className="tags-label">
              <Sparkles className="icon" aria-hidden />
              AI Generated Tags
            </span>
            <span className="tag-row">
              {TAGS.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
