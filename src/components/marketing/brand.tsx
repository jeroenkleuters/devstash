import { Layers } from "lucide-react";
import Link from "next/link";

/**
 * The logo lockup, shared by the marketing nav and footer.
 *
 * Deliberately identical to the sidebar's (`sidebar-brand-mark` in
 * globals.css): the same 2rem gradient square, the same white Layers glyph,
 * the same name beside it. The gradient is the brand's blue-to-purple and not
 * the site accent — this is the one place purple stays, because it is what the
 * app itself shows.
 */
export function MarketingBrand() {
  return (
    <Link className="brand" href="/">
      <span className="brand-mark">
        <Layers size={18} aria-hidden />
      </span>
      <span className="brand-name">CodeSquirrel</span>
    </Link>
  );
}
