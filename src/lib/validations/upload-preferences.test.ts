import { describe, expect, it } from "vitest";

import {
  DEFAULT_UPLOAD_PREFERENCES,
  parseUploadPreferences,
  UPLOAD_COUNTS,
  UPLOAD_WINDOWS,
  uploadPreferencesSchema,
  uploadWindowLabel,
} from "@/lib/validations/upload-preferences";

describe("DEFAULT_UPLOAD_PREFERENCES", () => {
  it("is the limit the upload route applied before this was configurable", () => {
    // Pinned rather than derived: an account that changes nothing must be
    // limited exactly as it was, so a change to these numbers should have to
    // be a deliberate one.
    expect(DEFAULT_UPLOAD_PREFERENCES).toEqual({
      limit: 30,
      windowMs: 15 * 60 * 1000,
    });
  });

  it("is itself one of the offered choices", () => {
    // Or the card would open on a value its own dropdown cannot show.
    expect(UPLOAD_COUNTS).toContain(DEFAULT_UPLOAD_PREFERENCES.limit);
    expect(UPLOAD_WINDOWS).toContain(DEFAULT_UPLOAD_PREFERENCES.windowMs);
  });
});

describe("uploadPreferencesSchema", () => {
  it("accepts every count the card offers", () => {
    for (const limit of UPLOAD_COUNTS) {
      const parsed = uploadPreferencesSchema.safeParse({
        limit,
        windowMs: DEFAULT_UPLOAD_PREFERENCES.windowMs,
      });

      expect(parsed.success).toBe(true);
    }
  });

  it("accepts every window the card offers", () => {
    for (const windowMs of UPLOAD_WINDOWS) {
      const parsed = uploadPreferencesSchema.safeParse({
        limit: DEFAULT_UPLOAD_PREFERENCES.limit,
        windowMs,
      });

      expect(parsed.success).toBe(true);
    }
  });

  it("refuses a count above the largest offered", () => {
    // This is the ceiling. A limit the card never offered is how an account
    // would talk its way out of the guard rather than configure it.
    const parsed = uploadPreferencesSchema.safeParse({
      limit: 100000,
      windowMs: DEFAULT_UPLOAD_PREFERENCES.windowMs,
    });

    expect(parsed.success).toBe(false);
  });

  it("refuses a count between two offered ones", () => {
    const parsed = uploadPreferencesSchema.safeParse({
      limit: 45,
      windowMs: DEFAULT_UPLOAD_PREFERENCES.windowMs,
    });

    expect(parsed.success).toBe(false);
  });

  it("refuses a window shorter than the shortest offered", () => {
    // The other half of the ceiling: a one-second window would make the count
    // meaningless however small it is.
    const parsed = uploadPreferencesSchema.safeParse({
      limit: DEFAULT_UPLOAD_PREFERENCES.limit,
      windowMs: 1000,
    });

    expect(parsed.success).toBe(false);
  });

  it("refuses a partial set", () => {
    // Strict on the way in: the card always holds both values, so a payload
    // carrying one was not sent by it.
    const parsed = uploadPreferencesSchema.safeParse({ limit: 60 });

    expect(parsed.success).toBe(false);
  });
});

describe("parseUploadPreferences", () => {
  it("reads a stored set back", () => {
    expect(parseUploadPreferences({ limit: 120, windowMs: 60 * 60 * 1000 })).toEqual(
      { limit: 120, windowMs: 60 * 60 * 1000 },
    );
  });

  it("falls back for a column that was never written", () => {
    expect(parseUploadPreferences(null)).toEqual(DEFAULT_UPLOAD_PREFERENCES);
  });

  it("falls back for a value that is not an object", () => {
    expect(parseUploadPreferences("60")).toEqual(DEFAULT_UPLOAD_PREFERENCES);
    expect(parseUploadPreferences([60])).toEqual(DEFAULT_UPLOAD_PREFERENCES);
  });

  it("refuses a stored count outside the offered set rather than clamping it", () => {
    // The important one. A row hand-edited to 100000 — or restored from a
    // version offering different numbers — must not raise the account's real
    // ceiling. It is not clamped to the largest offered count, it is refused,
    // because a number outside the set says the value did not come from here.
    expect(parseUploadPreferences({ limit: 100000, windowMs: 15 * 60 * 1000 })).toEqual(
      { limit: DEFAULT_UPLOAD_PREFERENCES.limit, windowMs: 15 * 60 * 1000 },
    );
  });

  it("costs one preference rather than both when one value is unreadable", () => {
    // Field by field: a readable window survives an unreadable count.
    expect(
      parseUploadPreferences({ limit: "lots", windowMs: 24 * 60 * 60 * 1000 }),
    ).toEqual({
      limit: DEFAULT_UPLOAD_PREFERENCES.limit,
      windowMs: 24 * 60 * 60 * 1000,
    });
  });

  it("fills in a preference the stored set does not carry", () => {
    expect(parseUploadPreferences({ limit: 60 })).toEqual({
      limit: 60,
      windowMs: DEFAULT_UPLOAD_PREFERENCES.windowMs,
    });
  });
});

describe("uploadWindowLabel", () => {
  it("names minutes below an hour", () => {
    expect(uploadWindowLabel(15 * 60 * 1000)).toBe("15 minutes");
  });

  it("names a single hour in the singular", () => {
    expect(uploadWindowLabel(60 * 60 * 1000)).toBe("1 hour");
  });

  it("names several hours in the plural", () => {
    expect(uploadWindowLabel(24 * 60 * 60 * 1000)).toBe("24 hours");
  });

  it("names every window the card offers", () => {
    for (const windowMs of UPLOAD_WINDOWS) {
      expect(uploadWindowLabel(windowMs)).not.toBe("");
    }
  });
});
