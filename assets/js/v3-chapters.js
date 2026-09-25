/*
 * v3-chapters.js — Red Banana v3 "THE OBJECT", CHAPTERS LANE.
 * Contract: redesign-2026/RB-V3-DIRECTION-CONTRACT.md §7. Creative
 * spec: redesign-2026/rb-v3/SIGNATURE-MOMENTS.md, Moment 5 (the three
 * photo chapters) and Moment 7 (the last beat, #footer-statement).
 * Motion law §5. Companion file: assets/css/v3-chapters.css.
 *
 * OWNERSHIP: this file and v3-chapters.css are the CHAPTERS LANE's
 * only files. This lane never edits index.html, v3.css or
 * v3-core.js — integration/hook needs are appended to parts/WIRING.md
 * instead (see that file's "CHAPTERS lane" block for the
 * destroy-hero-on-footer-visible hook this file does NOT create
 * itself).
 *
 * SCOPE NOTE on case-study and replicas (slots 6/7): SIGNATURE-
 * MOMENTS.md names these as plain sections between the two signature
 * moments, not moments of their own. Their kicker/h2/body-paragraph
 * copy already gets v3-core.js's default blur/yPercent/opacity reveal
 * (revealSlotDefaults() selects every ".inner h1/h2/h3/p/.kicker",
 * and both sections' copy sits inside ".inner"). The tombstone <dl>,
 * .stat-row and the two <figure>/<picture> elements are not p/h2/h3
 * so they render statically (always visible, correctly styled, never
 * clipped or hidden) rather than animated — a real, considered gap in
 * choreography, not a broken section. This lane adds no JS for either
 * slot; see the CHAPTERS LANE report for this judgement stated
 * explicitly, as the brief requires.
 */
(function () {
  "use strict";

  /* ============================================================
     TORQUE EASES — SIGNATURE-MOMENTS.md "Easing set". Same Newton-
     Raphson cubic-bezier solver the HERO LANE already used
     (assets/js/v3-hero.js) for the same reason: CustomEase is not in
     this site's vendored motion kit, and GSAP accepts any
     function(progress) as an ease. Only `out` and `snap` are used in
     this lane's two moments.
     ============================================================ */
  function cubicBezierEase(x1, y1, x2, y2) {
    function bezierComponent(t, p1, p2) {
      var mt = 1 - t;
      return 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t;
    }
    function bezierDerivative(t, p1, p2) {
      var mt = 1 - t;
      return 3 * mt * mt * p1 + 6 * mt * t * (p2 - p1) + 3 * t * t * (1 - p2);
    }
    return function (t) {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      var x = t;
      for (var i = 0; i < 8; i++) {
        var currentX = bezierComponent(x, x1, x2) - t;
        var derivative = bezierDerivative(x, x1, x2);
        if (Math.abs(derivative) < 1e-6) break;
        x -= currentX / derivative;
        x = Math.min(1, Math.max(0, x));
      }
      return bezierComponent(x, y1, y2);
    };
  }
  var TORQUE = {
    out: cubicBezierEase(0.16, 1, 0.3, 1),
    snap: cubicBezierEase(0.34, 1.56, 0.64, 1),
  };

  var HAS_GSAP = typeof window.gsap !== "undefined";
  var HAS_SCROLLTRIGGER = HAS_GSAP && typeof window.ScrollTrigger !== "undefined";
  var HAS_SPLITTYPE = typeof window.SplitType !== "undefined";

  /* ============================================================
     MOMENT 5 — the three photo chapters
     ============================================================ */
  function initPhotoChapters(section) {
    var REDUCED = !!(window.V3 && window.V3.reducedMotion);
    var articles = section.querySelectorAll(".photo-chapter");

    Array.prototype.forEach.call(articles, function (article) {
      var img = article.querySelector("picture img");
      var line = article.querySelector(".chapter-line");
      if (!line) return;

      /* Reparent rule + line into one wrapper, .chapter-rule
         injected fresh (aria-hidden, decorative only — Moment 5:
         "The rule does not exist without JS, which is correct: it is
         decoration"). A wrapper positioned only by `bottom` lets the
         rule sit exactly above the caption regardless of how many
         lines the caption wraps to, instead of guessing a pixel
         offset for captions of very different lengths (chapter one's
         sentence is roughly 4x chapter three's). */
      var tomb = document.createElement("div");
      tomb.className = "chapter-tombstone";
      var rule = document.createElement("div");
      rule.className = "chapter-rule";
      rule.setAttribute("aria-hidden", "true");
      line.parentNode.insertBefore(tomb, line);
      tomb.appendChild(rule);
      tomb.appendChild(line);

      if (!HAS_GSAP) {
        // Defensive fallback matching v3-core.js's own reveal(): if
        // gsap failed to load, force visibility explicitly so
        // .chapter-line (which carries [data-reveal] in the markup)
        // never sticks at v3.css's CSS-only hidden rest state.
        line.style.opacity = 1;
        line.style.filter = "none";
        line.style.transform = "none";
        line.style.clipPath = "none";
        return;
      }

      if (REDUCED) {
        // Moment 5, reduced motion: "Images at yPercent 0, scale 1.
        // Rules at full width and 0.25 opacity, drawn by CSS, no
        // tween [handled by html.reduced-motion .chapter-rule in
        // v3-chapters.css]. Lines at rest state, fully visible." No
        // clip-path/yPercent hidden state is ever applied to `line`
        // in this branch, so it stays in ordinary flow, fully
        // visible, needing no override here.
        // line/rule's rest and reduced-motion states now both live in
        // v3-chapters.css (see its reduced-motion block), so no
        // gsap.set is needed for them here any more; the image
        // parallax reset below is unaffected (a different mechanism)
        // and still applies.
        if (img) gsap.set(img, { yPercent: 0, scale: 1 });
        return;
      }

      /* ---- Parallax + settle scale, scrubbed (Law 1: geometry is
         scrubbed). 118% height is set in v3-chapters.css and is
         unchanged. The yPercent RANGE below is corrected from the
         spec's original -9/+9: GSAP's yPercent moves an element by a
         percentage of its OWN height, and this image's own height is
         118% of its container, so a literal yPercent 9 translates by
         9% x 118% = 10.62% of the container — 1.62 points past the
         9%-of-container margin the 118%/100% overflow actually
         leaves, exposing ground at both scroll extremes. Bob's
         correction (routed through the Director, after this lane
         flagged the arithmetic in its first report): 9 / 1.18 =
         7.627%, rounded to 7.6, so 7.6% of 118% = 8.968% of
         container — inside the 9% margin. SIGNATURE-MOMENTS.md has
         been corrected to match (a note after the original "9% of
         118%" paragraph, plus QA assertion 2) — this lane's number
         below now matches that corrected spec. */
      if (img && HAS_SCROLLTRIGGER) {
        gsap.fromTo(
          img,
          { yPercent: -7.6, scale: 1.06 },
          {
            yPercent: 7.6,
            scale: 1.0,
            ease: "none",
            scrollTrigger: {
              trigger: article,
              start: "top bottom",
              end: "bottom top",
              scrub: 1,
            },
          }
        );
      }

      /* ---- Tombstone reveal, triggered not scrubbed (Law 1: words
         are triggered).
         FIX (this lane's own defect, found and reported by the
         v3-core.js worker after fixing the site-wide stuck-reveal bug
         in commit 9edc52a, confirmed here by reproduction): this used
         to be a gsap.timeline() tweening clip-path/yPercent directly,
         attached via scrollTrigger's toggleActions "play none none
         reverse" — the exact shape v3-core.js's reveal() primitive
         used to use before that same bug was found and fixed there.
         A below-fold trigger's cached start/end can go stale (fonts,
         the hero's async GLB/poster and below-fold images all keep
         shifting section positions after ScrollTrigger's first
         refresh), and a real scroll can cross that stale boundary
         twice in quick succession — play()'d then reverse()'d,
         sometimes within one frame — leaving the SAME tween's
         yPercent-driven transform stuck at a partial value even
         though clip-path/opacity land clean. Reproduced live here,
         independently of v3-core.js (this tween never went through
         window.V3.reveal()): all three chapter-line captions stuck at
         yPercent 40's equivalent transform (matrix ty ~91.5px) after
         a fast scroll past the section and back.

         Fix, same principle as v3-core.js's: stop tweening
         clip-path/transform via GSAP. The hidden/visible states and
         the transition itself are now plain CSS
         (v3-chapters.css .chapter-rule/.chapter-line rest state and
         the .photo-chapter.is-revealed override, including the old
         timeline's 0 / 0.18s / 0.9s stagger reproduced as per-property
         transition-delay). This bare ScrollTrigger.create() — no
         tween attached, so nothing for a rapid enter/leaveBack pair to
         interrupt mid-flight — just toggles .is-revealed on the
         article; the CSS transition (browser-native, not GSAP) does
         the animating. ---- */
      // line still carries [data-reveal] from the raw markup (used
      // only as the no-JS/reduced-motion fallback hook now — see the
      // CSS comment above). tests/settled-state.test.mjs audits every
      // [data-reveal] element site-wide and expects the attribute
      // itself to come off once an element is genuinely settled
      // (mirroring v3-core.js reveal()'s showList/hideList), so this
      // toggles it in step with .is-revealed rather than leaving it
      // in place — a stale attribute on a visually-settled element is
      // exactly the "attribute/style link broken" shape that test is
      // built to catch, per Bob's "an instrument that cannot fail"
      // standing rule.
      function showLine() {
        article.classList.add("is-revealed");
        line.removeAttribute("data-reveal");
      }
      function hideLine() {
        article.classList.remove("is-revealed");
        line.setAttribute("data-reveal", "");
      }
      if (!HAS_SCROLLTRIGGER) {
        showLine();
      } else {
        ScrollTrigger.create({
          trigger: article,
          start: "top 78%",
          onEnter: showLine,
          onLeaveBack: hideLine,
        });
      }
    });
  }

  /* ============================================================
     MOMENT 7 — the last beat (#footer-statement)
     ============================================================ */
  function initFooterMoment(section) {
    var REDUCED = !!(window.V3 && window.V3.reducedMotion);
    var h2 = section.querySelector(".foot-grid h2");
    var ctaRow = section.querySelector(".cta-row");
    var primaryBtn = section.querySelector(".btn-primary");

    /* ---- Radial glow layer, "centred on the h2" ---- */
    var glow = document.createElement("div");
    glow.className = "footer-glow";
    glow.setAttribute("aria-hidden", "true");
    section.insertBefore(glow, section.firstChild);
    if (h2) {
      var fRect = section.getBoundingClientRect();
      var hRect = h2.getBoundingClientRect();
      if (fRect.width && fRect.height) {
        var gx = ((hRect.left + hRect.width / 2 - fRect.left) / fRect.width) * 100;
        var gy = ((hRect.top + hRect.height / 2 - fRect.top) / fRect.height) * 100;
        section.style.setProperty("--glow-x", gx.toFixed(2) + "%");
        section.style.setProperty("--glow-y", gy.toFixed(2) + "%");
      }
    }

    if (!HAS_GSAP) {
      // Scripts-off floor / gsap failed to load: the footer is
      // "complete, plain and fully linked" already, by construction
      // — no [data-reveal] on this slot's h2/p/cta-row, so nothing
      // needs to be forced visible here.
      return;
    }

    /* ---- Ground-darkening scrub + glow falloff ---- */
    if (HAS_SCROLLTRIGGER && !REDUCED) {
      gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top 85%",
          end: "top 25%",
          scrub: 1,
        },
      })
        .to(section, { backgroundColor: "#000000", ease: "none" }, 0)
        .to(glow, { opacity: 0.06, ease: "none" }, 0);
    }

    /* ---- SplitText (this site's vendored equivalent is SplitType,
       split-type.min.js — the same "use what's actually vendored"
       call the HERO LANE made for CustomEase), the site's second and
       last such use per contract §8 A5. Reduced motion: "SplitType is
       never invoked... the original markup stands untouched" — the
       guard below covers the split itself and every tween derived
       from it, including the buttons' arrival, which this moment
       times off the second line. ---- */
    if (!REDUCED && HAS_SPLITTYPE && h2) {
      var split = new SplitType(h2, { types: "lines" });
      var inners = [];
      split.lines.forEach(function (lineEl) {
        var inner = document.createElement("span");
        inner.className = "footer-line-inner";
        while (lineEl.firstChild) inner.appendChild(lineEl.firstChild);
        lineEl.appendChild(inner);
        inners.push(inner);
      });

      gsap.set(inners, { yPercent: 110, filter: "blur(5px)", opacity: 0 });
      if (ctaRow) gsap.set(ctaRow, { yPercent: 20, filter: "blur(5px)", opacity: 0 });

      var LINE_DURATION = 0.86;
      var LINE_STAGGER = 0.12;
      // "The two buttons arrive 0.30s after the second line" is read
      // here as 0.30s after the second line's own START (start-to-
      // start), matching the overlapping-beat convention
      // SIGNATURE-MOMENTS.md itself uses throughout Moment 1's beat
      // table (e.g. beat B starts before beat A's duration ends)
      // rather than 0.30s after the second line finishes rising.
      // Stated here as the explicit interpretation of an ambiguous
      // phrase, per this lane's report.
      var secondLineStart = inners.length > 1 ? LINE_STAGGER : 0;
      var buttonsStart = secondLineStart + 0.3;

      var headlineTl = gsap.timeline({
        scrollTrigger: HAS_SCROLLTRIGGER
          ? { trigger: section, start: "top 85%", toggleActions: "play none none reverse" }
          : undefined,
        paused: !HAS_SCROLLTRIGGER,
      });
      headlineTl.to(
        inners,
        {
          yPercent: 0,
          filter: "blur(0px)",
          opacity: 1,
          duration: LINE_DURATION,
          stagger: LINE_STAGGER,
          ease: TORQUE.out,
        },
        0
      );
      if (ctaRow) {
        headlineTl.to(
          ctaRow,
          { yPercent: 0, filter: "blur(0px)", opacity: 1, duration: 0.75, ease: TORQUE.out },
          buttonsStart
        );
      }
      if (!HAS_SCROLLTRIGGER) headlineTl.play();
    }

    /* ---- Magnetic primary button — the one magnetic element on the
       site. Not attached at all under reduced motion. ---- */
    if (!REDUCED && primaryBtn) {
      initMagneticButton(primaryBtn);
    }
  }

  function initMagneticButton(btn) {
    var LAMBDA = 8; // damping rate
    var FACTOR = 0.22; // fraction of pointer offset the button follows
    var CLAMP = 10; // px, magnitude clamp on the follow target
    var targetX = 0,
      targetY = 0,
      curX = 0,
      curY = 0;
    var following = false;
    var lastT = null;
    var releaseTween = null;

    function frame(time) {
      // gsap.ticker's callback receives elapsed time in SECONDS
      // (matching v3-core.js's own `lenis.raf(time * 1000)` usage,
      // which converts this same value to ms for Lenis).
      if (!following) return;
      var dt = lastT === null ? 0 : Math.min(time - lastT, 0.1);
      lastT = time;
      var t = 1 - Math.exp(-LAMBDA * dt);
      curX += (targetX - curX) * t;
      curY += (targetY - curY) * t;
      gsap.set(btn, { x: curX, y: curY });
    }

    function startFollowing() {
      if (releaseTween) {
        releaseTween.kill();
        releaseTween = null;
      }
      if (!following) {
        curX = gsap.getProperty(btn, "x") || 0;
        curY = gsap.getProperty(btn, "y") || 0;
        following = true;
        lastT = null;
        gsap.ticker.add(frame);
      }
    }

    function release() {
      following = false;
      gsap.ticker.remove(frame);
      targetX = 0;
      targetY = 0;
      releaseTween = gsap.to(btn, {
        x: 0,
        y: 0,
        duration: 0.42,
        ease: TORQUE.snap,
        onComplete: function () {
          releaseTween = null;
        },
      });
    }

    btn.addEventListener("pointermove", function (e) {
      // Touch has no hover state to release from; magnetic hover is
      // a pointer/mouse affordance only, so it never engages here.
      if (e.pointerType === "touch") return;
      startFollowing();
      var rect = btn.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      var dx = (e.clientX - cx) * FACTOR;
      var dy = (e.clientY - cy) * FACTOR;
      var mag = Math.sqrt(dx * dx + dy * dy);
      if (mag > CLAMP) {
        var s = CLAMP / mag;
        dx *= s;
        dy *= s;
      }
      targetX = dx;
      targetY = dy;
    });

    btn.addEventListener("pointerleave", release);
    btn.addEventListener("pointercancel", release);
  }

  /* ============================================================
     WIRE-UP — via window.V3.onSlotReady, per parts/SLOTS.md, so this
     file works regardless of its own <script> tag's position
     relative to DOMContentLoaded.
     ============================================================ */
  if (window.V3 && typeof window.V3.onSlotReady === "function") {
    window.V3.onSlotReady("photo-chapters", initPhotoChapters);
    window.V3.onSlotReady("footer-statement", initFooterMoment);
  }
})();
