import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { pageLinks } from "@/lib/pagination";

interface PaginationProps {
  /** The page being shown. Always a real page — the route 404s otherwise. */
  page: number;
  totalPages: number;
  /**
   * The path the links point at; the number is added as `?page=n`. A string
   * rather than a builder, since every listing paginates the same way.
   */
  basePath: string;
}

/**
 * The numbered strip plus prev/next, under a paginated listing.
 *
 * A step with nowhere to go renders as a `span` rather than a link, so it is
 * greyed out and cannot be clicked or tabbed to — an anchor with no `href`
 * would leave the label announced as a link that does nothing.
 */
export function Pagination({ page, totalPages, basePath }: PaginationProps) {
  // One page is not a pagination.
  if (totalPages <= 1) {
    return null;
  }

  // Page 1 is the bare path, so the first page has one URL rather than two.
  const hrefFor = (target: number) =>
    target === 1 ? basePath : `${basePath}?page=${target}`;

  const previous = page - 1;
  const next = page + 1;

  return (
    <nav className="pagination" aria-label="Pagination">
      {previous >= 1 ? (
        <Link className="pagination-step" href={hrefFor(previous)} rel="prev">
          <ChevronLeft size={16} aria-hidden />
          <span className="action-label">Previous</span>
        </Link>
      ) : (
        <span className="pagination-step" data-disabled aria-disabled="true">
          <ChevronLeft size={16} aria-hidden />
          <span className="action-label">Previous</span>
        </span>
      )}

      <ul className="pagination-pages">
        {pageLinks(page, totalPages).map((link, index) =>
          link === "ellipsis" ? (
            // Positional key: a strip can hold two gaps, and neither is a page.
            <li key={`gap-${index}`} className="pagination-gap" aria-hidden>
              &hellip;
            </li>
          ) : (
            <li key={link}>
              {link === page ? (
                <span className="pagination-page" data-current aria-current="page">
                  {link}
                </span>
              ) : (
                <Link className="pagination-page" href={hrefFor(link)}>
                  {link}
                </Link>
              )}
            </li>
          ),
        )}
      </ul>

      {next <= totalPages ? (
        <Link className="pagination-step" href={hrefFor(next)} rel="next">
          <span className="action-label">Next</span>
          <ChevronRight size={16} aria-hidden />
        </Link>
      ) : (
        <span className="pagination-step" data-disabled aria-disabled="true">
          <span className="action-label">Next</span>
          <ChevronRight size={16} aria-hidden />
        </span>
      )}
    </nav>
  );
}
