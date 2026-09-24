/*
  Red Banana hero — scroll wiring.

  DOM entrances (headline split-reveal, eyebrow/sub/CTA fade-up, capability
  card reveal) go through the shared motion-lib ("Torque" easing,
  assets/vendor/motion.umd.min.js) rather than hand-rolled GSAP, per the
  programme's shared-library ruling. This file keeps only what motion-lib
  does not do: the corridor's scroll-driven camera dolly (delegated to
  window.RBGallery, bridging js/gallery-scene.js — the reused R&D engine —
  see js/gallery-init.js) and the station-label cross-fade + intro
  recede/return choreography tied to it, both specific to this one hero.

  Reduced motion: this file does nothing beyond adding the .reduced-motion
  class. gallery-init.js never mounts the WebGL scene in that case, and
  css/style.css's .reduced-motion rules lay the six capabilities out as a
  complete, static, already-visible grid over the same poster image used
  as the no-JS/pre-resolve fallback. There is no separate "reduced" JS
  path to maintain: the default HTML+CSS state already IS that path.
*/
(function () {
  "use strict";

  var root = document.documentElement;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) root.classList.add("reduced-motion");

  document.addEventListener("DOMContentLoaded", function () {
    if (reduced) return; // static grid + poster is already the complete page

    if (typeof gsap === "undefined" || typeof window.motion === "undefined") {
      // motion-lib or gsap failed to load: reveal everything statically
      // rather than leaving it at its pre-animation opacity.
      document.querySelectorAll(".hero-h1 .line, .eyebrow, .hero-sub, .cta-row, .cap-card")
        .forEach(function (el) { el.style.opacity = 1; el.style.transform = "none"; });
      return;
    }

    gsap.registerPlugin(ScrollTrigger);
    window.motion.initSmoothScroll();

    // --- entrances, via motion-lib -----------------------------------
    window.motion.revealText(".hero-h1 .line", { by: "words", from: "start" });
    window.motion.revealOnScroll(".eyebrow, .hero-sub, .cta-row", {
      scrollTrigger: false,
      y: 18,
    });
    window.motion.revealOnScroll(".cap-card", { start: "top 82%" });

    // Bricolage Grotesque's wdth axis, 75 -> 100, same beat as the
    // headline's word-reveal: the type widens as the corridor is about to
    // open, "a beam of light widening" per the typography scout's brief.
    var heroH1 = document.getElementById("hero-heading");
    if (heroH1) {
      // Rest state in CSS is 100 (correct final typography for anyone who
      // never runs this animation). Only here, where the entrance is
      // actually about to play, do we drop it to 75 first and tween back.
      gsap.fromTo(
        heroH1,
        { "--wdth": 75 },
        {
          "--wdth": 100,
          duration: window.motion.timing.enter + 0.3,
          ease: window.motion.ease.out,
          delay: 0.15,
        }
      );
    }

    mountGalleryBridge();
    wireHeroScroll();
    wireCapabilities();
    ScrollTrigger.refresh();
  });

  function mountGalleryBridge() {
    var hero = document.getElementById("hero");
    if (!hero) return;
    hero.addEventListener("pointermove", function (e) {
      var x = (e.clientX / window.innerWidth) * 2 - 1;
      var y = (e.clientY / window.innerHeight) * 2 - 1;
      if (window.RBGallery) window.RBGallery.setPointer(x, y);
    });
  }

  function wireHeroScroll() {
    var hero = document.getElementById("hero");
    var labels = Array.prototype.slice.call(document.querySelectorAll(".station-label"));
    var ticks = Array.prototype.slice.call(document.querySelectorAll(".hero-progress .tick"));
    var introEl = document.querySelector(".hero-content");
    var stationCount = labels.length || 6;

    // The intro only needs the stage for the first moment; it recedes
    // (Torque ease.in, quick) once the walk begins so it never collides
    // with a station label, and returns (ease.out) as the walk arrives at
    // the last capability, handing off into the Capabilities grid below.
    var introOutEnd = 0.1;
    var introBackStart = 0.93;

    ScrollTrigger.create({
      trigger: hero,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.4,
      onUpdate: function (self) {
        var p = self.progress;
        if (window.RBGallery) window.RBGallery.setProgress(p);

        var activeIndex = Math.min(stationCount - 1, Math.floor(p * stationCount));
        labels.forEach(function (label, i) {
          var center = (i + 0.5) / stationCount;
          var isActive = Math.abs(p - center) < 0.078;
          label.classList.toggle("is-active", isActive);
        });
        ticks.forEach(function (tick, i) {
          tick.classList.toggle("is-active", i <= activeIndex);
        });

        if (introEl) {
          var introOpacity;
          if (p <= introOutEnd) introOpacity = 1 - p / introOutEnd;
          else if (p >= introBackStart) introOpacity = (p - introBackStart) / (1 - introBackStart);
          else introOpacity = 0;
          introEl.style.opacity = introOpacity;
          introEl.style.transform = "translateY(" + (1 - introOpacity) * 16 + "px)";
          introEl.classList.toggle("is-dormant", introOpacity < 0.4);
        }
      },
    });
  }

  function wireCapabilities() {
    // Reveal handled by motion.revealOnScroll(".cap-card", ...) above;
    // nothing site-specific left to add here.
  }
})();
