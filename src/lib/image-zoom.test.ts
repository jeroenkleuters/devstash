import { describe, expect, it } from "vitest";

import {
  clampOffset,
  clampZoom,
  containSize,
  isPannable,
  MAX_ZOOM,
  MIN_ZOOM,
  offsetForCentre,
  offsetForZoom,
  ORIGIN,
  panBounds,
  viewportRect,
  zoomByWheel,
} from "@/lib/image-zoom";

const VIEWPORT = { width: 1000, height: 800 };

describe("clampZoom", () => {
  it("keeps a zoom inside the range", () => {
    expect(clampZoom(2.5)).toBe(2.5);
  });

  it("refuses to go below fit", () => {
    expect(clampZoom(0.2)).toBe(MIN_ZOOM);
  });

  it("stops at the ceiling", () => {
    expect(clampZoom(50)).toBe(MAX_ZOOM);
  });

  it("falls back to fit for a value that is not a number", () => {
    expect(clampZoom(Number.NaN)).toBe(MIN_ZOOM);
  });
});

describe("containSize", () => {
  it("fits a wide image to the width", () => {
    expect(containSize({ width: 2000, height: 1000 }, VIEWPORT)).toEqual({
      width: 1000,
      height: 500,
    });
  });

  it("fits a tall image to the height", () => {
    expect(containSize({ width: 1000, height: 2000 }, VIEWPORT)).toEqual({
      width: 400,
      height: 800,
    });
  });

  it("leaves an image smaller than the stage at its own size", () => {
    // The cap at 1 — a 40x30 icon should not be blown up to fill the screen.
    expect(containSize({ width: 40, height: 30 }, VIEWPORT)).toEqual({
      width: 40,
      height: 30,
    });
  });

  it("has no size for an image whose own size is not known yet", () => {
    expect(containSize({ width: 0, height: 0 }, VIEWPORT)).toEqual({
      width: 0,
      height: 0,
    });
  });
});

describe("zoomByWheel", () => {
  it("zooms in when the wheel is scrolled up", () => {
    expect(zoomByWheel(2, -100)).toBeGreaterThan(2);
  });

  it("zooms out when the wheel is scrolled down", () => {
    expect(zoomByWheel(2, 100)).toBeLessThan(2);
  });

  it("covers the same proportion wherever it starts", () => {
    // Multiplicative, not a fixed step: the same notch is the same ratio at 1x
    // as at 4x, so zooming in neither crawls nor leaps.
    expect(zoomByWheel(1, -100) / 1).toBeCloseTo(zoomByWheel(2, -100) / 2, 10);
  });

  it("clamps at both ends", () => {
    expect(zoomByWheel(MIN_ZOOM, 5000)).toBe(MIN_ZOOM);
    expect(zoomByWheel(MAX_ZOOM, -5000)).toBe(MAX_ZOOM);
  });
});

describe("panBounds", () => {
  const fitted = { width: 1000, height: 800 };

  it("gives a fitted image nowhere to go", () => {
    expect(panBounds(fitted, 1, VIEWPORT)).toEqual({ x: 0, y: 0 });
  });

  it("allows half the overhang in each direction", () => {
    // At 2x the image is 2000x1600 in a 1000x800 stage, so 500 of overflow
    // hangs off each side.
    expect(panBounds(fitted, 2, VIEWPORT)).toEqual({ x: 500, y: 400 });
  });

  it("has no bound on an axis that still fits", () => {
    // A wide, short image zoomed enough to overflow horizontally but not
    // vertically may be dragged sideways only.
    expect(panBounds({ width: 1000, height: 200 }, 2, VIEWPORT)).toEqual({
      x: 500,
      y: 0,
    });
  });
});

describe("clampOffset", () => {
  const fitted = { width: 1000, height: 800 };

  it("pins a fitted image to the centre", () => {
    expect(clampOffset({ x: 300, y: -200 }, fitted, 1, VIEWPORT)).toEqual({
      x: 0,
      y: 0,
    });
  });

  it("leaves an offset that is within the bounds alone", () => {
    expect(clampOffset({ x: 120, y: -80 }, fitted, 2, VIEWPORT)).toEqual({
      x: 120,
      y: -80,
    });
  });

  it("stops the image being dragged past its edge", () => {
    expect(clampOffset({ x: 9000, y: -9000 }, fitted, 2, VIEWPORT)).toEqual({
      x: 500,
      y: -400,
    });
  });
});

describe("offsetForZoom", () => {
  it("keeps the centre still when the pointer is the centre", () => {
    expect(offsetForZoom({ x: 0, y: 0 }, 1, 2, { x: 0, y: 0 })).toEqual({
      x: 0,
      y: 0,
    });
  });

  it("keeps the point under the pointer under it", () => {
    // Doubling about a point 100px right of centre pushes that content 100px
    // further right, so the offset moves back by the same amount.
    expect(offsetForZoom({ x: 0, y: 0 }, 1, 2, { x: 100, y: 50 })).toEqual({
      x: -100,
      y: -50,
    });
  });

  it("undoes itself when the zoom is reversed", () => {
    const pointer = { x: 137, y: -42 };
    const zoomed = offsetForZoom({ x: 10, y: 20 }, 1, 3, pointer);
    const back = offsetForZoom(zoomed, 3, 1, pointer);

    expect(back.x).toBeCloseTo(10, 10);
    expect(back.y).toBeCloseTo(20, 10);
  });

  it("leaves the offset alone rather than dividing by a zero zoom", () => {
    expect(offsetForZoom({ x: 5, y: 5 }, 0, 2, { x: 1, y: 1 })).toEqual({
      x: 5,
      y: 5,
    });
  });
});

describe("isPannable", () => {
  it("is false at fit", () => {
    expect(isPannable({ width: 1000, height: 800 }, 1, VIEWPORT)).toBe(false);
  });

  it("is true once either axis overflows", () => {
    expect(isPannable({ width: 1000, height: 200 }, 2, VIEWPORT)).toBe(true);
  });
});

describe("viewportRect", () => {
  const fitted = { width: 1000, height: 800 };

  it("covers the whole image when nothing is cropped", () => {
    expect(viewportRect(ORIGIN, fitted, 1, VIEWPORT)).toEqual({
      left: 0,
      top: 0,
      width: 1,
      height: 1,
    });
  });

  it("covers half of each axis at 2x, centred", () => {
    expect(viewportRect(ORIGIN, fitted, 2, VIEWPORT)).toEqual({
      left: 0.25,
      top: 0.25,
      width: 0.5,
      height: 0.5,
    });
  });

  it("moves the box the opposite way to the image", () => {
    // Dragging the image right shows what was off its left edge, so the box
    // travels left. Getting this sign wrong is a minimap that lies.
    const rect = viewportRect({ x: 200, y: 0 }, fitted, 2, VIEWPORT);

    expect(rect.left).toBeLessThan(0.25);
    expect(rect.top).toBe(0.25);
  });

  it("keeps the box inside the image at the edges", () => {
    const rect = viewportRect({ x: -9000, y: 9000 }, fitted, 2, VIEWPORT);

    expect(rect.left).toBe(0.5);
    expect(rect.top).toBe(0);
  });

  it("covers everything while the image size is still unknown", () => {
    expect(viewportRect(ORIGIN, { width: 0, height: 0 }, 1, VIEWPORT)).toEqual({
      left: 0,
      top: 0,
      width: 1,
      height: 1,
    });
  });
});

describe("offsetForCentre", () => {
  const fitted = { width: 1000, height: 800 };

  it("puts the middle of the image in the middle of the stage", () => {
    expect(offsetForCentre({ x: 0.5, y: 0.5 }, fitted, 2)).toEqual(ORIGIN);
  });

  it("moves the image the opposite way to the point being centred", () => {
    // Asking for a point below the middle brings it up into view, so the image
    // moves up: a negative y.
    expect(offsetForCentre({ x: 0.5, y: 0.75 }, fitted, 2).y).toBeLessThan(0);
  });

  it("undoes viewportRect", () => {
    // The round trip is the rule that matters: the box the minimap draws and
    // the offset dragging it produces have to describe the same place, or the
    // picture jumps away from the box on the first press.
    const offset = { x: -180, y: 260 };
    const zoom = 2.5;
    const rect = viewportRect(offset, fitted, zoom, VIEWPORT);
    const back = offsetForCentre(
      { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
      fitted,
      zoom,
    );

    expect(back.x).toBeCloseTo(offset.x, 8);
    expect(back.y).toBeCloseTo(offset.y, 8);
  });
});
