/**
 * How many rows a listing shows at once.
 *
 * The paginated pages read these directly in `lib/db/`, so a page size is
 * stated once rather than travelling as an argument from every call site.
 */

/** `/items/[type]` and a collection's own page. */
export const ITEMS_PER_PAGE = 21;

/** `/collections`. */
export const COLLECTIONS_PER_PAGE = 21;

/**
 * The dashboard is not paginated — it shows a taste of each list and links to
 * the page that shows the rest, so its limits are their own numbers.
 */
export const DASHBOARD_COLLECTIONS_LIMIT = 6;
export const DASHBOARD_RECENT_ITEMS_LIMIT = 10;
