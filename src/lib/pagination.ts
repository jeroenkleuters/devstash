/**
 * The arithmetic behind the pagination controls. Pure — the queries live in
 * `lib/db/`, and the page number itself always comes from the URL.
 */

/** One entry in the numbered strip. A gap is a rendered "…", not a link. */
export type PageLink = number | "ellipsis";

/** How many neighbours of the current page keep their own link. */
const SIBLING_COUNT = 1;

/**
 * The `?page=` value as a page number, or `null` when it names no page.
 *
 * An absent parameter is page 1. Anything else has to be a whole number of at
 * least 1 — a repeated parameter (which arrives as an array), a decimal, a
 * negative, a zero or a word all come back null, which the pages turn into a
 * 404 rather than quietly showing the first page.
 */
export function parsePageParam(
  value: string | string[] | undefined,
): number | null {
  if (value === undefined) {
    return 1;
  }

  // `?page=1&page=2` — there is no single page being asked for.
  if (Array.isArray(value)) {
    return null;
  }

  // `Number` would accept "1e3", " 2 " and "0x2"; the digits rule does not.
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const page = Number(value);

  return Number.isSafeInteger(page) && page >= 1 ? page : null;
}

/**
 * How many pages a total spans. Always at least 1, so an empty listing is a
 * first page that exists rather than a page 0 nobody can link to.
 */
export function pageCount(totalCount: number, perPage: number): number {
  if (totalCount <= 0) {
    return 1;
  }

  return Math.ceil(totalCount / perPage);
}

/**
 * How many rows a given page actually holds — what the skeleton needs, since
 * the last page is usually short.
 */
export function rowsOnPage(
  totalCount: number,
  page: number,
  perPage: number,
): number {
  const remaining = totalCount - (page - 1) * perPage;

  return Math.min(perPage, Math.max(0, remaining));
}

/** How many rows to skip to reach the start of a page. */
export function pageOffset(page: number, perPage: number): number {
  return (page - 1) * perPage;
}

/**
 * The numbered strip: the first and last pages always, the current page and its
 * neighbours, and an ellipsis wherever that leaves a gap. Without the window a
 * large stash would render a hundred links.
 */
export function pageLinks(page: number, totalPages: number): PageLink[] {
  const shown = new Set<number>([1, totalPages]);

  for (let near = page - SIBLING_COUNT; near <= page + SIBLING_COUNT; near++) {
    if (near >= 1 && near <= totalPages) {
      shown.add(near);
    }
  }

  const links: PageLink[] = [];
  let previous = 0;

  for (const current of [...shown].sort((a, b) => a - b)) {
    if (previous > 0 && current - previous > 1) {
      links.push("ellipsis");
    }

    links.push(current);
    previous = current;
  }

  return links;
}
