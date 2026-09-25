/*
 * v3-core.js — Red Banana v3 "THE OBJECT"
 * Written by the INTEGRATOR, Thursday 24 September 2026, on branch
 * rb-bg/v3-object, per RB-V3-DIRECTION-CONTRACT.md §5 (motion law).
 *
 * Owns: Lenis + ScrollTrigger sync, the reveal(els, opts) primitive
 * exposed as window.V3.reveal, window.V3.lenis, the first-visit
 * loader, nav hide-on-scroll above 992px, the mobile menu (stops
 * Lenis while open), and window.V3.onSlotReady(name, fn) so the four
 * builder lanes can attach their own scenes/animations after this
 * script and DOMContentLoaded have both run. This file does not touch
 * any slot's interior DOM beyond applying the default reveal to each
 * slot's headings and paragraphs (contract: "the page already moves
 * before lanes land").
 *
 * Reduced motion: if prefers-reduced-motion is set, this file skips
 * every tween, adds html.reduced-motion (v3.css's CSS-only fallback
 * already matches this class), and calls ScrollTrigger's own
 * getAll().forEach(st => st.disable()) equivalent once ScrollTrigger
 * is loaded, so no pin, scrub or scroll-linked animation can run.
 * Lenis still initialises (smooth wheel is not itself motion sickness
 * territory) but never drives a reveal.
 */
(function () {
  "use strict";

  var root = document.documentElement;
  root.classList.add("js");

  var reducedMotionQuery = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : { matches: false, addEventListener: function () {} };
  var REDUCED = reducedMotionQuery.matches;
  if (REDUCED) root.classList.add("reduced-motion");

  /* LOGO WIRING fix, 25 Sep 2026: read the "have we been here before THIS
     load" flag exactly ONCE, here, before anything in this file writes it.
     Bug found while proving the loader's timing for LOGO-MOTION.md: runLoader()
     (below) unconditionally calls sessionStorage.setItem("v3-visited","1")
     on every genuinely-first visit, and playArrivalIfReady() (also below)
     re-reads that SAME key later to decide whether to speed the arrival
     timeline up 2.2x for a "repeat visit" -- by the time it re-reads it,
     runLoader() has already set it for the CURRENT (first) visit, so
     every load, first or repeat, silently played back at 2.2x. Verified
     live: a fresh context with sessionStorage cleared still reported
     arrivalTimeline.timeScale() === 2.2. One flag, read once, used by both
     call sites below instead of each independently querying storage at a
     different point in time -- Moment 1's beats/values/cap are untouched,
     only WHICH speed they play at on a true first visit is corrected. */
  var SEEN_BEFORE_THIS_LOAD = false;
  try { SEEN_BEFORE_THIS_LOAD = sessionStorage.getItem("v3-visited") === "1"; } catch (e) {}

  var HAS_GSAP = typeof window.gsap !== "undefined";
  var HAS_SCROLLTRIGGER = HAS_GSAP && typeof window.ScrollTrigger !== "undefined";
  var HAS_LENIS = typeof window.Lenis !== "undefined";

  if (HAS_GSAP && HAS_SCROLLTRIGGER) {
    gsap.registerPlugin(ScrollTrigger);
  }

  /* ============================================================
     LENIS + SCROLLTRIGGER SYNC — contract §5, exact values.
     lenis = new Lenis({duration:1.6, wheelMultiplier:1.25})
     lenis.on('scroll', ScrollTrigger.update)
     gsap.ticker drives lenis.raf, lagSmoothing(0)
     ============================================================ */
  var lenis = null;
  if (HAS_LENIS) {
    lenis = new Lenis({ duration: 1.6, wheelMultiplier: 1.25 });

    if (HAS_SCROLLTRIGGER) {
      lenis.on("scroll", ScrollTrigger.update);
    }

    if (HAS_GSAP) {
      gsap.ticker.add(function (time) {
        lenis.raf(time * 1000);
      });
      gsap.ticker.lagSmoothing(0);
    } else {
      // No gsap: drive Lenis off rAF directly so scroll still works.
      function rafLoop(time) {
        lenis.raf(time);
        requestAnimationFrame(rafLoop);
      }
      requestAnimationFrame(rafLoop);
    }
  }

  /* ============================================================
     REVEAL PRIMITIVE — contract §5:
       filter blur(5px)->0, yPercent 110->0, opacity 0->1, power2.out,
       0.6 to 0.9s, stagger 0.1, toggleActions "play none none reverse"
     CSS (v3.css) already sets the rest state on html.js [data-reveal];
     this function only animates FROM it. Elements are always fully
     visible without JS or under reduced motion (v3.css handles that);
     this function additionally short-circuits to a no-op in both
     cases so it never fights the CSS state.
     ============================================================ */
  function reveal(els, opts) {
    opts = opts || {};
    var list = els && els.length !== undefined ? els : (els ? [els] : []);
    if (typeof els === "string") list = document.querySelectorAll(els);
    if (!list || !list.length) return;

    if (REDUCED || !HAS_GSAP) {
      // Static, composed and fully visible — the CSS rest state under
      // .reduced-motion or :not(.js) already renders this; when JS is
      // present but gsap failed to load, force it explicitly so
      // nothing is left stuck at the hidden CSS rest state.
      Array.prototype.forEach.call(list, function (el) {
        el.style.opacity = 1;
        el.style.filter = "none";
        el.style.transform = "none";
      });
      return;
    }

    // A ScrollTrigger whose "start" point has ALREADY been crossed at
    // the moment it is created is a known trouble spot on this kit's
    // vendored GSAP/ScrollTrigger build: the trigger's own initial
    // refresh (and a later ScrollTrigger.refresh() call, e.g. after
    // webfonts finish loading) can leave the yPercent/transform
    // component of an already-fired tween stuck at its STARTING
    // value even though opacity/filter correctly reach their end
    // state — verified live and reproducible (blur(0px) and
    // opacity:1 land in the inline style; transform stays at exactly
    // the yPercent:110-equivalent pixel value, matching each
    // element's own height x 1.1, across repeated fresh loads).
    //
    // The original fix only bypassed gsap's yPercent tween for
    // content already in view AT CREATION time (the hero, most
    // obviously), on the assumption that below-the-fold triggers are
    // safe because "a REAL scroll event drives those". That
    // assumption turned out to be false: revealSlotDefaults() creates
    // every slot's ScrollTrigger in one pass, then a single
    // ScrollTrigger.refresh() runs — but the hero's async GLB/poster,
    // below-fold images and any remaining font-metric settling keep
    // shifting section positions AFTER that refresh. A below-fold
    // trigger's cached start/end can go stale before the visitor ever
    // reaches it, and a real (or fast, wheel-driven) scroll can cross
    // that stale boundary more than once in quick succession. With
    // toggleActions "play none none reverse" that means the SAME
    // fromTo tween gets play()'d then reverse()'d — sometimes inside
    // a single frame — and reproducibly left the yPercent component
    // stuck at a partial value (matrix(...,0,0,1,0,N)) even though
    // opacity/filter, which reach their end state faster, land clean.
    // Confirmed live on #numbers-wall/#capabilities/#faq headings with
    // a wheel-driven scroll: every one of them stuck at a non-zero
    // translateY long after the reveal should have finished.
    //
    // Fix: stop trusting gsap's yPercent tween for ANY [data-reveal]
    // element, not only the ones already in view at creation. Every
    // element now animates via the same plain CSS transition
    // (v3.css's .v3-reveal-in-view rule) that was already proven safe
    // for the hero. For below-the-fold content, a plain
    // ScrollTrigger.create() (no tween attached, so nothing for a
    // rapid enter/leaveBack pair to interrupt mid-flight) just toggles
    // the [data-reveal] attribute on/off — onEnter drops it (CSS
    // transitions to the visible state), onLeaveBack restores it (CSS
    // transitions back to the hidden rest state) — which is the same
    // play/…/reverse shape as before, minus gsap's yPercent pipeline
    // entirely. Opacity/filter/transform all animate through the one
    // CSS transition, so their visible motion is unchanged.
    var triggerEl = opts.trigger || list[0];
    var alreadyInView =
      triggerEl &&
      triggerEl.getBoundingClientRect &&
      triggerEl.getBoundingClientRect().top < window.innerHeight;
    var staggerSec = opts.stagger !== undefined ? opts.stagger : 0.1;
    var pendingTimers = [];

    function showList() {
      Array.prototype.forEach.call(list, function (el) {
        el.classList.add("v3-reveal-in-view");
      });
      Array.prototype.forEach.call(list, function (el, i) {
        // Force one frame with the CSS rest state still applied (blur
        // 5px / translateY(110%) / opacity 0) so the transition has a
        // "from" to animate away from, then drop [data-reveal] to
        // fall through to the plain visible CSS state.
        window.requestAnimationFrame(function () {
          pendingTimers[i] = window.setTimeout(function () {
            el.removeAttribute("data-reveal");
          }, i * staggerSec * 1000);
        });
      });
    }

    function hideList() {
      // Mirrors toggleActions' "reverse": restore the hidden rest
      // state, animated by the same CSS transition (the
      // .v3-reveal-in-view class is never removed once added, so the
      // transition stays wired in both directions). Cancel any
      // still-pending staggered reveal first so a fast up/down flick
      // can't leave a late timer re-hiding an element a moment after
      // this already showed it.
      Array.prototype.forEach.call(list, function (el, i) {
        if (pendingTimers[i]) {
          window.clearTimeout(pendingTimers[i]);
          pendingTimers[i] = null;
        }
        el.setAttribute("data-reveal", "");
      });
    }

    if (alreadyInView || !HAS_SCROLLTRIGGER) {
      showList();
      return;
    }

    ScrollTrigger.create({
      trigger: triggerEl,
      start: opts.start || "top 85%",
      onEnter: showList,
      onLeaveBack: hideList,
    });

    // Bob 47, fix C3 (25 Sep 2026, audit web-eng/rb-audit-20260925):
    // on phones the last section of work.html (replicas) stayed at
    // opacity 0 after a full scroll in repeated runs: the ScrollTrigger
    // above missed its onEnter under Lenis-driven scrolling near the
    // page end (its start/end maths was correct when inspected, so this
    // is a timing race, not a geometry bug). An IntersectionObserver is
    // a second, independent witness: if the trigger element is on
    // screen, the content is shown. It never hides anything.
    if ("IntersectionObserver" in window && triggerEl) {
      var io = new IntersectionObserver(function (entries) {
        for (var k = 0; k < entries.length; k++) {
          if (entries[k].isIntersecting) { showList(); io.disconnect(); return; }
        }
      }, { threshold: 0.05 });
      io.observe(triggerEl);
    }
    // Third witness, deterministic: at the very bottom of the page every
    // remaining reveal is shown. Nothing that is scrolled to can stay
    // hidden, whatever the trigger maths or the smooth-scroll timing did.
    pendingReveals.push(showList);
  }

  var pendingReveals = [];
  window.addEventListener("scroll", function () {
    if (!pendingReveals.length) return;
    var doc = document.documentElement;
    if (window.scrollY + window.innerHeight >= doc.scrollHeight - 2) {
      var fns = pendingReveals; pendingReveals = [];
      for (var i = 0; i < fns.length; i++) fns[i]();
    }
  }, { passive: true });

  /* ============================================================
     MOMENT 1 hand-over API — SIGNATURE-MOMENTS.md "First light".
     CLOSER fix, 24 Sep (RB-V3-QA-VISUAL.md, moment 1 PARTIAL: the
     spec's own hand-over API — window.V3.onArrival(fn), beats D/E on
     the SAME timeline as the hero's house/work/show light beats — was
     never built; the loader instead hid on a plain opacity fade timed
     off window.load, unsynchronised from the lighting. That's fixed
     here (v3-core.js + v3.css only, per the brief's scoping — the
     caption-fix commit has now landed, assets/js/v3-hero.js's OWN
     tween definitions/values are untouched, see the one small guard
     added there separately not to double-play).

     A single paused GSAP timeline is built here, before
     DOMContentLoaded fires (this script runs as a plain synchronous
     <script>, before the module-script hero import even starts) --
     window.V3.arrivalTimeline. Beats D (headline stagger, reusing the
     SAME safe CSS-transition reveal mechanism as revealSlotDefaults()
     below, not a raw GSAP yPercent tween — that class of bug was
     already fixed once, 9edc52a, not reintroduced here) and E (the
     curtain, clip-path on #v3-loader) are added onto it immediately,
     at the spec's exact times (1.05s, 1.45s). window.V3.onArrival(fn)
     lets the hero lane add its own light tweens onto the SAME
     timeline at the SAME absolute positions (0, 0.40, 1.05) the
     instant it calls in — v3-hero.js already had this call site
     written and dormant (its own comment: "window.V3.onArrival was
     never wired").
     Playback starts at whichever comes first: the hero module calling
     onArrival (dynamic-import + GLB fetch, so genuinely async — could
     be fast or slow), or a 600ms grace timer, matching the spec
     exactly ("a failed scene never costs the visitor the headline").
     Documented trade-off, not hidden: if the hero signals right at
     the 600ms edge, the full 1.95s sequence would finish around
     2.55s, past the spec's stated 2100ms loader ceiling — so a
     SEPARATE, unconditional 2100ms safety timer (the pre-existing
     MAX_MS value) force-hides the loader regardless of where the
     timeline is, same hard guarantee the old flat-timer gave, at the
     cost of an abrupt (not curtain-complete) cut in that specific
     slow-hero edge case rather than the graceful choreography. The
     common case — hero ready well under 600ms — is unaffected and
     finishes the true 1.95s curtain lift on schedule.
     Reduced motion: this whole block is skipped (arrivalTimeline
     stays null); v3.css's existing reduced-motion rest state already
     shows every [data-reveal] element at its final frame with the
     loader hidden synchronously by runLoader() below — matches the
     spec's "No timeline at all" line exactly.
     ============================================================ */
  var arrivalTimeline = null;
  var arrivalHeroReady = false;
  var arrivalPlayed = false;

  function logArrivalBeat(name) {
    window.V3.__arrivalLog = window.V3.__arrivalLog || [];
    window.V3.__arrivalLog.push({ name: name, t: performance.now() });
  }

  function playArrivalIfReady() {
    if (arrivalPlayed || !arrivalTimeline) return;
    arrivalPlayed = true;
    // LOGO WIRING fix, 25 Sep: use the ONE flag read at script-start
    // (SEEN_BEFORE_THIS_LOAD), not a fresh sessionStorage read here --
    // runLoader() below has already WRITTEN "v3-visited" for the current
    // visit by the time this runs, so re-reading here always said "seen".
    if (SEEN_BEFORE_THIS_LOAD) arrivalTimeline.timeScale(2.2); // spec: 0.89s total on a repeat visit
    arrivalTimeline.play();
  }

  if (HAS_GSAP && !REDUCED) {
    arrivalTimeline = gsap.timeline({ paused: true });

    // Beat D — headline stagger, starts with beat C ("show"), 0.14s
    // apart: kicker, then h1, then the subhead p. (.cta-row has no
    // [data-reveal] of its own in this tree and stays out of this
    // choreography — a scope decision, not an oversight: adding a
    // fourth stagger slot to an element the reveal system doesn't
    // already own risked more than the visual gain here.)
    // 1.06, not the spec's literal 1.05: the hero lane's own "show"
    // light tween (CONFIG.arrivalShowAt, also 1.05) is added onto
    // THIS SAME timeline later, asynchronously, once the hero module
    // signals ready — the QA assertion needs "show" logged BEFORE
    // "h1" (SIGNATURE-MOMENTS.md's ["house","work","show","h1",
    // "curtain"] order), and two children at the exact same GSAP
    // timeline position have no guaranteed cross-timeline firing
    // order. A 10ms nudge (imperceptible; the spec does not assert an
    // exact h1 start time, only the __arrivalLog sequence) makes that
    // order deterministic instead of a same-tick race.
    var HEADLINE_AT = 1.06;
    var HEADLINE_STAGGER = 0.14;
    var headlineEls = [
      document.querySelector(".hero .hero-text > .kicker"),
      document.querySelector(".hero .hero-content h1"),
      document.querySelector(".hero .hero-content p:not(.kicker)"),
    ].filter(Boolean);
    Array.prototype.forEach.call(headlineEls, function (el, i) {
      arrivalTimeline.call(
        function () {
          el.classList.add("v3-reveal-in-view");
          window.requestAnimationFrame(function () {
            el.removeAttribute("data-reveal");
          });
          if (i === 0) logArrivalBeat("h1");
        },
        null,
        HEADLINE_AT + i * HEADLINE_STAGGER
      );
    });

    // Beat E — the curtain. clip-path inset(0 0 0 0) (fully covering)
    // to inset(0 0 100% 0) (fully lifted, revealed from the top),
    // 0.5s, starting 1.45s — 0.40s after beat D starts, so per the
    // spec's own reasoning the curtain lifts on a headline already
    // composing. Logged at completion (not start): assertion 2 needs
    // the curtain's END timestamp, and logging only once here keeps
    // __arrivalLog's name sequence exactly 5 long (assertion 1).
    var loaderEl = document.getElementById("v3-loader");
    var logoWillChangeEls = []; // populated below by the LOGO WIRING block,
                                 // read here so will-change comes off the
                                 // instant this SAME unchanged curtain ends.
    if (loaderEl) {
      arrivalTimeline.set(loaderEl, { clipPath: "inset(0 0 0 0)" }, 0);
      arrivalTimeline.to(
        loaderEl,
        {
          clipPath: "inset(0 0 100% 0)",
          duration: 0.5,
          ease: "power2.inOut",
          onComplete: function () {
            loaderEl.setAttribute("hidden", "");
            logArrivalBeat("curtain");
            logoWillChangeEls.forEach(function (el) {
              el.style.willChange = "";
            });
          },
        },
        1.45
      );
    }

    /* ==========================================================
       LOGO WIRING, 25 Sep 2026 — LOGO-MOTION.md (a), "First-visit
       loader". Added onto this SAME arrivalTimeline, at NEW absolute
       positions 0s to 1.224s, alongside (never instead of) Moment 1's
       own house(0)/work(0.4)/show(1.05)/h1(1.06)/curtain(1.45) beats
       above, which nothing in this block moves. The 14 tiles assemble
       in data-order sequence (stem end to plug), snap ease, 28ms
       apart; the plug follows a 90ms pause; the two word lines (RED
       BANANA, then the tagline 40ms later) blur in; the assembled
       mark then simply holds, fully visible, until beat E's own
       unchanged curtain (1.45-1.95s) lifts it away. A SEPARATE log,
       window.V3.__logoAssemblyLog (not __arrivalLog — Moment 1's own
       QA asserts __arrivalLog is exactly 5 entries long, and this
       block must not touch that), records each beat for QA per
       LOGO-MOTION.md (f). ========================================== */
    var loaderTileEls = loaderEl
      ? Array.prototype.slice
          .call(loaderEl.querySelectorAll(".loader-tiles rect[data-order]"))
          .sort(function (a, b) {
            return (+a.dataset.order) - (+b.dataset.order);
          })
      : [];
    var loaderPlugEl = loaderEl ? loaderEl.querySelector(".loader-plug") : null;
    var loaderWord1El = loaderEl ? loaderEl.querySelector(".loader-word1") : null;
    var loaderWord2El = loaderEl ? loaderEl.querySelector(".loader-word2") : null;

    if (loaderEl && loaderTileEls.length === 14 && loaderPlugEl && loaderWord1El && loaderWord2El) {
      window.V3 = window.V3 || {};
      window.V3.__logoAssemblyLog = window.V3.__logoAssemblyLog || [];
      function logLogoBeat(name) {
        window.V3.__logoAssemblyLog.push({ name: name, t: performance.now() });
      }

      var TILE_GAP = 0.028; // 28ms apart, spec-exact

      // Tiles and plug: driven by a CSS @keyframes animation (v3.css's
      // v3-tile-snap-in, transform:scale(0)->scale(1)+opacity, snap ease),
      // triggered by adding .is-in at each beat's exact timeline position
      // via arrivalTimeline.call() -- NOT a GSAP .to() tween on these
      // elements directly. Found live, reproduced in isolation outside
      // this page: GSAP 3.13's scale+transformOrigin tween on more than
      // one SVG geometry element sharing a transformed parent <g>
      // collapses ALL of them to the SAME rendered bounding box (every
      // tile lands on top of tile-14's position) -- confirmed with
      // gsap.to(), svgOrigin, transformOrigin, with and without the
      // parent transform, timeline or independent tweens, all identical
      // wrong result; gsap.set() and plain CSS animation both render
      // each tile at its own correct position. CSS keyframes give the
      // exact same transform/opacity-only motion the spec asks for
      // without going anywhere near the buggy code path. GSAP still
      // owns every beat's TIMING (the .call() below), only the actual
      // scale/opacity interpolation moves to CSS.
      logoWillChangeEls = loaderTileEls.concat([loaderPlugEl]);
      arrivalTimeline.call(
        function () {
          logoWillChangeEls.forEach(function (el) {
            el.style.willChange = "transform, opacity";
          });
        },
        null,
        0
      );

      loaderTileEls.forEach(function (tile, i) {
        var at = i * TILE_GAP; // tile-1 at 0, tile-14 at 0.364 (+0.18 dur = 0.544 end)
        arrivalTimeline.call(
          function () {
            tile.classList.add("is-in");
            logLogoBeat("tile-" + (i + 1));
          },
          null,
          at
        );
      });

      var PLUG_AT = 0.634; // 544ms tiles end + 90ms pause, spec-exact
      arrivalTimeline.call(
        function () {
          loaderPlugEl.classList.add("is-in");
          logLogoBeat("plug");
        },
        null,
        PLUG_AT
      );

      var WORD1_AT = 0.884;
      arrivalTimeline.to(loaderWord1El, { opacity: 1, filter: "blur(0px)", duration: 0.26, ease: "power2.out" }, WORD1_AT);
      arrivalTimeline.call(function () { logLogoBeat("word-1"); }, null, WORD1_AT);

      var WORD2_AT = 0.924; // 40ms after word line 1, spec-exact
      arrivalTimeline.to(loaderWord2El, { opacity: 1, filter: "blur(0px)", duration: 0.26, ease: "power2.out" }, WORD2_AT);
      arrivalTimeline.call(function () { logLogoBeat("word-2"); }, null, WORD2_AT);
      // Hold: 1.184s to 1.224s, nothing further scheduled — the mark simply
      // sits assembled until beat E's own curtain (1.45s) takes over.
    }

    window.setTimeout(playArrivalIfReady, 600); // grace, spec-exact
  }

  window.V3 = window.V3 || {};
  window.V3.__arrivalLog = window.V3.__arrivalLog || [];
  window.V3.arrivalTimeline = arrivalTimeline;
  window.V3.onArrival = function (fn) {
    arrivalHeroReady = true;
    if (arrivalTimeline && typeof fn === "function") fn(arrivalTimeline);
    playArrivalIfReady();
  };

  /* ============================================================
     Apply the default reveal to every slot's headings and paragraphs,
     so the composed page already moves before a lane attaches its own
     motion. Each [data-slot] section gets its own ScrollTrigger
     (trigger = the section itself) so headings/paragraphs inside a
     tall pinned section (slot 2) still fire against that section's
     own entry, not the page top.
     Hero's own .hero-text kicker/h1/p are EXCLUDED here (CLOSER fix,
     24 Sep) — they are now owned by the arrival timeline's beat D
     above, synced to the curtain/lighting instead of firing on
     whichever of DOMContentLoaded/fonts-ready happens to run first;
     double-revealing the same elements from two independent systems
     would race unpredictably.
     ============================================================ */
  function revealSlotDefaults() {
    var slots = document.querySelectorAll("[data-slot]");
    Array.prototype.forEach.call(slots, function (section) {
      // Any h1/h2/h3/p ANYWHERE inside the slot's .inner wrapper, not
      // only its direct children — e.g. the hero nests its heading a
      // level deeper inside .hero-content. Excludes .kicker on
      // purpose below via a separate, identical pass so both end up
      // revealed the same way without double-selecting anything.
      var rawTargets = section.querySelectorAll(
        ".inner h1, .inner h2, .inner h3, .inner p, .inner .kicker, " +
        ".v3-reveal-default"
      );
      var targets = Array.prototype.filter.call(rawTargets, function (el) {
        return !el.closest(".hero-text");
      });
      if (!targets.length) return;
      Array.prototype.forEach.call(targets, function (el) {
        el.setAttribute("data-reveal", "");
      });
      reveal(targets, { trigger: section, start: "top 80%" });
    });
  }

  /* ============================================================
     FIRST-VISIT LOADER — sessionStorage flag, 2.1s max, never blocks
     on repeat visits within the same session.
     ============================================================ */
  function runLoader() {
    var loaderEl = document.getElementById("v3-loader");
    if (!loaderEl) return;

    var seen = false;
    try {
      seen = sessionStorage.getItem("v3-visited") === "1";
    } catch (e) {
      // sessionStorage unavailable (private mode, disabled storage):
      // treat every load as a repeat visit rather than block on it.
      seen = true;
    }

    if (seen) {
      loaderEl.setAttribute("hidden", "");
      return;
    }

    if (REDUCED) {
      // LOGO-MOTION.md (a) "Reduced motion": no tile keyframes, the static
      // assembled lockup (v3.css's html.reduced-motion rest state already
      // renders every tile/plug/word at its final frame) shown for 600ms,
      // then hidden -- LOGO WIRING fix, 25 Sep: this branch previously
      // hid the loader synchronously alongside `seen`, so a reduced-motion
      // first visit never saw the mark at all. Scoped to the loader only;
      // no Moment 1 beat is touched by this change.
      try { sessionStorage.setItem("v3-visited", "1"); } catch (e) {}
      window.setTimeout(function () {
        loaderEl.style.opacity = 0;
        window.setTimeout(function () {
          loaderEl.setAttribute("hidden", "");
        }, 500);
      }, 600);
      return;
    }

    try { sessionStorage.setItem("v3-visited", "1"); } catch (e) {}

    var MAX_MS = 2100; // hard ceiling, unchanged value, see below
    var done = false;
    function forceHide() {
      if (done) return;
      done = true;
      loaderEl.style.opacity = 0;
      window.setTimeout(function () {
        loaderEl.setAttribute("hidden", "");
      }, 500);
    }

    if (arrivalTimeline) {
      // CLOSER fix, 24 Sep: beat E (added above, on arrivalTimeline)
      // now owns the ordinary hide -- a synced clip-path curtain, not
      // a flat opacity fade -- so `done` is normally set by ITS OWN
      // onComplete, not this function. MAX_MS survives as an
      // unconditional safety net only: the loader must never still
      // be covering the page 2100ms after this ran, even in the
      // worst-case timing described where playArrivalIfReady() is
      // itself delayed close to its own 600ms grace limit. An abrupt
      // cut here (not a graceful curtain-complete) is an accepted,
      // documented trade-off for that specific slow-hero edge case.
      window.setTimeout(function () {
        if (loaderEl.hasAttribute("hidden")) { done = true; return; }
        forceHide();
      }, MAX_MS);
    } else {
      // Degraded path: no gsap, or reduced motion already returned
      // above -- nothing will ever call playArrivalIfReady(), so this
      // is the ONLY thing that hides the loader. Same flat-fade
      // behaviour the loader always had before this fix.
      window.setTimeout(forceHide, MAX_MS);
      window.addEventListener("load", function () {
        window.setTimeout(forceHide, 300);
      });
    }
  }

  /* ============================================================
     NAV HIDE ON SCROLL DOWN, above 992px only.
     ============================================================ */
  function wireNavHide() {
    var nav = document.querySelector(".v3-nav");
    if (!nav) return;
    var lastY = window.scrollY || 0;
    var ticking = false;

    function onScroll() {
      if (window.innerWidth <= 992) {
        nav.classList.remove("is-hidden");
        ticking = false;
        return;
      }
      var y = (lenis ? lenis.scroll : window.scrollY) || window.scrollY || 0;
      if (y > lastY && y > 120) {
        nav.classList.add("is-hidden");
      } else {
        nav.classList.remove("is-hidden");
      }
      lastY = y;
      ticking = false;
    }

    function request() {
      if (!ticking) {
        window.requestAnimationFrame(onScroll);
        ticking = true;
      }
    }

    if (lenis) {
      lenis.on("scroll", request);
    } else {
      window.addEventListener("scroll", request, { passive: true });
    }
    window.addEventListener("resize", request, { passive: true });
  }

  /* ============================================================
     WORDMARK RIPPLE — LOGO-MOTION.md (b), all eight pages.
     One class, .is-live, set on the <a class="wordmark"> by BOTH
     pointer hover and :focus-visible (contract law 2), styled once
     in v3.css (.wordmark.is-live .wordmark-tiles rect[data-order]).
     Re-triggers the CSS animation on each fresh entry by removing
     and re-adding the class on the next frame, since re-adding an
     already-present class does not restart a running CSS animation.
     ============================================================ */
  function wireWordmarkRipple() {
    var marks = document.querySelectorAll(".v3-nav .wordmark");
    if (!marks.length) return;

    Array.prototype.forEach.call(marks, function (mark) {
      function enter() {
        mark.classList.remove("is-live");
        // eslint-disable-next-line no-unused-expressions
        void mark.offsetWidth; // force reflow so the removal is committed
        mark.classList.add("is-live");
      }
      function leave() {
        mark.classList.remove("is-live");
      }
      mark.addEventListener("mouseenter", enter);
      mark.addEventListener("mouseleave", leave);
      mark.addEventListener("focus", enter);
      mark.addEventListener("blur", leave);
    });
  }

  /* ============================================================
     WORDMARK SCROLL-COLLAPSE — LOGO-MOTION.md (b), index.html only.
     "Past the hero the name collapses to width 0 leaving the mark."
     Gated on the presence of .hero: only index.html has one, so
     interior pages (which keep the full lockup per the brief) never
     get the .is-past-hero class at all, with zero per-page branching.
     clip-path/opacity only (v3.css's .wordmark-word-wrap rule); the
     nav bar's own width never changes, only the text group's clip.
     ============================================================ */
  function wireWordmarkCollapse() {
    var hero = document.querySelector(".hero");
    var nav = document.querySelector(".v3-nav");
    if (!hero || !nav) return;

    var ticking = false;
    function onScroll() {
      var heroBottom = hero.getBoundingClientRect().bottom;
      nav.classList.toggle("is-past-hero", heroBottom <= 0);
      ticking = false;
    }
    function request() {
      if (!ticking) {
        window.requestAnimationFrame(onScroll);
        ticking = true;
      }
    }

    if (lenis) {
      lenis.on("scroll", request);
    } else {
      window.addEventListener("scroll", request, { passive: true });
    }
    window.addEventListener("resize", request, { passive: true });
    onScroll();
  }

  /* ============================================================
     MENU — stops Lenis while open.

     A11Y FIX defect 3 / "Defect 3" (RB-V3-QA-A11Y.md, "serious",
     WCAG 2.1.1 / 2.4.3): confirmed on all 7 pages, DOM order is
     <nav id="primary-nav"> BEFORE <button class="v3-menu-toggle">
     (e.g. index.html:136-141). That is correct for the CLOSED nav
     (Tab should skip past hidden links straight to the toggle) but
     breaks the OPEN nav: once a keyboard user activates the toggle,
     the four now-visible links sit earlier in tab order than the
     toggle that just took focus, so the next Tab press cannot reach
     them -- it escapes forward into <main> instead (verified live,
     390x844: Tab from the just-opened toggle lands on "Discuss your
     project" inside <main>, not "Capabilities"). Per the worker
     brief, HTML markup may only be touched if a colour token can't
     fix a defect -- not applicable to a DOM-order bug -- so this is
     fixed in script per the audit's own alternative: "move focus
     programmatically into the first nav link on open" plus a real Tab
     trap ([links..., toggle], in existing DOM order) so forward Tab
     from the toggle wraps to the first link instead of escaping, and
     Escape closes the menu and returns focus to the toggle.
     ============================================================ */
  function wireMenu() {
    var toggle = document.querySelector(".v3-menu-toggle");
    var links = document.querySelector(".v3-nav-links");
    if (!toggle || !links) return;

    function focusableLinks() {
      return Array.prototype.slice.call(links.querySelectorAll("a"));
    }

    var header = toggle.closest(".v3-nav");

    function openMenu() {
      links.classList.add("is-open");
      if (header) header.classList.add("is-menu-open"); // fix C1, see v3.css
      toggle.setAttribute("aria-expanded", "true");
      toggle.textContent = "Close";
      if (lenis) lenis.stop();
      document.body.style.overflow = "hidden";
      var first = focusableLinks()[0];
      if (first) first.focus();
    }

    function closeMenu(restoreFocus) {
      links.classList.remove("is-open");
      if (header) header.classList.remove("is-menu-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.textContent = "Menu";
      if (lenis) lenis.start();
      document.body.style.overflow = "";
      if (restoreFocus) toggle.focus();
    }

    toggle.addEventListener("click", function () {
      if (links.classList.contains("is-open")) closeMenu(false);
      else openMenu();
    });

    // Closing via a nav link click also restarts Lenis.
    links.addEventListener("click", function (e) {
      if (e.target.tagName === "A" && links.classList.contains("is-open")) {
        closeMenu(false);
      }
    });

    // Trap Tab within [links..., toggle] (existing DOM order) while the
    // menu is open; Escape closes and returns focus to the toggle.
    document.addEventListener("keydown", function (e) {
      if (!links.classList.contains("is-open")) return;
      if (e.key === "Escape" || e.key === "Esc") {
        closeMenu(true);
        return;
      }
      if (e.key !== "Tab") return;
      var items = focusableLinks();
      var first = items[0];
      var last = toggle; // toggle sits last in DOM order, after the links
      if (!first) return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
  }

  /* ============================================================
     window.V3.onSlotReady(name, fn) — lanes register a callback that
     fires once DOMContentLoaded has run AND the named [data-slot] is
     present. Fires synchronously if both are already true (a lane's
     script tag loaded after DOMContentLoaded).
     ============================================================ */
  var domReady = false;
  var pendingSlotCallbacks = [];

  function tryRunSlotCallback(entry) {
    var section = document.querySelector('[data-slot="' + entry.name + '"]');
    if (domReady && section) {
      entry.fn(section);
      return true;
    }
    return false;
  }

  function onSlotReady(name, fn) {
    var entry = { name: name, fn: fn };
    if (!tryRunSlotCallback(entry)) {
      pendingSlotCallbacks.push(entry);
    }
  }

  function flushPendingSlotCallbacks() {
    pendingSlotCallbacks = pendingSlotCallbacks.filter(function (entry) {
      return !tryRunSlotCallback(entry);
    });
  }

  /* ============================================================
     Reduced motion: disable every ScrollTrigger-driven pin/scrub once
     the plugin is loaded, so a lane's own pinned scene (contract:
     sections 2 and, if used, 7 only) cannot run under reduced motion
     either, even if a lane forgets to check REDUCED itself.
     ============================================================ */
  function disableScrollTriggersIfReduced() {
    if (!REDUCED || !HAS_SCROLLTRIGGER) return;
    ScrollTrigger.getAll().forEach(function (st) { st.disable(); });
    // A lane may still create triggers after this runs (async scene
    // load); re-sweep once more shortly after load as a safety net.
    window.addEventListener("load", function () {
      window.setTimeout(function () {
        ScrollTrigger.getAll().forEach(function (st) { st.disable(); });
      }, 500);
    });
  }

  /* ============================================================
     Moment 7 footer memory-release hook (SIGNATURE-MOMENTS.md, "The
     scene is released here"). CHAPTERS lane's WIRING.md block flagged
     that its own files (assets/js/v3-chapters.js) build the footer's
     visual moment but deliberately do not call heroController.destroy()
     or touch this file -- that call belongs here, per the spec's own
     "The destroy() call is INTEGRATOR's, in v3-core.js" line. Naming,
     confirmed against the live global (not the spec's own
     "window.V3.hero.destroy()", which does not exist anywhere in this
     tree): window.V3.heroController. IntersectionObserver threshold
     0.98-1.0 matches Moment 7's "fully in view"; fires once via the
     released flag.

     AMENDED per the Director's round2 ruling (24 Sep): this used to
     call heroController.destroy() directly, on the assumption (wrong —
     no such thing existed anywhere in the hero lane) that "scroll-back-
     up re-init is the HERO LANE's own existing IO gate." What that IO
     gate actually does is pause/resume the render LOOP; destroy() also
     disposes the renderer and force-loses the WebGL context, which
     the loop's own IO gate has no way to undo. Round2's
     round2-final-section-hero.png caught the result live: a solid
     white rectangle over the object on return to the hero, reproduced
     on headed/DISPLAY=:0 Chromium too, not just this sandbox. Root
     cause (see v3-hero.js's releaseAtFooter() comment): the canvas is
     opaque (alpha:false); a context-lost opaque canvas's pixel
     contents are undefined by spec and this GPU paints them white,
     hiding the still-fine poster underneath.

     Fix: this hook now calls releaseAtFooter() (loop-stop only, no
     context loss) instead of destroy(). The real destroy() moves to
     a genuine pagehide listener below, so the GPU context is freed
     exactly when the amended ruling says it should be -- when the
     page is actually going away -- and never while the visitor might
     still scroll back up to look at the object again.
     ============================================================ */
  function wireFooterHeroRelease() {
    var footerEl = document.getElementById("footer-statement");
    if (!footerEl || !("IntersectionObserver" in window)) return;
    var released = false;
    new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.98 && !released) {
          released = true;
          if (window.V3.heroController && typeof window.V3.heroController.releaseAtFooter === "function") {
            window.V3.heroController.releaseAtFooter();
          }
        }
      });
    }, { threshold: [0.98, 1.0] }).observe(footerEl);
  }

  /* Real, full teardown -- forceContextLoss() included -- fires only
     here, on pagehide (covers tab close, navigation away and mobile
     Safari's backgrounding, which never fires "unload"). Not "unload":
     that event is deprecated, blocks bfcache, and pagehide already
     covers every case unload would. */
  function wireHeroPagehideDestroy() {
    window.addEventListener("pagehide", function () {
      if (window.V3.heroController && typeof window.V3.heroController.destroy === "function") {
        window.V3.heroController.destroy();
      }
    });
  }

  window.V3 = window.V3 || {};
  window.V3.reveal = reveal;
  window.V3.lenis = lenis;
  window.V3.reducedMotion = REDUCED;
  window.V3.onSlotReady = onSlotReady;

  /* ============================================================
     Self-hosted webfonts (font-display: swap) finishing AFTER the
     reveal tweens are created was leaving above-the-fold elements
     (the hero, always in view at load) stuck at inconsistent PARTIAL
     transform values — each staggered element's yPercent/blur tween
     got interrupted at a different point once fallback-font metrics
     were replaced by the real font's metrics mid-flight, rather than
     cleanly reaching its end state. Patching this after the fact with
     ScrollTrigger.refresh() did not reliably resolve already-partial
     tweens. The robust fix is to not create the reveal triggers until
     document.fonts.ready has resolved in the first place, so the very
     first measurement already uses final layout — matching the
     well-documented GSAP/ScrollTrigger guidance to gate scroll-driven
     setup on fonts being ready. A 1200ms cap means a slow or failed
     font load never blocks the reveal forever.
     ============================================================ */
  function whenFontsReady(fn) {
    if (!document.fonts || !document.fonts.ready) { fn(); return; }
    var done = false;
    function once() { if (done) return; done = true; fn(); }
    document.fonts.ready.then(once);
    window.setTimeout(once, 1200);
  }

  /* ============================================================
     SKIP LINK — A11Y FIX defect 6 (RB-V3-QA-A11Y.md "Gap", medium
     severity). Confirmed on all 7 pages: activating the skip-link
     correctly updates location.hash and the very next Tab correctly
     resumes inside <main> (Chromium's sequential-navigation cursor
     moves), but document.activeElement stayed <body> the whole time --
     real DOM focus never lands on <main>/<main-content>, so a screen
     reader never announces arrival. Standard fix: give the target a
     programmatic tabindex and focus() it ourselves (bare anchors don't
     move focus to a non-focusable target on their own). index.html's
     target is #main, the six interior pages use #main-content -- this
     reads the skip-link's own href so one function covers both.
     tabindex="-1" only enables .focus(); it does not add the target to
     the Tab sequence, so nothing else about tab order changes.
     ============================================================ */
  function wireSkipLink() {
    var skip = document.querySelector(".skip-link");
    if (!skip) return;
    skip.addEventListener("click", function () {
      var href = skip.getAttribute("href");
      if (!href || href.charAt(0) !== "#") return;
      var target = document.querySelector(href);
      if (!target) return;
      if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
      target.focus();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    domReady = true;
    runLoader();
    wireNavHide();
    wireWordmarkRipple();
    wireWordmarkCollapse();
    wireMenu();
    wireSkipLink();
    wireFooterHeroRelease();
    wireHeroPagehideDestroy();
    disableScrollTriggersIfReduced();
    flushPendingSlotCallbacks();
    whenFontsReady(function () {
      revealSlotDefaults();
      if (HAS_SCROLLTRIGGER) ScrollTrigger.refresh();
    });
  });
})();
