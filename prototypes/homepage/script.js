/* DevStash homepage mockup — chaos animation, scroll reveal, nav state,
   billing toggle, footer year. No dependencies; the page opens from disk. */

(function () {
  "use strict";

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------- Footer year ---------- */

  var yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  /* ---------- Nav opacity on scroll ---------- */

  var nav = document.getElementById("nav");
  if (nav) {
    var syncNav = function () {
      nav.dataset.scrolled = window.scrollY > 16 ? "true" : "false";
    };
    syncNav();
    window.addEventListener("scroll", syncNav, { passive: true });
  }

  /* ---------- Scroll reveal ---------- */

  var revealables = document.querySelectorAll(".reveal");

  if (reducedMotion.matches || !("IntersectionObserver" in window)) {
    revealables.forEach(function (el) {
      el.dataset.visible = "true";
    });
  } else {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.dataset.visible = "true";
          revealObserver.unobserve(entry.target); // reveal once, not on every pass
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    revealables.forEach(function (el) {
      revealObserver.observe(el);
    });
  }

  /* ---------- Billing toggle ---------- */

  var billingSwitch = document.getElementById("billing-switch");
  if (billingSwitch) {
    var monthlyLabel = document.getElementById("label-monthly");
    var yearlyLabel = document.getElementById("label-yearly");
    var amount = document.getElementById("pro-amount");
    var per = document.getElementById("pro-per");
    var note = document.getElementById("pro-note");

    var syncBilling = function () {
      var yearly = billingSwitch.checked;
      monthlyLabel.dataset.active = yearly ? "false" : "true";
      yearlyLabel.dataset.active = yearly ? "true" : "false";
      amount.textContent = yearly ? "$72" : "$8";
      per.textContent = yearly ? "per year" : "per month";
      note.textContent = yearly
        ? "Billed yearly — two months free."
        : "Billed monthly. Cancel any time.";
    };

    syncBilling();
    billingSwitch.addEventListener("change", syncBilling);
  }

  /* ---------- Chaos field ---------- */

  var field = document.getElementById("chaos-field");
  if (!field) return;

  var icons = Array.prototype.slice.call(field.querySelectorAll(".chaos-icon"));
  if (icons.length === 0) return;

  var SPEED = 22; // px per second, roughly
  var REPEL_RADIUS = 130;
  var REPEL_FORCE = 900;
  var DRAG = 0.985;

  var bounds = { width: 0, height: 0 };
  var pointer = { x: -9999, y: -9999, active: false };

  var particles = icons.map(function (el, index) {
    var angle = (index / icons.length) * Math.PI * 2 + Math.random();
    return {
      el: el,
      size: 48,
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

  var measure = function () {
    var rect = field.getBoundingClientRect();
    bounds.width = rect.width;
    bounds.height = rect.height;

    particles.forEach(function (p) {
      p.size = p.el.offsetWidth || 48;
      // Keep everything inside after a resize rather than letting it drift out.
      p.x = Math.min(Math.max(p.x, 0), Math.max(bounds.width - p.size, 0));
      p.y = Math.min(Math.max(p.y, 0), Math.max(bounds.height - p.size, 0));
    });
  };

  var scatter = function () {
    // A loose grid, then jittered — a purely random scatter clumps.
    var columns = Math.ceil(Math.sqrt(particles.length));
    var rows = Math.ceil(particles.length / columns);

    particles.forEach(function (p, index) {
      var col = index % columns;
      var row = Math.floor(index / columns);
      var cellW = bounds.width / columns;
      var cellH = bounds.height / rows;
      p.x = col * cellW + (cellW - p.size) * (0.15 + Math.random() * 0.7);
      p.y = row * cellH + (cellH - p.size) * (0.15 + Math.random() * 0.7);
      p.x = Math.min(Math.max(p.x, 0), Math.max(bounds.width - p.size, 0));
      p.y = Math.min(Math.max(p.y, 0), Math.max(bounds.height - p.size, 0));
    });
  };

  var draw = function (p, scale) {
    p.el.style.transform =
      "translate3d(" +
      p.x.toFixed(2) +
      "px," +
      p.y.toFixed(2) +
      "px,0) rotate(" +
      p.rot.toFixed(2) +
      "deg) scale(" +
      scale.toFixed(3) +
      ")";
  };

  measure();
  scatter();
  particles.forEach(function (p) {
    draw(p, 1);
  });

  window.addEventListener("resize", measure);

  // Reduced motion gets the scattered layout and nothing else.
  if (reducedMotion.matches) return;

  field.addEventListener("pointermove", function (event) {
    var rect = field.getBoundingClientRect();
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
    pointer.active = true;
  });

  field.addEventListener("pointerleave", function () {
    pointer.active = false;
  });

  var running = true;
  var frame = 0;
  var last = 0;

  var step = function (now) {
    if (!last) last = now;
    // Clamp the delta so a backgrounded tab does not resume with one huge jump.
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var half = p.size / 2;
      var cx = p.x + half;
      var cy = p.y + half;

      if (pointer.active) {
        var dx = cx - pointer.x;
        var dy = cy - pointer.y;
        var dist = Math.hypot(dx, dy);
        if (dist < REPEL_RADIUS && dist > 0.01) {
          var strength = (1 - dist / REPEL_RADIUS) * REPEL_FORCE;
          p.vx += (dx / dist) * strength * dt;
          p.vy += (dy / dist) * strength * dt;
        }
      }

      p.vx *= DRAG;
      p.vy *= DRAG;

      // Drift never dies out entirely, and never runs away either.
      var speed = Math.hypot(p.vx, p.vy);
      if (speed < SPEED * 0.5 && speed > 0.01) {
        p.vx *= 1.02;
        p.vy *= 1.02;
      } else if (speed > SPEED * 8) {
        p.vx *= 0.94;
        p.vy *= 0.94;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      var maxX = Math.max(bounds.width - p.size, 0);
      var maxY = Math.max(bounds.height - p.size, 0);

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

  var start = function () {
    if (running && frame) return;
    running = true;
    last = 0;
    frame = window.requestAnimationFrame(step);
  };

  var stop = function () {
    running = false;
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
  };

  // Only animate while the field is actually on screen and the tab is visible.
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) start();
          else stop();
        });
      },
      { threshold: 0 }
    ).observe(field);
  } else {
    start();
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop();
    else start();
  });
})();
