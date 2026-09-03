import Image from "next/image";
import Link from "next/link";

import logo from "@/img/logo.png";

/**
 * The logo lockup, shared by the marketing nav and footer.
 *
 * Deliberately identical to the sidebar's (`sidebar-brand-mark` in
 * globals.css): the same 2rem mark, the same name beside it. The artwork is a
 * self-contained tile that carries its own rounded frame and background, which
 * is why nothing is drawn behind it and no `border-radius` is applied on top —
 * that would round an already-rounded corner and clip the border.
 *
 * `next/image` rather than a plain `<img>`: the source is 1006x1009, so this
 * needs the optimizer to serve something the size it is actually drawn at.
 */
export function MarketingBrand() {
  return (
    <Link className="brand" href="/">
      <Image className="brand-mark" src={logo} alt="" width={32} height={32} />
      <span className="brand-name">DevSquirrel</span>
    </Link>
  );
}
