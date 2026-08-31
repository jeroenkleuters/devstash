"use client";

import { Maximize, Minus, Plus, X, ZoomIn } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  clampOffset,
  clampZoom,
  containSize,
  DOUBLE_CLICK_ZOOM,
  isPannable,
  MAX_ZOOM,
  MIN_ZOOM,
  offsetForCentre,
  offsetForZoom,
  ORIGIN,
  type Point,
  type Size,
  viewportRect,
  ZOOM_STEP,
  zoomByWheel,
} from "@/lib/image-zoom";

interface ImageLightboxProps {
  /** Same source the thumbnail uses — the route serves the original either way. */
  src: string;
  alt: string;
  /** Names the open image in the toolbar, and labels the dialog for Radix. */
  title: string;
  /** The class the thumbnail already had, so its frame is unchanged. */
  imageClassName?: string;
}

/**
 * An image, and the popup it opens into.
 *
 * One component owns both ends because they are one piece of state: the
 * thumbnail is the trigger, and the stage inside is only mounted while the
 * dialog is open — Radix unmounts `DialogContent` on close, so the zoom and the
 * pan reset themselves and reopening always starts at fit.
 *
 * Controlled rather than left to Radix, because clicking past the picture has
 * to close it: the content fills the viewport, so what reads as the backdrop is
 * the content itself and Radix's own outside-click never fires.
 */
export function ImageLightbox({
  src,
  alt,
  title,
  imageClassName,
}: ImageLightboxProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="image-lightbox-trigger"
          aria-label={`Open ${title} full size`}
        >
          {/* `next/image` cannot serve this: its optimizer fetches the source
              server-side without the visitor's cookies, and the route answers
              401 without a session. There is nothing to optimize either — the
              response is per-account and uncacheable. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={imageClassName} src={src} alt={alt} />
          <span className="image-lightbox-hint" aria-hidden>
            <ZoomIn size={16} />
          </span>
        </button>
      </DialogTrigger>

      {/* No `showCloseButton`: the toolbar carries its own, and the primitive's
          would sit on top of it. `aria-describedby={undefined}` because there is
          nothing to describe the picture with beyond its title. */}
      <DialogContent
        className="image-lightbox"
        showCloseButton={false}
        aria-describedby={undefined}
      >
        <LightboxStage
          src={src}
          alt={alt}
          title={title}
          onClose={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

interface Gesture {
  /** Where the drag started, and what the offset was when it did. */
  pointer: Point;
  offset: Point;
  /** Set once the pointer has moved, so a drag is not also read as a click. */
  moved: boolean;
}

interface Pinch {
  distance: number;
  zoom: number;
}

function LightboxStage({
  src,
  alt,
  title,
  onClose,
}: {
  src: string;
  alt: string;
  title: string;
  onClose: () => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [offset, setOffset] = useState<Point>(ORIGIN);
  const [natural, setNatural] = useState<Size>({ width: 0, height: 0 });
  const [viewport, setViewport] = useState<Size>({ width: 0, height: 0 });
  const [dragging, setDragging] = useState(false);

  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture | null>(null);
  const pinch = useRef<Pinch | null>(null);

  const fitted = containSize(natural, viewport);
  const pannable = isPannable(fitted, zoom, viewport);

  // The stage is the frame the pan bounds are measured against, so it is
  // remeasured rather than assumed — an orientation change or a resize while
  // the popup is open would otherwise leave the image draggable off-screen.
  useEffect(() => {
    const stage = stageRef.current;

    if (!stage) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      const box = entry.contentRect;
      setViewport({ width: box.width, height: box.height });
    });

    observer.observe(stage);

    return () => observer.disconnect();
  }, []);

  /** The point, relative to the centre of the stage, an event happened at. */
  const stagePoint = useCallback(
    (event: { clientX: number; clientY: number }): Point => {
      const box = stageRef.current?.getBoundingClientRect();

      if (!box) {
        return ORIGIN;
      }

      return {
        x: event.clientX - (box.left + box.width / 2),
        y: event.clientY - (box.top + box.height / 2),
      };
    },
    [],
  );

  /**
   * Applies a new zoom about a point, and re-clamps the pan that follows.
   *
   * Both values are computed here and set separately, rather than one updater
   * calling the other: React is free to invoke an updater twice, which would
   * apply the zoom-about-a-point correction twice and throw the picture away
   * from the cursor it is supposed to be anchored to.
   */
  const zoomTo = useCallback(
    (next: number, pointer: Point) => {
      const target = clampZoom(next);

      setZoom(target);
      setOffset(
        clampOffset(
          offsetForZoom(offset, zoom, target, pointer),
          fitted,
          target,
          viewport,
        ),
      );
    },
    [fitted, offset, viewport, zoom],
  );

  // React attaches `wheel` at the root as a passive listener, so `onWheel`
  // cannot call `preventDefault` — and without it a ctrl-wheel zooms the whole
  // browser instead of the picture. Hence the manual, non-passive listener.
  useEffect(() => {
    const stage = stageRef.current;

    if (!stage) {
      return;
    }

    function onWheel(event: WheelEvent) {
      event.preventDefault();
      zoomTo(zoomByWheel(zoom, event.deltaY), stagePoint(event));
    }

    stage.addEventListener("wheel", onWheel, { passive: false });

    return () => stage.removeEventListener("wheel", onWheel);
  }, [stagePoint, zoom, zoomTo]);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    // The click that ends a drag is what normally clears this; clearing here as
    // well covers a drag released outside the stage, whose click never lands.
    gesture.current = null;

    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom };
      setDragging(false);
      return;
    }

    if (!pannable) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = {
      pointer: { x: event.clientX, y: event.clientY },
      offset,
      moved: false,
    };
    setDragging(true);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) {
      return;
    }

    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    const active = pinch.current;

    if (active && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);

      if (active.distance > 0) {
        zoomTo(
          active.zoom * (distance / active.distance),
          stagePoint({
            clientX: (a.x + b.x) / 2,
            clientY: (a.y + b.y) / 2,
          }),
        );
      }

      return;
    }

    const drag = gesture.current;

    if (!drag) {
      return;
    }

    drag.moved = true;
    setOffset(
      clampOffset(
        {
          x: drag.offset.x + (event.clientX - drag.pointer.x),
          y: drag.offset.y + (event.clientY - drag.pointer.y),
        },
        fitted,
        zoom,
        viewport,
      ),
    );
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);

    if (pointers.current.size < 2) {
      pinch.current = null;
    }

    if (gesture.current) {
      // Left set until the click that follows has been seen, so releasing a
      // drag over the empty part of the stage does not dismiss the popup.
      setDragging(false);
    }
  }

  /** Clicking past the picture dismisses, the way a backdrop would. */
  function handleStageClick(event: React.MouseEvent<HTMLDivElement>) {
    const dragged = gesture.current?.moved ?? false;
    gesture.current = null;

    if (event.target === event.currentTarget && !dragged) {
      onClose();
    }
  }

  function handleDoubleClick(event: React.MouseEvent<HTMLDivElement>) {
    const zoomedIn = zoom > MIN_ZOOM;
    zoomTo(zoomedIn ? MIN_ZOOM : DOUBLE_CLICK_ZOOM, zoomedIn ? ORIGIN : stagePoint(event));
  }

  return (
    <>
      <div className="image-lightbox-bar">
        <DialogTitle className="image-lightbox-title">{title}</DialogTitle>

        <div className="image-lightbox-controls">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Zoom out"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => zoomTo(zoom - ZOOM_STEP, ORIGIN)}
          >
            <Minus />
          </Button>

          <span className="image-lightbox-level">{Math.round(zoom * 100)}%</span>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Zoom in"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => zoomTo(zoom + ZOOM_STEP, ORIGIN)}
          >
            <Plus />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Reset zoom"
            disabled={zoom === MIN_ZOOM}
            onClick={() => {
              setZoom(MIN_ZOOM);
              setOffset(ORIGIN);
            }}
          >
            <Maximize />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close"
            onClick={onClose}
          >
            <X />
          </Button>
        </div>
      </div>

      <div
        ref={stageRef}
        className="image-lightbox-stage"
        data-pannable={pannable}
        data-dragging={dragging}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleStageClick}
        onDoubleClick={handleDoubleClick}
      >
        {pannable && (
          <Minimap
            src={src}
            fitted={fitted}
            offset={offset}
            zoom={zoom}
            viewport={viewport}
            onCentre={(centre) =>
              setOffset(
                clampOffset(
                  offsetForCentre(centre, fitted, zoom),
                  fitted,
                  zoom,
                  viewport,
                ),
              )
            }
          />
        )}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="image-lightbox-image"
          src={src}
          alt={alt}
          draggable={false}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          }}
          onLoad={(event) =>
            setNatural({
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight,
            })
          }
        />
      </div>
    </>
  );
}

/**
 * The whole picture in miniature, with a box around the part on show — and a
 * second way to move it: press anywhere to bring that spot into view, or grab
 * the box and drag.
 *
 * Only rendered once there is something off-screen to be lost; at fit it would
 * be a picture of the picture, saying nothing.
 */
function Minimap({
  src,
  fitted,
  offset,
  zoom,
  viewport,
  onCentre,
}: {
  src: string;
  fitted: Size;
  offset: Point;
  zoom: number;
  viewport: Size;
  /** Where in the whole image to centre the stage, in fractions from its corner. */
  onCentre: (centre: Point) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  // What the press held onto: the distance from the box's centre to the point
  // grabbed, so a press inside it drags from there instead of snapping the box
  // out from under the pointer. Zero for a press outside, which does snap —
  // that press is a request to look somewhere else.
  const grab = useRef<Point>(ORIGIN);

  const rect = viewportRect(offset, fitted, zoom, viewport);

  /** Where in the image a pointer is, as fractions of the whole. */
  function fractionAt(event: React.PointerEvent): Point | null {
    const box = boxRef.current?.getBoundingClientRect();

    if (!box || box.width <= 0 || box.height <= 0) {
      return null;
    }

    return {
      x: (event.clientX - box.left) / box.width,
      y: (event.clientY - box.top) / box.height,
    };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    // The stage is this element's parent and pans on the same events, so
    // without this a drag here would move the picture twice over.
    event.stopPropagation();

    const point = fractionAt(event);

    if (!point) {
      return;
    }

    const centre = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const inside =
      point.x >= rect.left &&
      point.x <= rect.left + rect.width &&
      point.y >= rect.top &&
      point.y <= rect.top + rect.height;

    grab.current = inside
      ? { x: point.x - centre.x, y: point.y - centre.y }
      : ORIGIN;

    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    onCentre({ x: point.x - grab.current.x, y: point.y - grab.current.y });
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    event.stopPropagation();

    if (!dragging) {
      return;
    }

    const point = fractionAt(event);

    if (point) {
      onCentre({ x: point.x - grab.current.x, y: point.y - grab.current.y });
    }
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    setDragging(false);
  }

  return (
    <div
      ref={boxRef}
      className="image-lightbox-minimap"
      data-dragging={dragging}
      style={{ aspectRatio: `${fitted.width} / ${fitted.height}` }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      // The stage reads a click as a dismissal and a double click as a zoom;
      // neither is what a press in here meant.
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      {/* Out of the accessibility tree: it is a second route to a pan that is
          itself pointer-only, so it offers a screen reader nothing to act on.
          Keyboard panning is the thing that would actually close that gap. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" aria-hidden draggable={false} />

      <span
        className="image-lightbox-minimap-view"
        aria-hidden
        style={{
          left: `${rect.left * 100}%`,
          top: `${rect.top * 100}%`,
          width: `${rect.width * 100}%`,
          height: `${rect.height * 100}%`,
        }}
      />
    </div>
  );
}
