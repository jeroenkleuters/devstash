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
