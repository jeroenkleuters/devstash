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
