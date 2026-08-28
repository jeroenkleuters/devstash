import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const shortDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
})

/** "Jan 15" — used on item cards. */
export function formatShortDate(date: Date | string) {
  return shortDate.format(new Date(date))
}

const MS_PER_DAY = 86_400_000

/** Past this, a day count says less than the date itself. */
const RELATIVE_DAYS = 7

/**
 * "Today" / "Yesterday" / "5 days ago", falling back to `formatShortDate` once
 * a count of days stops being easier to read than the date.
 *
 * Days are counted between UTC calendar dates rather than by dividing an
 * elapsed duration, so a row an hour either side of midnight does not read as
 * "Today" to one viewer and "Yesterday" to the next — the same reason
 * `formatShortDate` pins its time zone. A date in the future is "Today": it
 * only happens through clock skew, and counting backwards would be worse.
 *
 * `now` is a parameter so the boundaries can be tested without moving the
 * clock.
 */
export function formatRelativeDate(date: Date | string, now: Date = new Date()) {
  const days = Math.round((utcDay(now) - utcDay(new Date(date))) / MS_PER_DAY)

  if (days <= 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < RELATIVE_DAYS) return `${days} days ago`

  return formatShortDate(date)
}

/** Midnight UTC on the date's own day, as a timestamp. */
function utcDay(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

const longDate = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
})

/** "January 15, 2026" — dates far enough back that the year matters. */
export function formatLongDate(date: Date | string) {
  return longDate.format(new Date(date))
}

const FILE_SIZE_UNITS = ["B", "KB", "MB", "GB", "TB"]

/**
 * "1.4 MB" — `Item.fileSize` is in bytes, which is not a size anyone reads.
 *
 * Steps in units of 1024 and stops at the largest unit it has a name for, so an
 * absurd value degrades to a large number of TB rather than an empty unit.
 * Bytes never take a decimal: "1.0 B" says less than "1 B".
 */
export function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "—"

  let size = bytes
  let unit = 0

  while (size >= 1024 && unit < FILE_SIZE_UNITS.length - 1) {
    size /= 1024
    unit += 1
  }

  const rounded = unit === 0 ? Math.round(size) : Math.round(size * 10) / 10

  return `${rounded} ${FILE_SIZE_UNITS[unit]}`
}
