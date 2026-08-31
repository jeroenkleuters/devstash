/**
 * The geometry behind the image lightbox.
 *
 * Pure functions rather than state inside the component, because
 * `vitest.config.mts` collects only `src/lib/**` and `src/actions/**` — the
 * clamping is the part with rules worth pinning, and it can only be asserted
 * from here. The component owns the pointer events and the transform string.
 *
 * The model throughout: the image is laid out fitted to the stage (`contain`,
 * never upscaled), and zoom/pan is a `translate(offset) scale(zoom)` on top of
 * that, about the element's centre.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

/** Fit — the image as the stage lays it out before any zoom is applied. */
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 5;
/** What one press of the zoom buttons moves. */
export const ZOOM_STEP = 0.5;
/** Where a double click lands when the image is sitting at fit. */
export const DOUBLE_CLICK_ZOOM = 2;

export const ORIGIN: Point = { x: 0, y: 0 };

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) {
    return MIN_ZOOM;
  }

  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/**
 * The size the stage actually draws the image at, before zoom.
 *
 * Capped at 1 so a small image is shown at its own size rather than blown up to
 * fill the viewport — which is `max-width: 100%; max-height: 100%` in CSS, and
 * has to be mirrored here because the pan bounds are measured against it.
 */
export function containSize(natural: Size, viewport: Size): Size {
  if (
    natural.width <= 0 ||
    natural.height <= 0 ||
    viewport.width <= 0 ||
    viewport.height <= 0
  ) {
    return { width: 0, height: 0 };
  }

  const ratio = Math.min(
    viewport.width / natural.width,
    viewport.height / natural.height,
    1,
  );

  return { width: natural.width * ratio, height: natural.height * ratio };
}

/**
 * A wheel notch, as a multiplier rather than a fixed step: the same gesture
 * then covers the same proportion of the range wherever it starts, so zooming
 * in does not crawl at 1x and leap at 4x.
 */
export function zoomByWheel(zoom: number, deltaY: number): number {
  if (!Number.isFinite(deltaY)) {
    return clampZoom(zoom);
  }

  return clampZoom(zoom * Math.exp(-deltaY * 0.0015));
}

/**
 * How far the image may be dragged at this zoom, per axis.
 *
 * Zero once the scaled image fits inside the stage, which is what keeps a
 * fitted image pinned to the centre instead of being dragged off into a corner.
 */
export function panBounds(fitted: Size, zoom: number, viewport: Size): Point {
  return {
    x: Math.max(0, (fitted.width * zoom - viewport.width) / 2),
    y: Math.max(0, (fitted.height * zoom - viewport.height) / 2),
  };
}

export function clampOffset(
  offset: Point,
  fitted: Size,
  zoom: number,
  viewport: Size,
): Point {
  const bounds = panBounds(fitted, zoom, viewport);

  // The `+ 0` turns a negative zero back into zero: clamping a negative offset
  // against a bound of zero produces `-0`, which is harmless in a transform but
  // surprising anywhere the offset is compared.
  return {
    x: Math.min(bounds.x, Math.max(-bounds.x, offset.x)) + 0,
    y: Math.min(bounds.y, Math.max(-bounds.y, offset.y)) + 0,
  };
}

/**
 * The offset that keeps whatever sits under `pointer` under it after the zoom
 * changes — the difference between zooming into what you are looking at and
 * zooming into the middle of the picture.
 *
 * `pointer` is relative to the centre of the stage, matching the transform
 * origin. A point p on screen is `centre + offset + content * zoom`, so holding
 * p still across a zoom change gives
 * `offset' = p - (p - offset) * (next / current)`.
 */
export function offsetForZoom(
  offset: Point,
  current: number,
  next: number,
  pointer: Point,
): Point {
  if (current <= 0) {
    return offset;
  }

  const ratio = next / current;

  return {
    x: pointer.x - (pointer.x - offset.x) * ratio,
    y: pointer.y - (pointer.y - offset.y) * ratio,
  };
}

/** Whether the image is large enough at this zoom to have anywhere to go. */
export function isPannable(fitted: Size, zoom: number, viewport: Size): boolean {
  const bounds = panBounds(fitted, zoom, viewport);

  return bounds.x > 0 || bounds.y > 0;
}

/** A rectangle in fractions of the whole image, 0 to 1 from its top left. */
export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Which part of the image the stage is currently showing, as fractions of the
 * whole — what the minimap draws its viewport box from.
 *
 * The whole rectangle when nothing is cropped, so a fitted image reads as "you
 * are seeing all of it" rather than as a box of some arbitrary size.
 */
export function viewportRect(
  offset: Point,
  fitted: Size,
  zoom: number,
  viewport: Size,
): Rect {
  if (fitted.width <= 0 || fitted.height <= 0 || zoom <= 0) {
    return { left: 0, top: 0, width: 1, height: 1 };
  }

  const width = Math.min(1, viewport.width / (fitted.width * zoom));
  const height = Math.min(1, viewport.height / (fitted.height * zoom));

  // The offset moves the image under a fixed stage, so the part on show moves
  // the other way — hence the sign.
  const centreX = 0.5 - offset.x / zoom / fitted.width;
  const centreY = 0.5 - offset.y / zoom / fitted.height;

  return {
    left: Math.min(1 - width, Math.max(0, centreX - width / 2)),
    top: Math.min(1 - height, Math.max(0, centreY - height / 2)),
    width,
    height,
  };
}

/**
 * The offset that puts `centre` — a point in the whole image, as fractions from
 * its top left — in the middle of the stage.
 *
 * The inverse of `viewportRect`, and what dragging the minimap needs: that
 * gesture names a place in the picture, where dragging the picture itself names
 * a distance to move it by. The result still wants `clampOffset`, since a point
 * near an edge cannot actually be centred.
 */
export function offsetForCentre(
  centre: Point,
  fitted: Size,
  zoom: number,
): Point {
  return {
    x: (0.5 - centre.x) * zoom * fitted.width,
    y: (0.5 - centre.y) * zoom * fitted.height,
  };
}
