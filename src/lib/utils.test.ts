import { describe, expect, it } from "vitest";

import {
  cn,
  formatFileSize,
  formatLongDate,
  formatShortDate,
} from "@/lib/utils";

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

describe("formatFileSize", () => {
  it("leaves bytes whole", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(512)).toBe("512 B");
  });

  /** 1024, not 1000 — the unit names are binary ones. */
  it("steps up a unit at 1024, not at 1000", () => {
    expect(formatFileSize(1000)).toBe("1000 B");
    expect(formatFileSize(1024)).toBe("1 KB");
  });

  it("gives one decimal place above bytes", () => {
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(1_500_000)).toBe("1.4 MB");
  });

  /**
   * The loop stops at the largest unit it has a name for, so an absurd value
   * degrades to a very large number of TB rather than an empty unit.
   */
  it("does not run past the last named unit", () => {
    expect(formatFileSize(1024 ** 5)).toBe("1024 TB");
  });

  it("refuses a negative or non-finite size rather than inventing one", () => {
    expect(formatFileSize(-1)).toBe("—");
    expect(formatFileSize(Number.NaN)).toBe("—");
  });
});
