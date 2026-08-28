"use client";

import { useEffect, useRef, type ReactNode, type Ref } from "react";

interface RevealProps {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "header" | "li" | "article";
  /** Item type slug, for the `[data-type]` color map in globals.css. */
  dataType?: string;
}

/**
 * Fades its children in when they first scroll into view.
 *
 * One observer per element rather than one shared one: the elements are spread
 * across the page and each unobserves itself after firing, so the observers do
 * not outlive the reveal. `data-visible` is what the CSS transitions on.
 *
 * Reduced motion — and any browser without IntersectionObserver — gets the
 * visible state immediately rather than content that never appears.
 */
export function Reveal({
  children,
  className,
  as: Tag = "div",
  dataType,
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches || !("IntersectionObserver" in window)) {
      el.dataset.visible = "true";
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          el.dataset.visible = "true";
          observer.disconnect(); // reveal once, not on every pass
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // `Tag` is a union of intrinsic elements, so TS cannot prove one HTMLElement
  // ref satisfies whichever is chosen. The effect only touches `dataset`,
  // which every one of them has.
  return (
    <Tag
      ref={ref as Ref<never>}
      className={className ? `reveal ${className}` : "reveal"}
      data-type={dataType}
    >
      {children}
    </Tag>
  );
}
