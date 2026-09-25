/*
 * v3-wall.js — Red Banana v3 "THE OBJECT"
 * WALL AND LIST LANE. Branch rb-bg/v3-object.
 *
 * Owns: Moment 4 (rb-v3/SIGNATURE-MOMENTS.md, "the lights come up in
 * the next room" — the numbers wall) and Moment 6 ("the capabilities
 * list"). Executes the two rulings that override or sharpen that
 * document (RB-V3-DIRECTION-CONTRACT.md §8, ruled 17:43 IST 24 Sep):
 *   A4 — the archive figure never appears. This file never hardcodes
 *        a tile count or a figure value; it reads whatever
 *        `.wall-figure` elements actually exist in the DOM (five, as
 *        committed) and builds around that count.
 *   A5 — the FAQ has no copy to animate; this file's SplitText-style
 *        work goes nowhere near #faq (that moved to the footer,
 *        CHAPTERS lane's file, not this one).
 *
 * Vermilion: this file writes --red nowhere. See v3-wall.css's header
 * comment — the one budgeted vermilion use this lane owns (the live
 * capability row's .num colour) is already a v3.css rule; this file
 * only toggles the .is-live class that rule reacts to.
 *
 * No CustomEase plugin is vendored (only gsap.min.js + ScrollTrigger,
 * confirmed by grepping assets/vendor/gsap.min.js for "CustomEase" —
 * zero hits). SIGNATURE-MOMENTS.md's named "Torque" curves are
 * implemented below as a small cubic-bezier solver (the standard
 * Newton-Raphson/binary-subdivide algorithm used by every "bezier-
 * easing" implementation) and passed to GSAP as ease FUNCTIONS —
 * GSAP's documented custom-ease form: a function that takes a 0-1
 * progress value and returns the eased 0-1 value. This keeps every
 * curve numerically exact to the spec's four-number definitions
 * without a new vendor file.
 */
(function () {
  "use strict";

  // ------------------------------------------------------------ bezier
  // Standard cubic-bezier progress solver (the gre/bezier-easing
  // algorithm). mX1/mY1/mX2/mY2 are the four control-point numbers
  // SIGNATURE-MOMENTS.md's easing table gives for each named curve.
  function bezierEasing(mX1, mY1, mX2, mY2) {
    function A(a1, a2) { return 1.0 - 3.0 * a2 + 3.0 * a1; }
    function B(a1, a2) { return 3.0 * a2 - 6.0 * a1; }
    function C(a1) { return 3.0 * a1; }
    function calcBezier(t, a1, a2) { return ((A(a1, a2) * t + B(a1, a2)) * t + C(a1)) * t; }
    function getSlope(t, a1, a2) { return 3.0 * A(a1, a2) * t * t + 2.0 * B(a1, a2) * t + C(a1); }

    function newtonRaphson(aX, guessT) {
      for (var i = 0; i < 4; i++) {
        var slope = getSlope(guessT, mX1, mX2);
        if (slope === 0) return guessT;
        var x = calcBezier(guessT, mX1, mX2) - aX;
        guessT -= x / slope;
      }
      return guessT;
    }

    var kSplineTableSize = 11;
    var kSampleStep = 1.0 / (kSplineTableSize - 1.0);
    var sampleValues = new Array(kSplineTableSize);
    for (var i = 0; i < kSplineTableSize; i++) sampleValues[i] = calcBezier(i * kSampleStep, mX1, mX2);

    function binarySubdivide(aX, a, b) {
      var x, t, i = 0;
      do {
        t = a + (b - a) / 2.0;
        x = calcBezier(t, mX1, mX2) - aX;
        if (x > 0) b = t; else a = t;
      } while (Math.abs(x) > 1e-7 && ++i < 10);
      return t;
    }

    function getTForX(aX) {
      var intervalStart = 0.0, currentSample = 1, lastSample = kSplineTableSize - 1;
      for (; currentSample !== lastSample && sampleValues[currentSample] <= aX; currentSample++) {
        intervalStart += kSampleStep;
      }
      currentSample--;
      var dist = (aX - sampleValues[currentSample]) / (sampleValues[currentSample + 1] - sampleValues[currentSample]);
      var guessForT = intervalStart + dist * kSampleStep;
      var initialSlope = getSlope(guessForT, mX1, mX2);
      if (initialSlope >= 0.001) return newtonRaphson(aX, guessForT);
      if (initialSlope === 0) return guessForT;
      return binarySubdivide(aX, intervalStart, intervalStart + kSampleStep);
    }

    return function (x) {
      if (mX1 === mY1 && mX2 === mY2) return x;
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      return calcBezier(getTForX(x), mY1, mY2);
    };
  }

  // Named exactly as SIGNATURE-MOMENTS.md's easing table.
  var TORQUE = {
    out: bezierEasing(0.16, 1, 0.3, 1),
    in: bezierEasing(0.7, 0, 0.84, 0),
    inOut: bezierEasing(0.87, 0, 0.13, 1),
    snap: bezierEasing(0.34, 1.56, 0.64, 1),
  };

  var V3 = window.V3 || (window.V3 = {});
  var REDUCED = !!V3.reducedMotion;
  var HAS_GSAP = typeof window.gsap !== "undefined";
  var HAS_ST = HAS_GSAP && typeof window.ScrollTrigger !== "undefined";

  function clamp01(n) { return n < 0 ? 0 : n > 1 ? 1 : n; }

  // ============================================================
  // MOMENT 4 — the numbers wall
  // ============================================================
  function initNumbersWall(section) {
    var tiles = section.querySelectorAll(".wall-tile");
    var figures = section.querySelectorAll(".wall-figure");
    var grid = section.querySelector(".wall-grid");

    // Layout follows whatever count is REALLY in the DOM — never an
    // assumed six. This runs even under reduced motion / no gsap: it
    // is a static layout choice, not motion.
    if (grid && tiles.length) {
      grid.classList.add("wall-grid--" + tiles.length);
    }

    if (REDUCED || !HAS_GSAP) {
      // "No strike, no drift, no bulge, no mask reveal... One CSS
      // block, no JS." Nothing further is injected; the section is
      // already light ground with all figures visible at rest
      // (v3.css's static .v3-section--inverted class + the plain
      // DOM), which needed no JS to be true in the first place.
      return;
    }

    // ---------------- six striking columns ----------------
    var STRIKE_OFFSETS = [0.00, 0.04, 0.02, 0.07, 0.03, 0.05];
    var strikeLayer = document.createElement("div");
    strikeLayer.className = "wall-strike-layer";
    strikeLayer.setAttribute("aria-hidden", "true");
    var strikeCols = STRIKE_OFFSETS.map(function () {
      var col = document.createElement("div");
      col.className = "wall-strike";
      col.setAttribute("aria-hidden", "true");
      strikeLayer.appendChild(col);
      return col;
    });
    section.insertBefore(strikeLayer, section.firstChild);

    var struckFlag = STRIKE_OFFSETS.map(function () { return false; });
    // Each column's own progress offset DELAYS THE START of a
    // fixed-duration rise; it must not also stretch to fill whatever
    // range is left, or every column would reach scaleY(1) at the
    // same instant (p=1) regardless of offset, which is not a
    // circuit powering up in any observable order. Duration is fixed
    // so the LAST (highest-offset) column still finishes exactly at
    // p=1: duration = 1 - max(offsets). Completion point for column i
    // is then offset_i + duration, strictly ordered by offset_i, which
    // is exactly what SIGNATURE-MOMENTS.md's QA assertion 2 checks.
    var STRIKE_DURATION = 1 - Math.max.apply(null, STRIKE_OFFSETS);

    var strikeST = ScrollTrigger.create({
      trigger: section,
      start: "top bottom",
      end: "top 40%",
      scrub: 1,
      onUpdate: function (self) {
        var p = self.progress;
        for (var i = 0; i < strikeCols.length; i++) {
          var offset = STRIKE_OFFSETS[i];
          var local = clamp01((p - offset) / STRIKE_DURATION);
          var eased = TORQUE.out(local);
          strikeCols[i].style.transform = "scaleY(" + eased + ")";
          if (local >= 1 && !struckFlag[i]) {
            struckFlag[i] = true;
            flashColumn(strikeCols[i]);
          } else if (local < 1 && struckFlag[i]) {
            // left the fully-struck state (scrolled back up): allow
            // the flash to fire again on re-entry, per moment spec
            // "fired once per column per entry."
            struckFlag[i] = false;
          }
        }
        section.classList.toggle("wall-lit", p >= 0.62);
      },
    });

    function flashColumn(col) {
      gsap.fromTo(
        col,
        { filter: "brightness(1.08)" },
        { filter: "brightness(1.00)", duration: 0.09, ease: TORQUE.snap }
      );
    }

    // ---------------- three drifting marquee columns ----------------
    var figureText = Array.prototype.map.call(figures, function (f) {
      return (f.textContent || "").trim();
    }).filter(Boolean);

    if (figureText.length) {
      var marqueeLayer = document.createElement("div");
      marqueeLayer.className = "wall-marquee-layer";
      marqueeLayer.setAttribute("aria-hidden", "true");

      var SPEEDS = [14, 9, 17]; // px/s
      var DIRECTIONS = [1, -1, 1];
      var marqueeCols = [];

      SPEEDS.forEach(function (speed, i) {
        var col = document.createElement("div");
        col.className = "wall-marquee-col";
        col.setAttribute("aria-hidden", "true");

        // Repeat the real figures enough times to fill a tall column,
        // then duplicate the whole block once so a 50%-translateY
        // loop is seamless.
        var repeated = [];
        for (var r = 0; r < 8; r++) repeated = repeated.concat(figureText);
        var text = repeated.join("   ·   ");

        var trackA = document.createElement("div");
        trackA.className = "wall-marquee-track";
        trackA.textContent = text;
        var trackB = trackA.cloneNode(true);

        col.appendChild(trackA);
        col.appendChild(trackB);
        marqueeLayer.appendChild(col);
        marqueeCols.push({ el: col, trackA: trackA, trackB: trackB, dir: DIRECTIONS[i] });
      });

      section.insertBefore(marqueeLayer, strikeLayer.nextSibling);

      // Duration computed ONCE from measured track height and the
      // authored px/s speed, then handed to a plain CSS animation —
      // "no JS per frame" for the drift itself.
      window.requestAnimationFrame(function () {
        marqueeCols.forEach(function (col, i) {
          var h = col.trackA.getBoundingClientRect().height || 400;
          var duration = h / SPEEDS[i];
          // Two identical, stacked tracks (flex-column) running the
          // SAME keyframes in lockstep — each translateY(-100%) is
          // relative to its OWN height, so as track A scrolls fully
          // out of view, track B (which started immediately below A)
          // arrives exactly where A began: a seamless loop with no
          // delay offset needed between the two.
          [col.trackA, col.trackB].forEach(function (track) {
            track.style.animation =
              "v3-wall-marquee " + duration + "s linear infinite" + (col.dir < 0 ? " reverse" : "");
          });
        });
      });

      if (!document.getElementById("v3-wall-marquee-keyframes")) {
        var styleEl = document.createElement("style");
        styleEl.id = "v3-wall-marquee-keyframes";
        styleEl.textContent =
          "@keyframes v3-wall-marquee { from { transform: translateY(0); } to { transform: translateY(-100%); } }" +
          "#numbers-wall .wall-marquee-col { display: flex; flex-direction: column; }";
        document.head.appendChild(styleEl);
      }

      // ---------------- column bulge ----------------
      // Damped scaleX toward a pointer-distance (desktop) or
      // scroll-progress (phone) target. lambda 5.0, max 1.06. Runs on
      // rAF only while the section is intersecting the viewport.
      var LAMBDA = 5.0;
      var MAX_SCALE = 1.06;
      var current = marqueeCols.map(function () { return 1; });
      var target = marqueeCols.map(function () { return 1; });
      var rafId = null;
      var lastT = null;
      var isPhone = window.matchMedia("(max-width: 768px)").matches;

      function computeTargetsFromPointer(px) {
        var rect = section.getBoundingClientRect();
        marqueeCols.forEach(function (col, i) {
          var colRect = col.el.getBoundingClientRect();
          var colCenter = colRect.left + colRect.width / 2;
          var dist = Math.abs(px - colCenter);
          var norm = clamp01(1 - dist / (rect.width / 2));
          target[i] = 1 + (MAX_SCALE - 1) * norm;
        });
      }

      function computeTargetsFromScroll() {
        var vpCenter = window.innerWidth / 2;
        var rect = section.getBoundingClientRect();
        // Nearest column to viewport centre bulges; approximate by
        // scroll progress through the section mapped across columns.
        var progress = clamp01((window.innerHeight - rect.top) / (rect.height + window.innerHeight));
        var nearest = Math.round(progress * (marqueeCols.length - 1));
        marqueeCols.forEach(function (col, i) {
          target[i] = i === nearest ? MAX_SCALE : 1;
        });
        void vpCenter;
      }

      function tick(t) {
        rafId = window.requestAnimationFrame(tick);
        if (lastT === null) lastT = t;
        var dt = Math.min((t - lastT) / 1000, 0.1);
        lastT = t;
        var alpha = 1 - Math.exp(-LAMBDA * dt);
        for (var i = 0; i < marqueeCols.length; i++) {
          current[i] += (target[i] - current[i]) * alpha;
          marqueeCols[i].el.style.transform = "scaleX(" + current[i].toFixed(4) + ")";
        }
      }

      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            if (rafId === null) {
              lastT = null;
              rafId = window.requestAnimationFrame(tick);
            }
          } else if (rafId !== null) {
            window.cancelAnimationFrame(rafId);
            rafId = null;
          }
        });
      }, { threshold: 0 });
      io.observe(section);

      if (isPhone) {
        window.addEventListener("scroll", computeTargetsFromScroll, { passive: true });
        computeTargetsFromScroll();
      } else {
        section.addEventListener("pointermove", function (e) {
          computeTargetsFromPointer(e.clientX);
        });
        section.addEventListener("pointerleave", function () {
          target = marqueeCols.map(function () { return 1; });
        });
      }
    }

    // ---------------- figures arrive printed (mask reveal) ----------------
    if (figures.length) {
      Array.prototype.forEach.call(figures, function (fig) {
        fig.classList.add("wall-figure--masked");
      });
      ScrollTrigger.create({
        trigger: section,
        start: "top 75%",
        toggleActions: "play none none reverse",
        onEnter: function () { playFigureReveal(); },
        onEnterBack: function () { playFigureReveal(); },
        onLeaveBack: function () { resetFigures(); },
      });
      var played = false;
      function playFigureReveal() {
        if (played) return;
        played = true;
        gsap.to(figures, {
          clipPath: "inset(0 0 0% 0)",
          duration: 0.62,
          stagger: 0.09,
          ease: TORQUE.out,
          onStart: function () {
            Array.prototype.forEach.call(figures, function (f) {
              f.classList.remove("wall-figure--masked");
              f.classList.add("wall-figure--revealed");
            });
          },
        });
      }
      function resetFigures() {
        played = false;
        gsap.set(figures, { clipPath: "inset(0 0 100% 0)" });
        Array.prototype.forEach.call(figures, function (f) {
          f.classList.remove("wall-figure--revealed");
          f.classList.add("wall-figure--masked");
        });
      }
    }

    void strikeST;
  }

  // ============================================================
  // MOMENT 6 — the capabilities list
  // ============================================================
  function initCapabilitiesList(section) {
    var list = section.querySelector(".cap-list");
    var items = section.querySelectorAll(".cap-item");
    if (!list || !items.length) return;

    var rule = document.createElement("div");
    rule.className = "cap-rule";
    rule.setAttribute("aria-hidden", "true");
    list.appendChild(rule);

    var offsets = []; // {top, left, width, centerDoc} per item, cached
    function cacheOffsets() {
      offsets = Array.prototype.map.call(items, function (item) {
        var h3 = item.querySelector("h3");
        var itemRect = item.getBoundingClientRect();
        var h3Rect = h3.getBoundingClientRect();
        var listRect = list.getBoundingClientRect();
        return {
          top: h3Rect.top - listRect.top + list.scrollTop,
          left: h3Rect.left - listRect.left,
          width: h3Rect.width,
          centerDoc: itemRect.top + window.scrollY + itemRect.height / 2,
        };
      });
    }
    cacheOffsets();

    var HAS_QUICK = HAS_GSAP && typeof gsap.quickTo === "function";
    var ruleDuration = REDUCED ? 0 : 0.38;
    var quickY, quickX, quickW;
    if (HAS_QUICK) {
      quickY = gsap.quickTo(rule, "y", { duration: ruleDuration, ease: TORQUE.out });
      quickX = gsap.quickTo(rule, "x", { duration: ruleDuration, ease: TORQUE.out });
      quickW = gsap.quickTo(rule, "width", { duration: ruleDuration, ease: TORQUE.out });
    }

    function placeRule(i, immediate) {
      var item = items[i];
      if (!item) return;
      var h3 = item.querySelector("h3");
      if (!h3) return;
      /* CLOSER fix, 24 Sep (RB-V3-QA-VISUAL.md, "capabilities tracking-
         rule offset" flag, 27.6px single-sample reading). Reproduced
         first at three real scroll positions (settled section-top,
         +150px, -100px), hover row rb004, 100/500/1000/2000ms waits:
         a stable, exactly-reproducing 27.59px offset at all three
         positions, not a settle-timing artefact (identical from 500ms
         to 2000ms). Root cause, isolated by comparing a native instant
         window.scrollTo() jump (offset stayed a perfectly constant
         459.78 at every position -- proves the geometry itself is
         scroll-invariant, as it should be) against real Lenis wheel-
         driven scrolling THROUGH the page (the live h3-vs-list relative
         offset drifted from 459.78 to 432.85 as the page scrolled past
         the sections above #capabilities, then held steady) -- so
         `offsets[i]` (built once by cacheOffsets(), refreshed only on
         resize/ScrollTrigger-refresh) had gone stale by the time a real
         visitor scrolls down and hovers a row, and nothing re-fires
         cacheOffsets() at the right moment to catch it. Forcing a
         `resize` dispatch confirmed the fix direction: it collapses the
         gap from 26.59px to 0.67px, because cacheOffsets() recomputes
         correctly when called fresh -- the bug is trusting a cache for
         a discrete, infrequent event (hover/focus) that costs nothing
         to measure live. Fix: placeRule() (called on hover/focus/live-
         change, not per scroll frame) now reads the item's real
         getBoundingClientRect() at the moment it is called, instead of
         indexing into `offsets[]`. `offsets[]`/`cacheOffsets()` stay
         exactly as they were for evaluateScrollDriver()'s per-frame
         "nearest row" comparison, which only needs coarse centreDoc
         values and must stay cheap (no per-frame reflow) -- unaffected
         by this fix, still cache-based, still invalidated on resize/
         ScrollTrigger-refresh same as before. */
      var h3Rect = h3.getBoundingClientRect();
      var listRect = list.getBoundingClientRect();
      var top = h3Rect.top - listRect.top + list.scrollTop;
      var left = h3Rect.left - listRect.left;
      var width = h3Rect.width;
      if (immediate || !HAS_QUICK) {
        rule.style.transform = "translate(" + left + "px," + top + "px)";
        rule.style.width = width + "px";
      } else {
        quickY(top);
        quickX(left);
        quickW(width);
      }
    }

    var liveIndex = 0;
    function setLive(i) {
      if (i === liveIndex) return;
      liveIndex = i;
      Array.prototype.forEach.call(items, function (item, idx) {
        item.classList.toggle("is-live", idx === i);
      });
      placeRule(i, false);
    }

    // Default live row on load: 01.
    items[0].classList.add("is-live");
    placeRule(0, true);

    // ---------------- hover / focus-visible: one class, both inputs ----------------
    var hoverIndex = null;
    Array.prototype.forEach.call(items, function (item, i) {
      item.addEventListener("mouseenter", function () {
        hoverIndex = i;
        setLive(i);
      });
      item.addEventListener("mouseleave", function () {
        if (hoverIndex === i) {
          hoverIndex = null;
          setLive(scrollLiveIndex);
        }
      });
      var link = item.querySelector("a");
      if (link) {
        link.addEventListener("focus", function () {
          hoverIndex = i;
          setLive(i);
        });
        link.addEventListener("blur", function () {
          if (hoverIndex === i) {
            hoverIndex = null;
            setLive(scrollLiveIndex);
          }
        });
      }
    });

    // ---------------- scroll driver ----------------
    // "The live row is the one whose centre is nearest the viewport
    // centre" — evaluated through the same rAF gate v3-core.js uses
    // for the nav (a ticking flag off Lenis's scroll event, falling
    // back to a native scroll listener).
    var scrollLiveIndex = 0;
    var ticking = false;
    function evaluateScrollDriver() {
      ticking = false;
      var vpCenter = window.scrollY + window.innerHeight / 2;
      var nearest = 0;
      var best = Infinity;
      for (var i = 0; i < offsets.length; i++) {
        var d = Math.abs(offsets[i].centerDoc - vpCenter);
        if (d < best) { best = d; nearest = i; }
      }
      scrollLiveIndex = nearest;
      if (hoverIndex === null) setLive(nearest);
    }
    function requestScrollCheck() {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(evaluateScrollDriver);
      }
    }
    if (V3.lenis) {
      V3.lenis.on("scroll", requestScrollCheck);
    } else {
      window.addEventListener("scroll", requestScrollCheck, { passive: true });
    }

    // Cache invalidated only on resize and ScrollTrigger.refresh —
    // never per frame.
    window.addEventListener("resize", function () {
      cacheOffsets();
      placeRule(liveIndex, true);
      requestScrollCheck();
    }, { passive: true });
    if (HAS_ST) {
      ScrollTrigger.addEventListener("refresh", function () {
        cacheOffsets();
        placeRule(liveIndex, true);
      });
    }

    requestScrollCheck();
  }

  // ------------------------------------------------------------ wire up
  V3.onSlotReady("numbers-wall", initNumbersWall);
  V3.onSlotReady("capabilities", initCapabilitiesList);
})();
