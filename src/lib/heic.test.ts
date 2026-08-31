import { describe, expect, it } from "vitest";

import { isHeicFile, jpegName } from "@/lib/heic";

describe("isHeicFile", () => {
  it("recognises the reported type", () => {
    expect(isHeicFile({ name: "photo", type: "image/heic" })).toBe(true);
    expect(isHeicFile({ name: "photo", type: "image/heif" })).toBe(true);
  });

  it("recognises a burst, which the camera reports as a sequence", () => {
    expect(isHeicFile({ name: "photo", type: "image/heic-sequence" })).toBe(
      true,
    );
  });

  it("recognises the extension when the type says nothing", () => {
    // The case that matters most: Android hands a HEIC over with an empty type
    // or as `application/octet-stream` often enough that trusting the type
    // alone would let the original through to be refused by validation.
    expect(isHeicFile({ name: "IMG_0042.HEIC", type: "" })).toBe(true);
    expect(
      isHeicFile({ name: "IMG_0042.heic", type: "application/octet-stream" }),
    ).toBe(true);
  });

  it("is case insensitive about the reported type", () => {
    expect(isHeicFile({ name: "photo", type: "IMAGE/HEIC" })).toBe(true);
  });

  it("leaves every storable image alone", () => {
    expect(isHeicFile({ name: "a.jpg", type: "image/jpeg" })).toBe(false);
    expect(isHeicFile({ name: "a.png", type: "image/png" })).toBe(false);
    expect(isHeicFile({ name: "a.webp", type: "image/webp" })).toBe(false);
  });

  it("is not fooled by a name that merely contains heic", () => {
    expect(isHeicFile({ name: "theichnography.png", type: "image/png" })).toBe(
      false,
    );
  });
});

describe("jpegName", () => {
  it("swaps the extension", () => {
    expect(jpegName("IMG_0042.HEIC")).toBe("IMG_0042.jpg");
  });

  it("replaces only the last extension", () => {
    expect(jpegName("holiday.2026.heic")).toBe("holiday.2026.jpg");
  });

  it("adds one to a name that has none", () => {
    expect(jpegName("photo")).toBe("photo.jpg");
  });

  it("keeps a leading dot as the name rather than an extension", () => {
    // `fileExtension` reads a dotfile the same way, and the two have to agree.
    expect(jpegName(".heic")).toBe(".heic.jpg");
  });

  it("falls back rather than producing a nameless file", () => {
    expect(jpegName(".jpg")).toBe(".jpg.jpg");
    expect(jpegName("   .heic")).toBe("photo.jpg");
    expect(jpegName("")).toBe("photo.jpg");
  });
});
