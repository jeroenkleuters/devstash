"use client";

import { Bookmark, FileText, PanelsTopLeft, Terminal } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import {
  GitHubBrandMark,
  NotionMark,
  SlackMark,
  VsCodeMark,
} from "@/components/marketing/brand-marks";

const SCATTERED: { key: string; label: string; icon: ReactNode }[] = [
  { key: "notion", label: "Notion", icon: <NotionMark /> },
  { key: "github", label: "GitHub", icon: <GitHubBrandMark /> },
  { key: "slack", label: "Slack", icon: <SlackMark /> },
  { key: "vscode", label: "VS Code", icon: <VsCodeMark /> },
  { key: "tabs", label: "Browser tabs", icon: <PanelsTopLeft className="icon" /> },
  { key: "terminal", label: "Terminal", icon: <Terminal className="icon" /> },
  { key: "file", label: "Text file", icon: <FileText className="icon" /> },
  { key: "bookmark", label: "Bookmark", icon: <Bookmark className="icon" /> },
];

const SPEED = 22; // px per second, roughly
// The cursor nudges the icons aside rather than scattering them: a short reach,
// a squared falloff so the force arrives gradually instead of snapping on at
// the edge of the radius, and a hard ceiling on the speed that results.
const REPEL_RADIUS = 115;
const REPEL_FORCE = 800;
const MAX_SPEED = SPEED * 3;
const DRAG = 0.985;
const ICON_SIZE = 60; // matches .chaos-icon in globals.css, used before layout

interface Particle {
  el: HTMLElement;
  size: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  phase: number;
  pulse: number;
}

export function ChaosField() {
  const fieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;

    const els = Array.from(
      field.querySelectorAll<HTMLElement>(".chaos-icon"),
    );
    if (els.length === 0) return;

    const bounds = { width: 0, height: 0 };
    const pointer = { x: -9999, y: -9999, active: false };

    const particles: Particle[] = els.map((el, index) => {
      const angle = (index / els.length) * Math.PI * 2 + Math.random();
      return {
        el,
        size: ICON_SIZE,
        x: 0,
        y: 0,
        vx: Math.cos(angle) * SPEED,
        vy: Math.sin(angle) * SPEED,
        rot: (Math.random() - 0.5) * 24,
        vrot: (Math.random() - 0.5) * 14,
        // Each icon pulses on its own phase, so they never breathe in unison.
        phase: Math.random() * Math.PI * 2,
        pulse: 0.8 + Math.random() * 0.5,
      };
    });

    const draw = (p: Particle, scale: number) => {
      p.el.style.transform =
        `translate3d(${p.x.toFixed(2)}px,${p.y.toFixed(2)}px,0)` +
        ` rotate(${p.rot.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
    };

    const measure = () => {
      const rect = field.getBoundingClientRect();
      bounds.width = rect.width;
      bounds.height = rect.height;

      for (const p of particles) {
        p.size = p.el.offsetWidth || ICON_SIZE;
        // Keep everything inside after a resize rather than letting it drift out.
        p.x = Math.min(Math.max(p.x, 0), Math.max(bounds.width - p.size, 0));
        p.y = Math.min(Math.max(p.y, 0), Math.max(bounds.height - p.size, 0));
      }
    };

    const scatter = () => {
      // A loose grid, then jittered — a purely random scatter clumps.
      const columns = Math.ceil(Math.sqrt(particles.length));
      const rows = Math.ceil(particles.length / columns);

      particles.forEach((p, index) => {
        const cellW = bounds.width / columns;
        const cellH = bounds.height / rows;
        p.x =
          (index % columns) * cellW + (cellW - p.size) * (0.15 + Math.random() * 0.7);
        p.y =
          Math.floor(index / columns) * cellH +
          (cellH - p.size) * (0.15 + Math.random() * 0.7);
        p.x = Math.min(Math.max(p.x, 0), Math.max(bounds.width - p.size, 0));
        p.y = Math.min(Math.max(p.y, 0), Math.max(bounds.height - p.size, 0));
      });
    };

    measure();
    scatter();
    for (const p of particles) draw(p, 1);

    window.addEventListener("resize", measure);

    // Reduced motion gets the scattered layout and nothing else.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return () => window.removeEventListener("resize", measure);
    }

    const onMove = (event: PointerEvent) => {
      const rect = field.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.active = true;
    };
    const onLeave = () => {
      pointer.active = false;
    };
    field.addEventListener("pointermove", onMove);
    field.addEventListener("pointerleave", onLeave);

    let frame = 0;
    let last = 0;
    let running = false;

    const step = (now: number) => {
      if (!last) last = now;
      // Clamp the delta so a backgrounded tab does not resume with one huge jump.
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      for (const p of particles) {
        const half = p.size / 2;

        if (pointer.active) {
          const dx = p.x + half - pointer.x;
          const dy = p.y + half - pointer.y;
          const dist = Math.hypot(dx, dy);
          if (dist < REPEL_RADIUS && dist > 0.01) {
            const falloff = 1 - dist / REPEL_RADIUS;
            const strength = falloff * falloff * REPEL_FORCE;
            p.vx += (dx / dist) * strength * dt;
            p.vy += (dy / dist) * strength * dt;
          }
        }

        p.vx *= DRAG;
        p.vy *= DRAG;

        // Drift never dies out entirely, and never runs away either.
        const speed = Math.hypot(p.vx, p.vy);
        if (speed < SPEED * 0.5 && speed > 0.01) {
          p.vx *= 1.02;
          p.vy *= 1.02;
        } else if (speed > MAX_SPEED) {
          // Scale straight back onto the ceiling rather than easing toward it,
          // so no single frame can carry an icon across the field.
          p.vx *= MAX_SPEED / speed;
          p.vy *= MAX_SPEED / speed;
        }

        p.x += p.vx * dt;
        p.y += p.vy * dt;

        const maxX = Math.max(bounds.width - p.size, 0);
        const maxY = Math.max(bounds.height - p.size, 0);

        if (p.x <= 0) {
          p.x = 0;
          p.vx = Math.abs(p.vx);
        } else if (p.x >= maxX) {
          p.x = maxX;
          p.vx = -Math.abs(p.vx);
        }

        if (p.y <= 0) {
          p.y = 0;
          p.vy = Math.abs(p.vy);
        } else if (p.y >= maxY) {
          p.y = maxY;
          p.vy = -Math.abs(p.vy);
        }

        p.rot += p.vrot * dt;
        if (p.rot > 18) p.vrot = -Math.abs(p.vrot);
        if (p.rot < -18) p.vrot = Math.abs(p.vrot);

        p.phase += dt * p.pulse;
        draw(p, 1 + Math.sin(p.phase) * 0.06);
      }

      if (running) frame = window.requestAnimationFrame(step);
    };

    const start = () => {
      if (running) return;
      running = true;
      last = 0;
      frame = window.requestAnimationFrame(step);
    };
    const stop = () => {
      running = false;
      window.cancelAnimationFrame(frame);
    };

    // Nothing to animate while the field is off-screen or the tab is hidden.
    const visibility = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting && !document.hidden ? start() : stop()),
      { threshold: 0 },
    );
    visibility.observe(field);

    const onVisibility = () => {
      if (document.hidden) stop();
      else if (field.getBoundingClientRect().bottom > 0) start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      visibility.disconnect();
      window.removeEventListener("resize", measure);
      document.removeEventListener("visibilitychange", onVisibility);
      field.removeEventListener("pointermove", onMove);
      field.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div className="chaos-field" ref={fieldRef}>
      {SCATTERED.map((entry) => (
        <span
          key={entry.key}
          className="chaos-icon"
          data-icon={entry.key}
          title={entry.label}
        >
          {entry.icon}
        </span>
      ))}
    </div>
  );
}
