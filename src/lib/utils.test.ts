import { describe, expect, it } from "vitest";

import { cn, formatLongDate, formatShortDate } from "@/lib/utils";

describe("cn", () => {
  it("keeps the last of two conflicting Tailwind utilities", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("drops falsy values instead of rendering them", () => {
    expect(cn("flex", false && "hidden", undefined, "gap-2")).toBe("flex gap-2");
  });
});

describe("formatShortDate", () => {
  it("formats a Date as month and day", () => {
    expect(formatShortDate(new Date("2026-01-15T12:00:00Z"))).toBe("Jan 15");
  });

  it("accepts an ISO string as well as a Date", () => {
    expect(formatShortDate("2026-08-14T09:30:00Z")).toBe("Aug 14");
  });

  /**
   * The formatter pins `timeZone: "UTC"`. Without it a late-evening UTC
   * timestamp would render as the next day for anyone east of it and the
   * previous day for anyone west, so the same item card would carry different
   * dates for different readers.
   */
  it("does not shift the day for a timestamp near midnight UTC", () => {
    expect(formatShortDate("2026-01-15T23:59:00Z")).toBe("Jan 15");
    expect(formatShortDate("2026-01-15T00:01:00Z")).toBe("Jan 15");
  });
});

describe("formatLongDate", () => {
  it("spells the month out and carries the year", () => {
    expect(formatLongDate(new Date("2026-08-14T12:00:00Z"))).toBe(
      "August 14, 2026",
    );
  });

  it("pins UTC the way the short formatter does", () => {
    expect(formatLongDate("2026-12-31T23:59:00Z")).toBe("December 31, 2026");
  });
});
