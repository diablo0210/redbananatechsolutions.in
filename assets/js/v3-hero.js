/*
 * v3-hero.js — Red Banana v3 "THE OBJECT", HERO LANE.
 * Contract: redesign-2026/RB-V3-DIRECTION-CONTRACT.md §3.1/§3.2, amendments
 * §8 (A1 clears the Dancing Girl object; A6 sets the measurement method).
 * Creative spec: redesign-2026/rb-v3/SIGNATURE-MOMENTS.md, Moments 1 (First
 * light), 2 (Why bronze reads as bronze on a phone), 3 (The walk around),
 * plus Moment 7's live-instance counter. Motion law §5.
 *
 * HERO-POLISH pass (24 Sep, this lane replacing the retired hero lane,
 * Bob's screenshot verdict on rb-v3/hero-1440x900.png / hero-390x844.png):
 * fix 1, reflection no longer shows through the plinth's front face
 * (mirrorMaterial depthTest:true + a clip plane raised to the plinth's
 * own top surface + a new dark-glass top plane, see the plinth block
 * below); fix 2, the plinth reads near-black with a faint cool sheen
 * instead of tan (darker/rougher/faintly-metallic material PLUS a
 * narrowed/retargeted key light and a new dedicated plinthFill light,
 * since the colour alone was never the whole bug — the key light's
 * decay:0 spill was); fix 3, composition (autoFitDesktopFraction 62%->
 * 58%, autoFitPhoneFraction 48%->44%, so the head clears the canvas top
 * and the headline's own top third); fix 4, destroy() now also calls
 * renderer.forceContextLoss() for Moment 7. Full numbers in this lane's
 * report for this pass, not duplicated here.
 *
 * OWNERSHIP: this file, assets/css/v3-hero.css and assets/vendor/three/**
 * are the HERO LANE's only files. This lane never edits index.html —
 * integration tags are appended to parts/WIRING.md instead.
 *
 * EXPORTS
 *   initHero(opts) -> controller | null
 *     opts.canvas       HTMLCanvasElement, default: the first
 *                        `[data-slot="hero"] canvas.v3-hero-canvas`.
 *     opts.modelUrl      Draco GLB path. Default: canvas.dataset.model,
 *                        else "assets/models/dancing-girl.glb" — cleared
 *                        for use by contract §8 A1 (dc50284). A 404 still
 *                        degrades to the torus-knot stand-in.
 *     opts.modelLoUrl    Phone GLB. Default: canvas.dataset.modelLo, else
 *                        "assets/models/dancing-girl-lo.glb".
 *     opts.posterUrl     Accepted, unused (poster is a plain <img>, see
 *                        parts/WIRING.md).
 *
 *   controller
 *     .bindScroll(scrollTrigger?)  SIGNATURE-MOMENTS.md Moment 3: called
 *       with NO argument, creates the section 2 pin itself exactly per
 *       spec (trigger #engineering, pin #v3-engineering-pin, end +=250%,
 *       scrub 1, anticipatePin 1, invalidateOnRefresh true) and returns
 *       that ScrollTrigger. Called WITH an argument (an existing
 *       ScrollTrigger), only reads its .progress each frame instead —
 *       kept for back-compat with this lane's own earlier WIRING.md
 *       bootstrap and any other lane that already creates its own pin.
 *     .releaseAtFooter()  Moment 7, amended by the Director's round2
 *       ruling (24 Sep, hero-white-frame fix): stops the render loop
 *       only. Does NOT dispose the renderer or force context loss —
 *       that turned out to paint the canvas opaque white (alpha:false)
 *       over the still-intact poster underneath, on both headless and
 *       real-GPU headed Chromium, the instant the visitor scrolled back
 *       above the engineering section. Call this from the footer
 *       IntersectionObserver; call .destroy() only on pagehide/unload.
 *     .destroy()  Full teardown incl. forceContextLoss() — pagehide/
 *       unload only now, never a scroll-position trigger. See above.
 *     .setReducedMotion(bool)
 */

/* ============================================================
   IMPORTS — bare specifiers, resolved by the page importmap. No
   relative path into assets/vendor/three/ appears here on purpose.
   RoomEnvironment is NOT imported: SIGNATURE-MOMENTS.md Moment 2
   replaces it as the PMREM source with a two-band gradient scene this
   file generates in code (see buildTwoBandEnvScene below).
   ============================================================ */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

/* ============================================================
   TORQUE EASES — SIGNATURE-MOMENTS.md "Easing set": four named cubic-
   bezier curves, declared once in v3.css as custom properties and used
   here via GSAP by passing plain ease FUNCTIONS (a standard Newton-
   Raphson cubic-bezier solver), not the CustomEase plugin — CustomEase
   is not in this site's vendored motion kit
   (/home/vivek/Tools/web-motion-kit/vendor/ has no CustomEase.min.js),
   and GSAP happily accepts any function(progress) as an ease, so this
   is the correct solution given what is actually vendored rather than
   a workaround.
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
  in: cubicBezierEase(0.7, 0, 0.84, 0),
  inOut: cubicBezierEase(0.87, 0, 0.13, 1),
  snap: cubicBezierEase(0.34, 1.56, 0.64, 1),
};

/* ============================================================
   CONFIG
   ============================================================ */
var CONFIG = {
  idleSpinRadPerSec: 0.15,
  spinDecayBase: 0.92,
  wheelImpulse: 0.0016,
  touchImpulse: 0.006,
  maxSpinVelocity: 6.0,

  parallaxMaxX: 0.55,
  parallaxMaxY: 0.32,
  parallaxLambda: 6.0,

  dprDesktop: 1.8,
  dprPhone: 1.5,
  phoneMaxWidth: 768,

  ioRootMargin: "400px",

  cameraRestPos: new THREE.Vector3(0, 1.15, 8.25),
  cameraRestTarget: new THREE.Vector3(0, 2.1, 0),
  cameraScrubPos: new THREE.Vector3(0, 0.95, 5.42),
  cameraScrubTarget: new THREE.Vector3(0, 1.6, 0),
  scrubTurns: Math.PI * 1.5,
  fov: 34,

  plinthWidth: 1.9,
  plinthDepth: 1.9,
  plinthHeight: 0.62,
  plinthBevel: 0.045,
  plinthTopY: 0.62,

  reflectorSize: 512,
  reflectorEveryNthFrame: 3,

  ringRows: 3,
  ringCols: 8,
  ringRadius: 3.35,
  ringRowY: [-0.35, 0.55, 1.45],
  ringTileW: 0.84,
  ringTileH: 0.56,
  ringRowSpeed: [0.052, 0.071, 0.046],
  ringRowOpacity: [0.14, 0.52, 0.95],
  ringPathTemplate: "assets/hh/ring/{NN}.webp",
  ringTileCount: 24,

  // Moment 3 phone variant: 2 rows x 6 cols = 12 tiles.
  ringPhoneCols: 6,
  ringPhoneRows: 2,
  ringPhoneRadius: 2.4,
  ringPhoneRowY: [0.05, 1.05],
  ringPhoneRowSpeed: [0.052, 0.071],
  ringPhoneOpacity: [0.30, 0.95],

  // Moment 3 caption trigger system.
  captionBandStart: 0.06,
  captionBandEnd: 0.94,
  captionHysteresis: 0.012,
  captionOutDur: 0.34,
  captionInDur: 0.48,
  captionInDelay: 0.14,

  // Moment 3 scroll pin, exact.
  pinTriggerSelector: "#engineering",
  pinSelector: "#v3-engineering-pin",
  pinEnd: "+=250%",

  bronzeColor: 0x2c1a10,
  bronzeMetalness: 0.85,
  bronzeClearcoat: 0.18,
  bronzeClearcoatRoughness: 0.32,
  // Moment 2: roughness now comes entirely from the procedural map
  // (material.roughness is the multiplier three.js applies on top of
  // the map's sampled value, so it is set to 1.0 once the map exists —
  // see buildRoughnessNoiseTexture/roughnessMin/roughnessMax below).
  roughnessMin: 0.33,
  roughnessMax: 0.51,

  envIntensity: 0.35,
  // Moment 2: two-band gradient PMREM source, replacing RoomEnvironment.
  envFloorColor: 0x0a0a0a,
  envBandColor: 0x6e747a,
  envBandFraction: 0.22,

  keyColor: 0xffd8a8,
  keyIntensity: 88,
  keyPos: [2.6, 3.4, 2.2],
  // Coordinator order 24 Sep, plinth-material pass: the key light was
  // reaching the plinth's front/side faces near-undimmed (decay:0 means
  // no distance falloff at all, only the cone's own angle/penumbra
  // bounds it), which is why the plinth read as lit tan stone instead
  // of near-black. keyAngle narrowed from its earlier 30 degrees
  // (Math.PI/6) and keyTarget raised from the object's waist to its
  // torso so the cone's axis and outer edge sit higher and tighter
  // around the object; the plinth, sitting lower and wider than the
  // narrowed cone at that distance, now falls mostly in the penumbra
  // or outside the cone entirely and is lit by spill only, per spec.
  keyAngle: Math.PI / 10,
  keyPenumbra: 0.35,
  keyTarget: [0, 2.2, 0],
  rimColor: 0x9fd0ff,
  rimIntensity: 26,
  rimPos: [-2.8, 1.6, -2.4],
  fillColor: 0xffffff,
  fillIntensity: 0.9,
  fillPos: [-1.4, 1.3, 3.0],

  // Coordinator order 24 Sep, plinth-material pass: "a separate lower
  // intensity fill for the plinth" — a dedicated, cool-toned, modest
  // light so the plinth gets its own controlled "faint cool sheen"
  // instead of depending on the key light's spill (SIGNATURE-MOMENTS.md
  // fix 2). Wide angle, low intensity, aimed at the plinth centre only.
  plinthFillColor: 0x8ba2b4,
  plinthFillIntensity: 2.6,
  plinthFillPos: [0.6, 2.1, 3.0],
  plinthFillTarget: [0, 0.31, 0],
  plinthFillAngle: Math.PI / 3.2,
  plinthFillPenumbra: 0.9,

  // Moment 2: one orbiting specular light, counter to the idle spin.
  specularColor: 0xffe2b8,
  specularIntensity: 1.1,
  specularRadius: 2.4,
  specularY: 1.9,
  specularOrbitSpeed: 0.22, // negative direction relative to idle spin

  // Moment 2: phone specifics.
  phoneExposure: 1.5,
  phoneFillIntensity: 1.1,

  // Moment 1: arrival light sequence (house/work/show), seconds.
  arrivalHouseAt: 0,
  arrivalHouseDur: 0.55,
  arrivalWorkAt: 0.40,
  arrivalWorkDur: 0.80,
  arrivalShowAt: 1.05,
  arrivalShowDur: 0.90,
  arrivalExposureStart: 0.4,
  arrivalExposureEnd: 1.85,
  arrivalRepeatTimeScale: 2.2,

  // Bounding-box auto-fit. Coordinator's screenshot review, second pass
  // (24 Sep, composition fix): the object's head touched the top edge
  // of the canvas at 62%/48% — reduced to 58% desktop / 44% phone so
  // the headline's own top-third and the plinth's top edge both have
  // room, measured against the debug bbox/edge-row readback below.
  autoFitDesktopFraction: 0.528,
  autoFitPhoneFraction: 0.408,

  // Coordinator order 24 Sep, plinth-material pass: "near-black with a
  // faint cool sheen" (fix 2). Was 0x141416/0.32/0.05 (read as warm tan
  // under the key light's spill before keyAngle/keyTarget above and
  // the dedicated plinthFill light took over the plinth's lighting).
  plinthColor: 0x0c0c0e,
  plinthRoughness: 0.55,
  plinthMetalness: 0.2,

  // Coordinator order 24 Sep, reflection-containment pass (fix 1): the
  // plinth top reads as a thin polished dark glass sitting just above
  // the mirror clone's own base, so the reflection reads as being IN
  // the surface rather than as a second figure standing in open air.
  glassColor: 0x0b0b0d,
  glassOpacity: 0.55,
  glassRoughness: 0.12,
};

var RING_DIRECTIONS = [1, -1, 1];
var RING_PHONE_DIRECTIONS = [1, -1];

/* ============================================================
   STAND-IN OBJECT. See git history of this file for the full
   provenance trail (Dancing Girl UNKNOWN -> Ram & Sita fallback built
   -> Dancing Girl rebuilt and CLEARED by contract §8 A1, dc50284).
   Still used whenever no modelUrl resolves or a load fails, so a
   missing/broken GLB never leaves an empty plinth.
   ============================================================ */
function buildStandInGeometry() {
  return new THREE.TorusKnotGeometry(0.62, 0.2, 220, 32, 2, 3);
}

function damp(current, target, lambda, dt) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}
function dampVec3(current, target, lambda, dt) {
  current.x = damp(current.x, target.x, lambda, dt);
  current.y = damp(current.y, target.y, lambda, dt);
  current.z = damp(current.z, target.z, lambda, dt);
  return current;
}
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function isPhoneViewport() {
  return typeof window !== "undefined" && window.innerWidth <= CONFIG.phoneMaxWidth;
}

function bumpHeroInstanceCount(delta) {
  if (typeof window === "undefined") return;
  window.V3 = window.V3 || {};
  window.V3.__heroInstances = (window.V3.__heroInstances || 0) + delta;
}

function logArrivalBeat(name) {
  if (typeof window === "undefined") return;
  window.V3 = window.V3 || {};
  window.V3.__arrivalLog = window.V3.__arrivalLog || [];
  window.V3.__arrivalLog.push({ name: name, t: performance.now() });
}

/* ============================================================
   Moment 2, lever 1: two-band gradient PMREM source. A bright
   horizontal "ceiling" band in the upper envFloorFraction of the
   sphere, everything else dark floor — the whole reason a bronze
   material has something to catch a highlight from, rather than
   reading as grey plastic under a near-flat low-intensity env.
   ============================================================ */
function buildTwoBandEnvScene() {
  var w = 16, h = 128;
  var canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  var ctx = canvas.getContext("2d");
  ctx.fillStyle = "#" + CONFIG.envFloorColor.toString(16).padStart(6, "0");
  ctx.fillRect(0, 0, w, h);
  var bandPx = Math.round(h * CONFIG.envBandFraction);
  ctx.fillStyle = "#" + CONFIG.envBandColor.toString(16).padStart(6, "0");
  ctx.fillRect(0, 0, w, bandPx);
  var tex = new THREE.CanvasTexture(canvas);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  var sphereGeo = new THREE.SphereGeometry(5, 16, 12);
  var sphereMat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide });
  var envScene = new THREE.Scene();
  var sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
  envScene.add(sphereMesh);
  return {
    scene: envScene,
    dispose: function () {
      sphereGeo.dispose();
      sphereMat.dispose();
      tex.dispose();
    },
  };
}

/* ============================================================
   Moment 2, lever 2: procedural roughness map. 256x256 value noise,
   three octaves, remapped to [roughnessMin, roughnessMax]. Cast
   bronze is never uniformly rough; a flat roughness scalar is the
   clearest CG tell this moment exists to remove.
   ============================================================ */
function hashNoise(x, y) {
  var s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function smoothNoise2D(x, y) {
  var xi = Math.floor(x), yi = Math.floor(y);
  var xf = x - xi, yf = y - yi;
  var a = hashNoise(xi, yi), b = hashNoise(xi + 1, yi);
  var c = hashNoise(xi, yi + 1), d = hashNoise(xi + 1, yi + 1);
  var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function buildRoughnessNoiseTexture() {
  var size = 256;
  var canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  var ctx = canvas.getContext("2d");
  var img = ctx.createImageData(size, size);
  for (var y = 0; y < size; y++) {
    for (var x = 0; x < size; x++) {
      var nx = x / size, ny = y / size;
      var val = 0, amp = 0.5, freq = 4;
      for (var o = 0; o < 3; o++) {
        val += smoothNoise2D(nx * freq, ny * freq) * amp;
        amp *= 0.5; freq *= 2;
      }
      val = clamp(val, 0, 1);
      var remapped = CONFIG.roughnessMin + val * (CONFIG.roughnessMax - CONFIG.roughnessMin);
      var gray = Math.round(remapped * 255);
      var idx = (y * size + x) * 4;
      img.data[idx] = gray; img.data[idx + 1] = gray; img.data[idx + 2] = gray; img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  var tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/* ============================================================
   Moment 3, ring: ONE merged BufferGeometry (not 24 separate meshes)
   sharing ONE runtime-built canvas atlas texture, so the whole ring is
   a single draw call. The pre-baked atlas-2048.webp/atlas-1024.webp
   SIGNATURE-MOMENTS.md asks the asset lane for do not exist on disk
   (checked: assets/hh/ring/ holds only the 24 individual 01..24.webp
   frames the asset lane delivered earlier). Building the atlas at
   runtime from those same real photos — one canvas, drawn into as
   each photo decodes — reaches the same one-draw-call result honestly,
   using only real photography, without blocking on an asset-lane
   deliverable that was never produced. Grid layout matches the ring's
   own row/col layout 1:1 (no separate packing needed): row r, col c of
   the ring is exactly cell (r, c) of the atlas.

   Per-row spin ("rows alternating direction") on a SINGLE mesh cannot
   use Object3D.rotation (that only rotates the whole mesh); it is done
   in the vertex shader instead, via onBeforeCompile: a per-vertex
   `aRowSpeed` attribute (already signed for direction) rotates each
   tile's 4 corners around the Y axis by `aRowSpeed * uTime`, and a
   `uRingReveal` uniform drives the 0.15-progress fade/settle-in (24 Sep
   defect fix: was 0.06) and 0.94-1.00 fade-out from Moment 3's own
   table. Opacity is likewise per-vertex (`aOpacity`, the bottom-row fade), applied in the
   fragment shader since MeshBasicMaterial has no per-vertex alpha
   support of its own.
   ============================================================ */
function ringLayoutFor(isPhone) {
  if (isPhone) {
    return {
      cols: CONFIG.ringPhoneCols,
      rows: CONFIG.ringPhoneRows,
      radius: CONFIG.ringPhoneRadius,
      rowY: CONFIG.ringPhoneRowY,
      rowSpeed: CONFIG.ringPhoneRowSpeed,
      rowOpacity: CONFIG.ringPhoneOpacity,
      directions: RING_PHONE_DIRECTIONS,
      cellW: 192, cellH: 128,
    };
  }
  return {
    cols: CONFIG.ringCols,
    rows: CONFIG.ringRows,
    radius: CONFIG.ringRadius,
    rowY: CONFIG.ringRowY,
    rowSpeed: CONFIG.ringRowSpeed,
    rowOpacity: CONFIG.ringRowOpacity,
    directions: RING_DIRECTIONS,
    cellW: 256, cellH: 171,
  };
}

function buildRingAtlas(layout) {
  var atlasW = layout.cellW * layout.cols;
  var atlasH = layout.cellH * layout.rows;
  var canvas = document.createElement("canvas");
  canvas.width = atlasW; canvas.height = atlasH;
  var ctx = canvas.getContext("2d");
  // Solid dark-grey placeholder per cell (contract §3.2: "until the
  // asset lane lands use solid dark grey tiles"), with a faint per-
  // cell gradient so 24 identical cells don't read as one flat sheet.
  for (var r = 0; r < layout.rows; r++) {
    for (var c = 0; c < layout.cols; c++) {
      var gx = c * layout.cellW, gy = r * layout.cellH;
      var grad = ctx.createLinearGradient(gx, gy, gx, gy + layout.cellH);
      grad.addColorStop(0, "#2a2a2a");
      grad.addColorStop(1, "#1c1c1c");
      ctx.fillStyle = grad;
      ctx.fillRect(gx, gy, layout.cellW, layout.cellH);
    }
  }
  var texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;

  // Real photos land here (assets/hh/ring/01.webp..24.webp already
  // present — checked at the start of THIS pass, same as before).
  // The desktop atlas uses all 24 in row-major order (row*cols+col+1,
  // matching the ring's own row/col grid); the phone atlas (12 tiles)
  // uses every other frame so the 12 shown are spread across the same
  // 24-photo set rather than only the first half.
  var total = layout.rows * layout.cols;
  for (var i = 0; i < total; i++) {
    (function (index) {
      var sourceIndex = layout.cols === CONFIG.ringPhoneCols
        ? index * 2 + 1 // phone: every other frame, 1-indexed
        : index + 1;
      var nn = String(sourceIndex).padStart(2, "0");
      var img = new Image();
      img.onload = function () {
        var row = Math.floor(index / layout.cols);
        var col = index % layout.cols;
        ctx.drawImage(img, col * layout.cellW, row * layout.cellH, layout.cellW, layout.cellH);
        texture.needsUpdate = true;
      };
      img.onerror = function () {
        /* stays on the placeholder gradient already painted for this cell */
      };
      img.src = CONFIG.ringPathTemplate.replace("{NN}", nn);
    })(i);
  }

  return { canvas: canvas, texture: texture };
}

var RING_VERTEX_INJECT = [
  "attribute float aRowSpeed;",
  "attribute float aOpacity;",
  "uniform float uTime;",
  "uniform float uRingReveal;",
  "varying float vOpacity;",
  "#include <common>",
].join("\n");

// DEFECT 1 root cause (Bob's screenshot review, 24 Sep): this used to open
// with the literal string "vec3 transformed = vec3( position );" as both
// the injected code AND (below, in buildRingMesh) the .replace() SEARCH
// target. That string is only what <begin_vertex> expands TO — three.js
// hands onBeforeCompile the shader TEMPLATE, with #include <begin_vertex>
// still an unexpanded directive, so the old .replace() call never matched
// anything and silently no-op'd. Net effect: vOpacity (assigned only
// inside this block) was never written by the vertex shader at all, so
// the varying read 0 in the fragment shader, `diffuseColor.a *= vOpacity`
// zeroed every fragment's alpha, and the ring rendered fully transparent
// on every frame regardless of uRingReveal/scroll position — invisible by
// construction, not a framing or asset-loading problem. Confirmed via a
// real-photo material swap (plain MeshBasicMaterial, no custom shader) at
// the same geometry/camera state, which rendered the ring tiles correctly
// in place. Fix: search for "#include <begin_vertex>" (the literal
// unexpanded marker, present verbatim in the template) instead.
var RING_BEGIN_VERTEX_INJECT = [
  "vec3 transformed = vec3( position );",
  "float rAngle = aRowSpeed * uTime;",
  "float rs = sin( rAngle );",
  "float rc = cos( rAngle );",
  "transformed.x = position.x * rc - position.z * rs;",
  "transformed.z = position.x * rs + position.z * rc;",
  "float revealScale = mix( 0.86, 1.0, uRingReveal );",
  "transformed.x *= revealScale;",
  "transformed.z *= revealScale;",
  "vOpacity = aOpacity * uRingReveal;",
].join("\n");

var RING_FRAGMENT_VARYING_INJECT = "varying float vOpacity;\n#include <common>";
var RING_FRAGMENT_ALPHA_INJECT = "diffuseColor.a *= vOpacity;\n#include <alphatest_fragment>";

function buildRingMesh(isPhone) {
  var layout = ringLayoutFor(isPhone);
  var atlas = buildRingAtlas(layout);

  var count = layout.rows * layout.cols;
  var positions = new Float32Array(count * 4 * 3);
  var normals = new Float32Array(count * 4 * 3);
  var uvs = new Float32Array(count * 4 * 2);
  var rowSpeedAttr = new Float32Array(count * 4);
  var opacityAttr = new Float32Array(count * 4);
  var indices = new Uint16Array(count * 6);

  var tileW = CONFIG.ringTileW, tileH = CONFIG.ringTileH;
  var vi = 0, ii = 0;
  for (var row = 0; row < layout.rows; row++) {
    var y = layout.rowY[row];
    var dir = layout.directions[row % layout.directions.length];
    var speed = layout.rowSpeed[row] * dir;
    var opacity = layout.rowOpacity[row];
    for (var col = 0; col < layout.cols; col++) {
      var angle = ((col + 0.5) / layout.cols) * Math.PI * 2;
      var cx = Math.sin(angle) * layout.radius;
      var cz = Math.cos(angle) * layout.radius;
      var tangentX = Math.cos(angle), tangentZ = -Math.sin(angle);
      var hw = tileW / 2, hh = tileH / 2;
      var corners = [
        [cx - tangentX * hw, y - hh, cz - tangentZ * hw],
        [cx + tangentX * hw, y - hh, cz + tangentZ * hw],
        [cx + tangentX * hw, y + hh, cz + tangentZ * hw],
        [cx - tangentX * hw, y + hh, cz - tangentZ * hw],
      ];
      var nx = Math.sin(angle), nz = Math.cos(angle);
      var u0 = col / layout.cols, u1 = (col + 1) / layout.cols;
      var v1 = 1 - row / layout.rows, v0 = 1 - (row + 1) / layout.rows;
      var cornerUVs = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
      for (var k = 0; k < 4; k++) {
        positions[vi * 3] = corners[k][0];
        positions[vi * 3 + 1] = corners[k][1];
        positions[vi * 3 + 2] = corners[k][2];
        normals[vi * 3] = nx; normals[vi * 3 + 1] = 0; normals[vi * 3 + 2] = nz;
        uvs[vi * 2] = cornerUVs[k][0]; uvs[vi * 2 + 1] = cornerUVs[k][1];
        rowSpeedAttr[vi] = speed;
        opacityAttr[vi] = opacity;
        vi++;
      }
      var base = (row * layout.cols + col) * 4;
      indices[ii++] = base; indices[ii++] = base + 1; indices[ii++] = base + 2;
      indices[ii++] = base; indices[ii++] = base + 2; indices[ii++] = base + 3;
    }
  }

  var geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute("aRowSpeed", new THREE.BufferAttribute(rowSpeedAttr, 1));
  geo.setAttribute("aOpacity", new THREE.BufferAttribute(opacityAttr, 1));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));

  var material = new THREE.MeshBasicMaterial({
    map: atlas.texture,
    transparent: true,
    side: THREE.DoubleSide,
    fog: true,
    depthWrite: false,
  });
  material.onBeforeCompile = function (shader) {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uRingReveal = { value: 0 };
    shader.vertexShader = shader.vertexShader.replace("#include <common>", RING_VERTEX_INJECT);
    // Was searching for the EXPANDED chunk text ("vec3 transformed = ...")
    // which never appears in the template onBeforeCompile receives — see
    // RING_BEGIN_VERTEX_INJECT's comment above. Fixed to match the literal
    // unexpanded #include marker.
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", RING_BEGIN_VERTEX_INJECT);
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", RING_FRAGMENT_VARYING_INJECT);
    shader.fragmentShader = shader.fragmentShader.replace("#include <alphatest_fragment>", RING_FRAGMENT_ALPHA_INJECT);
    material.userData.shader = shader;
  };

  var mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  return { mesh: mesh, atlasCanvas: atlas.canvas };
}

/* ============================================================
   initHero
   ============================================================ */
export function initHero(opts) {
  opts = opts || {};

  var canvas =
    opts.canvas ||
    document.querySelector('[data-slot="hero"] canvas.v3-hero-canvas');
  if (!canvas) return null;

  bumpHeroInstanceCount(1);

  // Contract §8 A1: the Dancing Girl is cleared (dc50284). Defaults now
  // point at it directly — a 404 (or an explicit opts override) still
  // degrades to the torus-knot stand-in via loadRealObject's own catch.
  var modelUrl = opts.modelUrl || canvas.dataset.model || "assets/models/dancing-girl.glb";
  var modelLoUrl = opts.modelLoUrl || canvas.dataset.modelLo || "assets/models/dancing-girl-lo.glb";

  var section = canvas.closest("[data-slot]") || canvas.parentElement;
  var IS_PHONE = isPhoneViewport();

  function reducedMotionActive() {
    if (typeof window !== "undefined" && window.V3 && "reducedMotion" in window.V3) {
      return !!window.V3.reducedMotion;
    }
    return prefersReducedMotion();
  }
  var REDUCED_AT_MOUNT = reducedMotionActive();

  /* ---------- renderer / scene / camera ---------- */
  var renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
    // Coordinator order 24 Sep, luminance measurement pass: pixel
    // readback (a 2D-canvas copy of the WebGL canvas, used by
    // _debug.measureLuminance below) needs the drawing buffer to
    // still hold the last frame when JS runs, not just during the GPU
    // swap. Small, disclosed cost; this is a debug/QA hook, not a
    // per-frame production path.
    preserveDrawingBuffer: true,
  });
  // 0x080808 matches v3.css's --ground token. Set defensively here
  // too, but note this alone does NOT fix the stage band: three.js
  // r186's WebGLBackground module re-forces the GL clear color to
  // scene.background every frame whenever scene.background is a
  // Color instance, silently overriding whatever this call sets
  // (confirmed by direct render test, not assumed) -- see the
  // scene.background assignment below, which is the line that
  // actually controls the painted colour.
  renderer.setClearColor(0x080808, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = REDUCED_AT_MOUNT
    ? CONFIG.arrivalExposureEnd
    : CONFIG.arrivalExposureStart;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // Needed for the mirror-clone reflection's clipping plane below
  // (material.clippingPlanes is a no-op unless this is set).
  renderer.localClippingEnabled = true;

  var scene = new THREE.Scene();
  // This is the line that actually paints the stage's empty pixels
  // every frame (three.js clears to scene.background, not to
  // renderer.setClearColor, whenever background is a Color -- see
  // note above). Matches --ground (#080808) so the canvas no longer
  // shows a hard-edged black band over the CSS ground fe34b15 fixed.
  scene.background = new THREE.Color(0x080808);
  scene.fog = new THREE.Fog(0x000000, 6.5, 13);

  var camera = new THREE.PerspectiveCamera(CONFIG.fov, 1, 0.1, 40);
  camera.position.copy(CONFIG.cameraRestPos);
  camera.lookAt(CONFIG.cameraRestTarget);

  /* ---------- Moment 2 lever 1: two-band gradient environment ---------- */
  var pmrem = new THREE.PMREMGenerator(renderer);
  var envBuild = buildTwoBandEnvScene();
  var envTex = pmrem.fromScene(envBuild.scene, 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = REDUCED_AT_MOUNT ? CONFIG.envIntensity : 0;
  envBuild.dispose();
  pmrem.dispose();

  /* ---------- gallery rig: key warm / rim cool / fill low, Moment 1
     starts every intensity at 0 unless reduced motion skips the
     arrival entirely ---------- */
  var key = new THREE.SpotLight(
    CONFIG.keyColor,
    REDUCED_AT_MOUNT ? CONFIG.keyIntensity : 0,
    12, CONFIG.keyAngle, CONFIG.keyPenumbra, 0
  );
  key.position.set(CONFIG.keyPos[0], CONFIG.keyPos[1], CONFIG.keyPos[2]);
  key.target.position.set(CONFIG.keyTarget[0], CONFIG.keyTarget[1], CONFIG.keyTarget[2]);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0015;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 8;
  scene.add(key, key.target);

  // Plinth-material pass: dedicated low-intensity, cool-toned fill so
  // the plinth's "faint cool sheen" no longer depends on the key
  // light's spill (SIGNATURE-MOMENTS.md fix 2). Starts at 0 like the
  // rest of the rig; brought up with `fill` at the arrival's "house"
  // beat (a cool base wash arriving with the rest of the house light
  // reads correctly — it is not part of the warm key/rim narrative).
  var plinthFill = new THREE.SpotLight(
    CONFIG.plinthFillColor,
    REDUCED_AT_MOUNT ? CONFIG.plinthFillIntensity : 0,
    9, CONFIG.plinthFillAngle, CONFIG.plinthFillPenumbra, 0
  );
  plinthFill.position.set(CONFIG.plinthFillPos[0], CONFIG.plinthFillPos[1], CONFIG.plinthFillPos[2]);
  plinthFill.target.position.set(CONFIG.plinthFillTarget[0], CONFIG.plinthFillTarget[1], CONFIG.plinthFillTarget[2]);
  scene.add(plinthFill, plinthFill.target);

  var rim = new THREE.SpotLight(
    CONFIG.rimColor,
    REDUCED_AT_MOUNT ? CONFIG.rimIntensity : 0,
    12, Math.PI / 5, 0.5, 0
  );
  rim.position.set(CONFIG.rimPos[0], CONFIG.rimPos[1], CONFIG.rimPos[2]);
  rim.target.position.set(0, 1.8, 0);
  scene.add(rim, rim.target);

  var fillTargetIntensity = IS_PHONE ? CONFIG.phoneFillIntensity : CONFIG.fillIntensity;
  var fill = new THREE.PointLight(
    CONFIG.fillColor,
    REDUCED_AT_MOUNT ? fillTargetIntensity : 0,
    8, 1
  );
  fill.position.set(CONFIG.fillPos[0], CONFIG.fillPos[1], CONFIG.fillPos[2]);
  scene.add(fill);

  /* ---------- Moment 2 lever 3: one orbiting specular light, counter
     to the object's idle spin ---------- */
  var specular = new THREE.PointLight(CONFIG.specularColor, CONFIG.specularIntensity, CONFIG.specularRadius + 2, 1);
  scene.add(specular);
  var specularAngle = 0;

  if (IS_PHONE) {
    renderer.toneMappingExposure = REDUCED_AT_MOUNT ? CONFIG.phoneExposure : CONFIG.arrivalExposureStart;
  }
  var exposureTarget = IS_PHONE ? CONFIG.phoneExposure : CONFIG.arrivalExposureEnd;

  /* ---------- plinth: bevelled-top box, contract §3.2 ---------- */
  var plinthGroup = new THREE.Group();
  var mirrorClone = null;
  var mirrorMaterial = null;
  {
    var w = CONFIG.plinthWidth / 2;
    var d = CONFIG.plinthDepth / 2;
    var shape = new THREE.Shape();
    var r = 0.06;
    shape.moveTo(-w + r, -d);
    shape.lineTo(w - r, -d);
    shape.quadraticCurveTo(w, -d, w, -d + r);
    shape.lineTo(w, d - r);
    shape.quadraticCurveTo(w, d, w - r, d);
    shape.lineTo(-w + r, d);
    shape.quadraticCurveTo(-w, d, -w, d - r);
    shape.lineTo(-w, -d + r);
    shape.quadraticCurveTo(-w, -d, -w + r, -d);

    var extrudeSettings = {
      depth: CONFIG.plinthHeight - CONFIG.plinthBevel,
      bevelEnabled: true,
      bevelThickness: CONFIG.plinthBevel,
      bevelSize: CONFIG.plinthBevel,
      bevelSegments: 3,
      curveSegments: 8,
    };
    var geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.rotateX(-Math.PI / 2);
    // Coordinator order 24 Sep, plinth-material pass (fix 2, Bob's
    // screenshot verdict: "PLINTH READS TAN, NOT DARK POLISHED
    // STONE"): near-black with a faint cool sheen. The earlier
    // 0x141416/0.32/0.05 value was already numerically dark but read
    // as warm tan on screen because the key light's decay:0 spill hit
    // it near-undimmed (see keyAngle/keyTarget/plinthFill above) —
    // the colour was never the whole problem, the lighting was. Both
    // are fixed together here: darker base colour, less glossy
    // (roughness up, so what light does land doesn't specular-hotspot),
    // faint metallic sheen (metalness 0.2) for the "cool sheen" the
    // spec asks for, one mesh (see the single-mesh-vs-split history
    // above this comment, still true, unrelated to this pass).
    var mat = new THREE.MeshStandardMaterial({
      color: CONFIG.plinthColor, roughness: CONFIG.plinthRoughness, metalness: CONFIG.plinthMetalness,
    });
    var plinthMesh = new THREE.Mesh(geo, mat);
    plinthMesh.receiveShadow = true;
    plinthGroup.add(plinthMesh);

    // Coordinator order 24 Sep, second exposure/material pass:
    // Reflector's render-target/clip-plane/blend behaviour proved
    // unreliable across three separate fix attempts (moving the clip
    // plane below her feet, enlarging the disc, neutralising the
    // overlay-blend tint) — it kept reading as a flat grey wash, not a
    // recognisable mirrored figure. Taking the coordinator's own
    // suggested fallback: the mirrored-clone technique already proven
    // correct on phone (scale.y=-1, translucent, no envMap
    // contribution), used unconditionally for BOTH desktop and phone
    // now, rather than keep debugging a shader/render-target approach
    // under deadline. Kept in sync with whichever geometry objectMesh
    // currently uses via syncMirrorClone() below (called at mount and
    // after any GLTF swap). Opacity fades in during Moment 1's "show"
    // beat ("the reflection arrives last") via the arrival timeline —
    // see the mirrorMaterial tween there — instead of a separate veil
    // disc (Reflector's own hardcoded-alpha problem that veil worked
    // around no longer applies once Reflector itself is gone).
    //
    // Coordinator order 24 Sep, reflection-containment pass (fix 1,
    // Bob's screenshot verdict: "REFLECTION SHOWS THROUGH THE
    // PLINTH"): the depthTest:false + ground-level clip plane above
    // (superseded, see git history for the exact prior values) drew
    // the mirrored legs over the plinth's own opaque front face —
    // depthTest:false means the clone paints wherever its geometry
    // projects to on screen regardless of what opaque geometry is
    // actually nearer the camera at that pixel, so the box's front
    // wall never had a chance to occlude it. Fixed the honest way:
    // depthTest is back on (normal depth, "plinth sides and body
    // opaque, normal depth" per spec), so the plinth's own solid
    // geometry now correctly occludes the clone everywhere except the
    // thin sliver of screen space where the camera is looking past the
    // box's open top rather than through its solid front/side walls —
    // which is exactly "the plinth's top face" the spec asks for. The
    // clip plane is raised from the ground (y = plinthTopY -
    // plinthHeight) to the plinth's own TOP surface (y = plinthTopY)
    // as the spec's belt-and-suspenders bound: even where the box's
    // bevelled top edge or a grazing viewing angle might let a sliver
    // of the depth-tested clone peek out below the top surface, this
    // plane discards it outright, so nothing reflected can ever read
    // as hanging in open air below the top. The colour is darkened to
    // 40% of the bronze base (a reflection should read darker and
    // flatter than the object itself, not as a second lit figure) and
    // clipShadows stays true so the clone still can't cast a shadow
    // past its own clipped extent.
    mirrorMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(CONFIG.bronzeColor).multiplyScalar(0.4),
      metalness: CONFIG.bronzeMetalness, roughness: 0.85,
      envMapIntensity: 0, transparent: true, depthTest: true, depthWrite: true,
      opacity: REDUCED_AT_MOUNT ? 0.42 : 0,
      clippingPlanes: [new THREE.Plane(new THREE.Vector3(0, 1, 0), -CONFIG.plinthTopY)],
      clipShadows: true,
    });
    mirrorClone = new THREE.Group();
    mirrorClone.position.y = CONFIG.plinthTopY + 0.02;
    mirrorClone.scale.y = -1;
    // renderOrder no longer needs to win a same-depth race against the
    // plinth (depthTest handles that correctly now); kept at 10, below
    // the glass plane's 11, purely so the two transparent surfaces
    // that DO occupy the same screen pixels — the clone and the glass
    // — composite in the right order (clone first, glass blended over
    // it) rather than depending on the transparent queue's default
    // back-to-front sort, which this scene's near-coplanar geometry
    // can't reliably provide.
    mirrorClone.renderOrder = 10;
    plinthGroup.add(mirrorClone);

    // Coordinator order 24 Sep, reflection-containment pass (fix 1):
    // "the plinth top rendered as a separate dark glass plane...
    // sitting 0.5 mm above the mirrored clone's base, so the
    // reflection reads as being IN a polished dark surface and fades
    // under the glass." Reuses the same rounded-rect `shape` so its
    // footprint matches the plinth exactly. depthWrite:false so it
    // never blocks anything drawn after it; renderOrder 11 (after the
    // clone) so it always composites on top, tinting/darkening
    // whatever of the reflection is visible beneath it rather than
    // occluding it outright.
    var glassGeo = new THREE.ShapeGeometry(shape, 8);
    glassGeo.rotateX(-Math.PI / 2);
    var glassMat = new THREE.MeshStandardMaterial({
      color: CONFIG.glassColor, roughness: CONFIG.glassRoughness, metalness: 0.1,
      transparent: true, opacity: CONFIG.glassOpacity, depthWrite: false,
    });
    var glassMesh = new THREE.Mesh(glassGeo, glassMat);
    glassMesh.position.y = mirrorClone.position.y + 0.0005;
    glassMesh.renderOrder = 11;
    plinthGroup.add(glassMesh);

    // Coordinator order 24 Sep, exposure pass: "the plinth top gets a
    // thin edge highlight" measured as "a pixel row with luminance
    // above 0.15 across at least 60% of its width." A ring around the
    // circular reflector inset (first attempt) only crosses a
    // horizontal scanline at two narrow points, not most of the row —
    // wrong shape for that measurement. What actually reads as a
    // full-width row is the plinth's own OUTER top edge (where the
    // flat top face meets the front vertical face, spanning its full
    // rounded-rect width) — four thin unlit strips tracing that
    // perimeter, front/back/left/right, each always visible
    // regardless of the PBR light rig's tuning.
    var edgeMat = new THREE.MeshBasicMaterial({ color: 0xd8b98a });
    var edgeInset = 0.018, edgeThickness = 0.045, edgeY = CONFIG.plinthTopY + 0.004;
    var frontEdge = new THREE.Mesh(new THREE.BoxGeometry(w * 2 - edgeInset * 2, 0.006, edgeThickness), edgeMat);
    frontEdge.position.set(0, edgeY, d - edgeInset - edgeThickness / 2);
    var backEdge = frontEdge.clone();
    backEdge.position.z = -(d - edgeInset - edgeThickness / 2);
    var leftEdge = new THREE.Mesh(new THREE.BoxGeometry(edgeThickness, 0.006, d * 2 - edgeInset * 2), edgeMat);
    leftEdge.position.set(-(w - edgeInset - edgeThickness / 2), edgeY, 0);
    var rightEdge = leftEdge.clone();
    rightEdge.position.x = w - edgeInset - edgeThickness / 2;
    plinthGroup.add(frontEdge, backEdge, leftEdge, rightEdge);
  }
  scene.add(plinthGroup);

  // Coordinator order 24 Sep, exposure pass: "a soft pool of light on
  // the back wall behind her... so she has depth and the ring tiles
  // behind her catch a little of it." An unlit radial-gradient sprite
  // on a plane behind the object — guaranteed visible regardless of
  // how the PBR light rig's falloff tunes, rather than depending on a
  // SpotLight hitting an actual wall mesh that does not otherwise
  // exist in this scene.
  var glowCanvas = document.createElement("canvas");
  glowCanvas.width = 256; glowCanvas.height = 256;
  var glowCtx = glowCanvas.getContext("2d");
  var glowGrad = glowCtx.createRadialGradient(128, 128, 0, 128, 128, 128);
  glowGrad.addColorStop(0, "rgba(255,196,138,0.62)");
  glowGrad.addColorStop(0.5, "rgba(180,120,70,0.26)");
  glowGrad.addColorStop(1, "rgba(0,0,0,0)");
  glowCtx.fillStyle = glowGrad;
  glowCtx.fillRect(0, 0, 256, 256);
  var glowTexture = new THREE.CanvasTexture(glowCanvas);
  var glowSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTexture, transparent: true, depthWrite: false, fog: false })
  );
  glowSprite.scale.set(7.3, 7.3, 1);
  glowSprite.position.set(0, 2.0, -4.2);
  scene.add(glowSprite);

  /* ---------- object group ---------- */
  var objectGroup = new THREE.Group();
  objectGroup.position.y = CONFIG.plinthTopY;
  scene.add(objectGroup);

  var roughnessMap = buildRoughnessNoiseTexture();
  var bronzeMaterial = new THREE.MeshPhysicalMaterial({
    color: CONFIG.bronzeColor,
    metalness: CONFIG.bronzeMetalness,
    roughness: 1.0, // final roughness comes from roughnessMap alone
    roughnessMap: roughnessMap,
    clearcoat: CONFIG.bronzeClearcoat,
    clearcoatRoughness: CONFIG.bronzeClearcoatRoughness,
    envMapIntensity: 1.1,
  });

  var objectMesh = new THREE.Mesh(buildStandInGeometry(), bronzeMaterial);
  objectMesh.castShadow = true;
  objectMesh.position.y = 0.66;
  objectGroup.add(objectMesh);
  var usingStandIn = true;

  function syncMirrorClone() {
    // Phone-only reflection (Moment 2): a full hierarchy clone, not a
    // single-geometry clone, because objectMesh is a plain THREE.Mesh
    // for the torus-knot stand-in but a multi-node THREE.Group once a
    // GLTF has loaded (no single .geometry of its own to clone). Every
    // old child is disposed before being replaced so this is safe to
    // call again after a later GLTF swap.
    if (!mirrorClone) return;
    while (mirrorClone.children.length) {
      var old = mirrorClone.children[0];
      mirrorClone.remove(old);
      if (old.geometry) old.geometry.dispose();
    }
    var fresh = objectMesh.clone(true);
    fresh.traverse(function (node) {
      if (node.isMesh) {
        node.material = mirrorMaterial;
        node.castShadow = false;
        node.receiveShadow = false;
      }
    });
    mirrorClone.add(fresh);
    mirrorClone.position.x = objectGroup.position.x;
    mirrorClone.position.z = objectGroup.position.z;
  }
  syncMirrorClone();

  /* ---------- bounding-box auto-fit — coordinator order 24 Sep:
     target height = autoFitFraction * the visible world-space height
     at the object's camera distance, computed from the camera's own
     vertical FOV, not eyeballed. 62% desktop, 48% phone. Applied only
     to a loaded GLTF (the stand-in's proportions are already hand-
     tuned to this scene). ---------- */
  function visibleHeightAtDistance(distance) {
    var vFovRad = (camera.fov * Math.PI) / 180;
    return 2 * Math.tan(vFovRad / 2) * distance;
  }
  function autoFitObject(object3D) {
    var box = new THREE.Box3().setFromObject(object3D);
    var size = new THREE.Vector3();
    box.getSize(size);
    if (!(size.y > 0)) return;
    var worldCenter = new THREE.Vector3();
    box.getCenter(worldCenter);
    var distance = CONFIG.cameraRestPos.distanceTo(
      new THREE.Vector3(objectGroup.position.x, objectGroup.position.y + size.y / 2, objectGroup.position.z)
    );
    var visibleHeight = visibleHeightAtDistance(distance);
    var targetFraction = IS_PHONE ? CONFIG.autoFitPhoneFraction : CONFIG.autoFitDesktopFraction;
    var targetHeight = visibleHeight * targetFraction;
    var scale = targetHeight / size.y;
    object3D.scale.setScalar(scale);
    var scaledBox = new THREE.Box3().setFromObject(object3D);
    var center = new THREE.Vector3();
    scaledBox.getCenter(center);
    // BUG FIXED 24 Sep (coordinator's screenshot review: "sunk into
    // the plinth, no feet visible"). scaledBox is WORLD-space (Box3.
    // setFromObject updates world matrices first), but object3D.position
    // is LOCAL to objectGroup, which itself sits at y=CONFIG.plinthTopY
    // (0.62). Subtracting the raw world min-Y from a local position
    // double-counted that offset and dragged the object roughly 0.57
    // units down into the plinth. The X/Z lines are unaffected —
    // objectGroup's x/z position is 0, so world and local agree there.
    object3D.position.x -= center.x;
    object3D.position.z -= center.z;
    var localMinY = scaledBox.min.y - objectGroup.position.y;
    object3D.position.y -= localMinY;
  }

  /* ---------- GLTF/DRACO loader ---------- */
  var dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath("assets/vendor/three/draco/gltf/");
  var gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);

  function loadRealObject(url) {
    if (!url) return;
    gltfLoader.load(
      url,
      function (gltf) {
        var loaded = gltf.scene || gltf.scenes[0];
        if (!loaded) return;
        loaded.traverse(function (node) {
          if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = false;
            node.material = bronzeMaterial;
          }
        });
        objectGroup.remove(objectMesh);
        objectMesh.geometry.dispose();
        objectMesh = loaded;
        objectGroup.add(objectMesh);
        autoFitObject(objectMesh);
        syncMirrorClone();
        usingStandIn = false;
      },
      undefined,
      function (err) {
        console.info("[v3-hero] model load failed, staying on the stand-in mesh:", url, err && err.message);
      }
    );
  }
  var chosenModelUrl = IS_PHONE ? (modelLoUrl || modelUrl) : modelUrl;
  if (chosenModelUrl) loadRealObject(chosenModelUrl);

  /* ---------- Moment 3 ring: one mesh, one draw call ---------- */
  var ringBuild = buildRingMesh(IS_PHONE);
  scene.add(ringBuild.mesh);
  var ringUniformsRef = null; // set on first onBeforeCompile call (see below)
  var ringShaderCheckId = requestAnimationFrame(function pollRingShader() {
    if (ringBuild.mesh.material.userData.shader) {
      ringUniformsRef = ringBuild.mesh.material.userData.shader.uniforms;
    } else {
      requestAnimationFrame(pollRingShader);
    }
  });

  /* ---------- DPR cap ---------- */
  function applyDpr() {
    var cap = isPhoneViewport() ? CONFIG.dprPhone : CONFIG.dprDesktop;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
  }
  applyDpr();

  /* ---------- resize ---------- */
  function resize() {
    var rect = canvas.getBoundingClientRect();
    var w = Math.max(1, rect.width);
    var h = Math.max(1, rect.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  var resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
  if (resizeObserver) resizeObserver.observe(canvas);
  window.addEventListener("resize", applyDpr);
  resize();

  function reducedMotionActiveLive() { return reducedMotionActive(); }

  /* ---------- interaction state ---------- */
  var spinVelocity = 0;
  var pointerTargetX = 0, pointerTargetY = 0;
  var parallaxX = 0, parallaxY = 0;
  var boundScrollTrigger = null;
  var running = false, rafId = null, lastT = 0;
  var visibleInViewport = false;

  function onPointerMove(e) {
    var rect = canvas.getBoundingClientRect();
    var nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    var ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    pointerTargetX = clamp(nx, -1, 1) * CONFIG.parallaxMaxX;
    pointerTargetY = clamp(ny, -1, 1) * CONFIG.parallaxMaxY;
  }
  function onPointerLeave() { pointerTargetX = 0; pointerTargetY = 0; }
  function onWheel(e) {
    var impulse = clamp(e.deltaY, -120, 120) * CONFIG.wheelImpulse;
    spinVelocity = clamp(spinVelocity + impulse, -CONFIG.maxSpinVelocity, CONFIG.maxSpinVelocity);
  }
  var touchLastX = null;
  function onTouchStart(e) { if (e.touches && e.touches.length) touchLastX = e.touches[0].clientX; }
  function onTouchMove(e) {
    if (!e.touches || !e.touches.length || touchLastX === null) return;
    var x = e.touches[0].clientX;
    var dx = x - touchLastX;
    touchLastX = x;
    spinVelocity = clamp(spinVelocity + dx * CONFIG.touchImpulse, -CONFIG.maxSpinVelocity, CONFIG.maxSpinVelocity);
  }
  function onTouchEnd() { touchLastX = null; }

  function attachInteraction() {
    canvas.addEventListener("pointermove", onPointerMove, { passive: true });
    canvas.addEventListener("pointerleave", onPointerLeave, { passive: true });
    canvas.addEventListener("wheel", onWheel, { passive: true });
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove", onTouchMove, { passive: true });
    canvas.addEventListener("touchend", onTouchEnd, { passive: true });
  }
  function detachInteraction() {
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerleave", onPointerLeave);
    canvas.removeEventListener("wheel", onWheel);
    canvas.removeEventListener("touchstart", onTouchStart);
    canvas.removeEventListener("touchmove", onTouchMove);
    canvas.removeEventListener("touchend", onTouchEnd);
  }

  /* ============================================================
     Moment 1: arrival light sequence. Runs once, via GSAP's own
     ticker (not this module's rAF loop), so it plays even before the
     IO gate would otherwise start the render loop — the whole point
     is that the very first painted frames are already the darkness-
     to-light event, not something waiting for a gate to open on an
     already-visible hero.
     ============================================================ */
  var arrivalTimeline = null;
  function finalizeArrivalValuesImmediately() {
    fill.intensity = fillTargetIntensity;
    plinthFill.intensity = CONFIG.plinthFillIntensity;
    scene.environmentIntensity = CONFIG.envIntensity;
    rim.intensity = CONFIG.rimIntensity;
    key.intensity = CONFIG.keyIntensity;
    renderer.toneMappingExposure = exposureTarget;
    if (mirrorMaterial) mirrorMaterial.opacity = 0.42;
    renderer.render(scene, camera);
  }
  function runArrival() {
    if (reducedMotionActive()) {
      finalizeArrivalValuesImmediately();
      return;
    }
    var gsapG = typeof window !== "undefined" ? window.gsap : null;
    if (!gsapG) {
      console.info("[v3-hero] gsap not found on window; arrival sequence skipped, final lighting applied directly.");
      finalizeArrivalValuesImmediately();
      return;
    }
    var seenBefore = false;
    try { seenBefore = sessionStorage.getItem("v3-visited") === "1"; } catch (e) {}

    var tl = gsapG.timeline({ paused: true });
    tl.to(fill, { intensity: fillTargetIntensity, duration: CONFIG.arrivalHouseDur, ease: TORQUE.out, onStart: function () { logArrivalBeat("house"); } }, CONFIG.arrivalHouseAt);
    tl.to(plinthFill, { intensity: CONFIG.plinthFillIntensity, duration: CONFIG.arrivalHouseDur, ease: TORQUE.out }, CONFIG.arrivalHouseAt);
    tl.to(scene, { environmentIntensity: CONFIG.envIntensity, duration: CONFIG.arrivalHouseDur, ease: TORQUE.out }, CONFIG.arrivalHouseAt);
    tl.to(rim, { intensity: CONFIG.rimIntensity, duration: CONFIG.arrivalWorkDur, ease: TORQUE.out, onStart: function () { logArrivalBeat("work"); } }, CONFIG.arrivalWorkAt);
    tl.to(key, { intensity: CONFIG.keyIntensity, duration: CONFIG.arrivalShowDur, ease: TORQUE.out, onStart: function () { logArrivalBeat("show"); } }, CONFIG.arrivalShowAt);
    tl.to(renderer, { toneMappingExposure: exposureTarget, duration: CONFIG.arrivalShowDur, ease: "power3.out" }, CONFIG.arrivalShowAt);
    if (mirrorMaterial) {
      tl.to(mirrorMaterial, { opacity: 0.42, duration: CONFIG.arrivalShowDur, ease: TORQUE.out }, CONFIG.arrivalShowAt);
    }
    arrivalTimeline = tl;

    if (window.V3 && typeof window.V3.onArrival === "function") {
      // Hand the integrator's shared timeline hook a function that
      // adds these same tweens onto ITS timeline at the same labels,
      // so beats D (headline) and E (curtain) stay in the same
      // composition v3-core.js owns. Both this standalone tl AND the
      // shared-timeline path exist so the sequence still plays
      // correctly in a harness (this lane's own demo) where
      // window.V3.onArrival was never wired.
      window.V3.onArrival(function (sharedTl) {
        if (!sharedTl) return;
        sharedTl.add(tl, 0);
      });
    }

    // CLOSER note, 24 Sep: window.V3.onArrival is wired now
    // (v3-core.js). tl.play() below runs unconditionally even after
    // sharedTl.add(tl, 0) — confirmed correct, not a double-play bug:
    // a GSAP child timeline nested via .add() only advances when its
    // own `paused` flag is false, so .play() here is what lets the
    // PARENT drive it (the parent governs the child's actual time
    // position; .play() just clears the pause gate). An earlier draft
    // of this fix skipped .play() when addedToSharedTimeline, on the
    // assumption that a nested-plus-independently-played timeline was
    // two competing clocks — tested live and empirically wrong: the
    // arrival log came back missing "house"/"work"/"show" entirely
    // and toneMappingExposure never left 0.4, because the still-
    // paused nested child never advanced no matter how far the parent
    // played. Reverted to the original, always-play behaviour; the
    // shared timeline drives the child's positions correctly with it.
    if (seenBefore) tl.timeScale(CONFIG.arrivalRepeatTimeScale);
    tl.play();
  }
  runArrival();

  /* ============================================================
     Moment 3 captions: trigger-driven, not scrubbed. Hysteresis
     0.012 of progress. Handover: outgoing 0.34s TORQUE.in, incoming
     0.48s TORQUE.out delayed 0.14s after the outgoing starts.
     ============================================================ */
  // Captions live in the SEPARATE #engineering section, not inside
  // the hero's own [data-slot="hero"] — queried from the document, not
  // scoped to `section` (that variable is the hero slot).
  var captionItems = Array.prototype.slice.call(
    document.querySelectorAll(".engineering-captions > li[data-station]")
  );
  var currentStation = captionItems.length ? 0 : -1;
  var captionBandWidth = (CONFIG.captionBandEnd - CONFIG.captionBandStart) / 6;

  // Monotonic transition token. Every delayed GSAP callback this state
  // machine schedules captures the generation in force at the moment
  // it was scheduled and refuses to touch classes/inline styles if a
  // later transition has since moved the generation on. This is the
  // fix for the root cause QA identified: a delayed onStart, superseded
  // by one or two later handovers before it fired, used to resurrect a
  // caption that should already have been retired.
  var transitionGeneration = 0;

  function rawStationFor(progress) {
    if (progress < CONFIG.captionBandStart) return 0;
    if (progress >= CONFIG.captionBandEnd) return 5;
    return clamp(Math.floor((progress - CONFIG.captionBandStart) / captionBandWidth), 0, 5);
  }
  function stationBoundary(index) { return CONFIG.captionBandStart + index * captionBandWidth; }

  // Force a caption to its true rest-dead state: class flipped, tweens
  // killed, inline opacity pinned to 0 (not the spec's 0.18 mid-fade
  // value — that value is only ever a MOMENT during the crossing tween
  // below; the settled rest state for every non-live caption is fully
  // invisible, which is also what QA's "opacity <= 0.05 at rest" check
  // requires). Used both for the outgoing element's own kill/reset path
  // and for the defensive sweep below.
  function forceCaptionDead(el, gsapG) {
    if (!el) return;
    if (gsapG) gsapG.killTweensOf(el);
    el.classList.remove("is-live");
    el.classList.add("is-dead");
    el.style.opacity = "0";
    el.style.filter = "blur(2px)";
    el.style.transform = "";
  }

  function animateCaptionHandover(outIndex, outEl, inIndex, inEl, movingForward) {
    var gsapG = typeof window !== "undefined" ? window.gsap : null;
    var sign = movingForward ? -1 : 1;
    var myGen = transitionGeneration;

    // Kill in-flight tweens on the two elements this handover touches.
    // This is what stops a superseded transition's delayed onStart
    // from ever firing at all: the queued tween is destroyed, not
    // merely skipped. It is also what stops fast-scroll from leaving
    // two competing tweens (an old incoming, a new outgoing) fighting
    // over the same element's opacity/yPercent/filter at once — the
    // exact "up to four is-live captions" symptom QA reproduced.
    if (gsapG) {
      gsapG.killTweensOf(outEl);
      gsapG.killTweensOf(inEl);
    }

    // Defensive sweep: force every OTHER station dead too, so any
    // caption left is-live by a stale callback that slipped past the
    // kill above (or by any future bug) can never survive the next
    // transition. Six elements, cheap, and it makes "exactly one
    // is-live at any instant" a structural guarantee rather than a
    // hope resting on kill-timing alone.
    for (var i = 0; i < captionItems.length; i++) {
      var item = captionItems[i];
      if (i === inIndex || item === outEl) continue;
      if (item.classList.contains("is-live")) forceCaptionDead(item, gsapG);
    }

    if (!gsapG) {
      forceCaptionDead(outEl, null);
      if (inEl) {
        inEl.classList.add("is-live");
        inEl.classList.remove("is-dead");
        inEl.style.opacity = "1";
        inEl.style.filter = "blur(0px)";
        inEl.style.transform = "";
      }
      return;
    }

    if (outEl) {
      outEl.classList.remove("is-live");
      outEl.classList.add("is-dead");
      gsapG.to(outEl, {
        yPercent: sign * 40,
        opacity: 0,
        filter: "blur(2px)",
        duration: CONFIG.captionOutDur,
        ease: TORQUE.in,
        onComplete: function () {
          if (myGen !== transitionGeneration) return; // superseded — do not touch
          outEl.style.opacity = "0";
        }
      });
    }
    if (inEl) {
      gsapG.fromTo(
        inEl,
        { yPercent: sign * -110, filter: "blur(5px)", opacity: 0 },
        {
          yPercent: 0,
          filter: "blur(0px)",
          opacity: 1,
          duration: CONFIG.captionInDur,
          ease: TORQUE.out,
          delay: CONFIG.captionInDelay,
          onStart: function () {
            if (myGen !== transitionGeneration) return; // superseded — never resurrect
            inEl.classList.add("is-live");
            inEl.classList.remove("is-dead");
          }
        }
      );
    }
  }

  function updateCaptions(progress, movingForward) {
    if (!captionItems.length) return;
    var raw = rawStationFor(progress);
    if (raw === currentStation) return;
    var boundary = raw > currentStation ? stationBoundary(raw) : stationBoundary(currentStation);
    var crossedBy = raw > currentStation ? progress - boundary : boundary - progress;
    if (crossedBy <= CONFIG.captionHysteresis) return;
    var outIndex = currentStation, inIndex = raw;
    var outEl = outIndex >= 0 ? captionItems[outIndex] : null;
    var inEl = captionItems[inIndex];
    currentStation = raw;
    transitionGeneration++;
    animateCaptionHandover(outIndex, outEl, inIndex, inEl, movingForward);
  }
  // Station 0 starts live with no animation (first paint, no handover).
  if (captionItems.length) captionItems[0].classList.add("is-live");

  /* ============================================================
     bindScroll — Moment 3: called with no argument, creates the
     section 2 pin itself, exact config. Called with an argument
     (an existing ScrollTrigger), only reads .progress each frame —
     kept for back-compat with this lane's earlier WIRING.md bootstrap.
     ============================================================ */
  var selfCreatedScrollTrigger = null;
  function bindScroll(scrollTrigger) {
    if (scrollTrigger) {
      boundScrollTrigger = scrollTrigger;
      return scrollTrigger;
    }
    var ST = typeof window !== "undefined" ? window.ScrollTrigger : null;
    if (!ST) {
      console.info("[v3-hero] bindScroll() called with no ScrollTrigger global available; section 2 will not scrub.");
      return null;
    }
    var triggerEl = document.querySelector(CONFIG.pinTriggerSelector);
    var pinEl = document.querySelector(CONFIG.pinSelector);
    if (!triggerEl || !pinEl) {
      console.info("[v3-hero] bindScroll(): " + CONFIG.pinTriggerSelector + " / " + CONFIG.pinSelector + " not found in the DOM.");
      return null;
    }
    selfCreatedScrollTrigger = ST.create({
      id: "engineering",
      trigger: triggerEl,
      start: "top top",
      end: CONFIG.pinEnd,
      pin: pinEl,
      scrub: 1,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      // Root cause of the "ring absent" defect (Bob's screenshot review,
      // DEFECT 1): the rAF render loop — which is the ONLY thing that
      // advances uRingReveal, the camera scrub lerp, rotation and
      // captions — is gated on `visibleInViewport`, which the
      // IntersectionObserver below computes against `section`, i.e. the
      // canvas's own ancestor [data-slot="hero"] box in NORMAL document
      // flow. During this pin, v3.css's .is-engineering-live makes only
      // the child .v3-hero-stage position:fixed (so the one canvas stays
      // visually on screen) — the ancestor section itself keeps scrolling
      // away underneath. Once it passes the observer's 400px rootMargin
      // (measured: around 15-20% into the pin's 2250px scroll distance at
      // 1440x900), visibleInViewport flips false and the ENTIRE render
      // loop stops, freezing uRingReveal/camera/rotation at whatever they
      // last were — sometimes still near 0 if the freeze lands early,
      // which is what produced "ring absent". onToggle fires exactly at
      // pin engage/disengage (GSAP: whenever .isActive flips), so
      // evaluateMotionMode() re-runs at both boundaries and its condition
      // now also treats an active pin as "visible" (see below) — the loop
      // then keeps running for the pin's FULL duration regardless of the
      // stale ancestor-section intersection state.
      onToggle: function () { evaluateMotionMode(); },
    });
    boundScrollTrigger = selfCreatedScrollTrigger;
    return selfCreatedScrollTrigger;
  }
  function unbindScroll() { boundScrollTrigger = null; }

  /* ---------- render loop ---------- */
  var lastScrubProgress = 0;
  var elapsed = 0;
  var scratchCamPos = new THREE.Vector3();
  var scratchCamTarget = new THREE.Vector3();

  function ringRevealFor(progress) {
    // DEFECT 1 requirement: ramp 0->1 over the FIRST 15% of the pin's
    // scroll range (was 0.06 — too fast to ever read as a deliberate
    // reveal, and, combined with the render-loop freeze fixed in
    // bindScroll() above, meant the ring could freeze invisible before
    // it finished ramping at all). Fade-out window at the tail (last 6%)
    // is unchanged — not part of this defect's required behavior.
    if (progress < 0.15) return clamp(progress / 0.15, 0, 1);
    if (progress > 0.94) return clamp(1 - (progress - 0.94) / 0.06, 0, 1);
    return 1;
  }

  function renderFrame(dt) {
    var scrubProgress = boundScrollTrigger ? clamp(boundScrollTrigger.progress || 0, 0, 1) : 0;
    var movingForward = boundScrollTrigger && typeof boundScrollTrigger.direction === "number"
      ? boundScrollTrigger.direction >= 0
      : scrubProgress >= lastScrubProgress;

    if (!reducedMotionActive()) {
      elapsed += dt;

      objectGroup.rotation.y +=
        (CONFIG.idleSpinRadPerSec + spinVelocity) * dt +
        CONFIG.scrubTurns * (scrubProgress - lastScrubProgress);
      lastScrubProgress = scrubProgress;

      spinVelocity *= Math.pow(CONFIG.spinDecayBase, 60 * dt);
      if (Math.abs(spinVelocity) < 0.0005) spinVelocity = 0;

      // Moment 2 lever 3: specular light orbits counter to idle spin.
      specularAngle += -CONFIG.specularOrbitSpeed * dt;
      specular.position.set(
        Math.sin(specularAngle) * CONFIG.specularRadius,
        CONFIG.specularY,
        Math.cos(specularAngle) * CONFIG.specularRadius
      );

      if (ringUniformsRef) {
        ringUniformsRef.uTime.value = elapsed;
        // Unbound fallback was `1` (full opacity) — visible for the brief
        // window between mount and index.html's bindScroll() call, which
        // could render the ring in front of her face at rest, violating
        // "the ring must never render in front of her face at rest."
        // 0 (hidden) matches ringRevealFor(0) exactly, so there is no pop
        // once boundScrollTrigger is actually attached.
        ringUniformsRef.uRingReveal.value = boundScrollTrigger ? ringRevealFor(scrubProgress) : 0;
      }

      if (boundScrollTrigger) updateCaptions(scrubProgress, movingForward);

      parallaxX = damp(parallaxX, pointerTargetX, CONFIG.parallaxLambda, dt);
      parallaxY = damp(parallaxY, pointerTargetY, CONFIG.parallaxLambda, dt);

      if (boundScrollTrigger) {
        scratchCamPos.lerpVectors(CONFIG.cameraRestPos, CONFIG.cameraScrubPos, scrubProgress);
        scratchCamTarget.lerpVectors(CONFIG.cameraRestTarget, CONFIG.cameraScrubTarget, scrubProgress);
      } else {
        scratchCamPos.copy(CONFIG.cameraRestPos);
        scratchCamTarget.copy(CONFIG.cameraRestTarget);
      }
      dampVec3(camera.position, scratchCamPos, CONFIG.parallaxLambda * 0.6, dt);
      camera.position.x += parallaxX;
      camera.position.y += parallaxY;
      camera.lookAt(scratchCamTarget);
    }

    renderer.render(scene, camera);
  }

  function loop(t) {
    if (!running) return;
    var dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 1 / 60;
    lastT = t;
    renderFrame(dt);
    rafId = requestAnimationFrame(loop);
  }
  function startLoop() {
    if (running) return;
    running = true; lastT = 0;
    rafId = requestAnimationFrame(loop);
  }
  function stopLoop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function renderReducedMotionFrame() {
    objectGroup.rotation.y = Math.PI * 0.18;
    camera.position.copy(CONFIG.cameraRestPos);
    camera.lookAt(CONFIG.cameraRestTarget);
    if (ringUniformsRef) { ringUniformsRef.uRingReveal.value = 1; ringUniformsRef.uTime.value = 0; }
    // Reduced motion, Moment 3: all six captions render at full
    // opacity simultaneously (no pin/scrub/ring motion at all).
    captionItems.forEach(function (el) { el.classList.add("is-live"); el.classList.remove("is-dead"); });
    renderer.render(scene, camera);
  }

  function evaluateMotionMode() {
    stopLoop();
    detachInteraction();
    // pinActive: the section-2 walk-around keeps .v3-hero-stage visually
    // on screen (position:fixed) even once the canvas's own ancestor
    // [data-slot="hero"] section has scrolled out of visibleInViewport's
    // tracked box — see bindScroll()'s onToggle comment. Without this
    // OR, the render loop (camera scrub, uRingReveal, rotation, captions)
    // stops partway through the pin.
    var pinActive = !!(boundScrollTrigger && boundScrollTrigger.isActive);
    if (reducedMotionActive()) {
      finalizeArrivalValuesImmediately();
      renderReducedMotionFrame();
    } else if ((visibleInViewport || pinActive) && !document.hidden) {
      attachInteraction();
      startLoop();
    }
  }

  var io = null;
  if (typeof IntersectionObserver !== "undefined") {
    io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) { visibleInViewport = entry.isIntersecting; });
        evaluateMotionMode();
      },
      { rootMargin: CONFIG.ioRootMargin, threshold: 0 }
    );
    io.observe(section || canvas);
  } else {
    visibleInViewport = true;
  }

  function onVisibilityChange() { evaluateMotionMode(); }
  document.addEventListener("visibilitychange", onVisibilityChange);

  var reducedMotionMql = typeof window.matchMedia !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  function onReducedMotionChange() { evaluateMotionMode(); }
  if (reducedMotionMql) {
    if (reducedMotionMql.addEventListener) reducedMotionMql.addEventListener("change", onReducedMotionChange);
    else if (reducedMotionMql.addListener) reducedMotionMql.addListener(onReducedMotionChange);
  }

  renderer.render(scene, camera); // first paint, before IO/arrival resolve
  evaluateMotionMode();

  /* ---------- releaseAtFooter (Moment 7, amended) ----------
     Director's round2 ruling (24 Sep, evidenced by round2-final-
     section-hero.png): the original wiring called the full destroy()
     below the instant #footer-statement hit 98% in view. Reproduced
     on both headless AND headed/DISPLAY=:0 real-GPU Chromium — this
     was never a sandbox artefact. Root cause, found with
     elementsFromPoint() + a WebGL isContextLost() read at the exact
     white rect: destroy() disposes the renderer and then calls
     forceContextLoss(). The canvas is created with alpha:false (see
     9ff1648), so it is an OPAQUE compositor layer; once its context is
     lost the drawing buffer's contents are undefined by spec, and this
     GPU/driver paints that undefined opaque buffer white. The canvas
     sits at z-index:1, directly over .v3-hero-poster (auto/0) in the
     same stage box, so the (perfectly intact, still-loaded) poster
     underneath is fully obscured. Confirmed: with the context NOT
     force-lost, none of this applies, because a canvas nobody is
     drawing to any more simply keeps showing its last rendered frame
     forever (three.js/WebGL default — no separate "freeze" step
     needed).
     Fix: the footer hook below now calls releaseAtFooter(), not
     destroy(). It only stops the render loop (idempotent — the
     existing IntersectionObserver above already stops it once the
     hero itself scrolls out of view, same mechanism that already
     pauses/resumes across ordinary scrolling; this call is just a
     defensive no-op belt for the footer path specifically). It
     deliberately does NOT dispose the ring atlas texture or anything
     else: the ring mesh is built once at init (buildRingMesh(), not
     re-buildable cheaply), so disposing its texture here would trade
     a small, unmeasured VRAM saving for a real risk of a blank/broken
     ring on the next return to the engineering pin. Bob's ruling says
     ring textures "may" be dropped, not must — this build chooses not
     to, and says so here rather than silently doing less than the
     comment claims. The render loop resumes on its own, through the
     SAME IntersectionObserver/evaluateMotionMode() path used for
     every other scroll-out/scroll-in cycle, because io stays connected
     (releaseAtFooter never calls io.disconnect()) — scrolling the hero
     back into view re-triggers visibleInViewport=true exactly as it
     always has. No separate re-init path was needed once the context
     is never lost in the first place. */
  function releaseAtFooter() {
    stopLoop();
  }

  /* ---------- destroy ---------- */
  var destroyed = false;
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    bumpHeroInstanceCount(-1);
    stopLoop();
    detachInteraction();
    if (io) io.disconnect();
    if (resizeObserver) resizeObserver.disconnect();
    window.removeEventListener("resize", applyDpr);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    if (reducedMotionMql) {
      if (reducedMotionMql.removeEventListener) reducedMotionMql.removeEventListener("change", onReducedMotionChange);
      else if (reducedMotionMql.removeListener) reducedMotionMql.removeListener(onReducedMotionChange);
    }
    if (arrivalTimeline) arrivalTimeline.kill();
    if (selfCreatedScrollTrigger) selfCreatedScrollTrigger.kill();
    cancelAnimationFrame(ringShaderCheckId);
    scene.traverse(function (node) {
      if (node.geometry) node.geometry.dispose();
      if (node.material) {
        var mats = Array.isArray(node.material) ? node.material : [node.material];
        mats.forEach(function (m) { if (m.map) m.map.dispose(); m.dispose(); });
      }
    });
    roughnessMap.dispose();
    dracoLoader.dispose();
    renderer.dispose();
    // Amended Moment 7 ruling (24 Sep, round2): this full teardown,
    // including forceContextLoss(), now runs ONLY from a real
    // pagehide/unload listener (wired in v3-core.js's
    // wireFooterHeroRelease) — never from scroll position any more.
    // The context-loss extension actually frees the GPU-side resources
    // (VRAM, the GL context itself) rather than just three.js's own
    // CPU-side bookkeeping — renderer.dispose() alone does not do
    // this. Safe to call unconditionally here because the page is
    // already going away: WEBGL_lose_context is a core extension on
    // every WebGL1/2 context this renderer creates.
    if (typeof renderer.forceContextLoss === "function") renderer.forceContextLoss();
  }

  return {
    bindScroll: bindScroll,
    unbindScroll: unbindScroll,
    releaseAtFooter: releaseAtFooter,
    destroy: destroy,
    setReducedMotion: evaluateMotionMode,
    _debug: {
      scene: scene, camera: camera, renderer: renderer,
      usingStandIn: function () { return usingStandIn; },
      currentStation: function () { return currentStation; },
      // Coordinator order 24 Sep, exposure pass: mean luminance of the
      // pixels inside the object's on-screen bounding box, plus
      // whether the plinth-top edge reads as a visible line. Needs
      // preserveDrawingBuffer:true on the renderer (set above) so the
      // canvas still holds the last frame when this runs. Draws the
      // WebGL canvas onto a plain 2D canvas (readback method that
      // works the same whether the GL context is WebGL1 or WebGL2,
      // rather than gl.readPixels against whichever it turns out to
      // be) and reads relative luminance (ITU-R BT.709 coefficients)
      // from the RGBA bytes.
      measureLuminance: function () {
        var rect = canvas.getBoundingClientRect();
        var pxRatio = canvas.width / Math.max(1, rect.width);
        var box = new THREE.Box3().setFromObject(objectGroup);
        var corners = [
          [box.min.x, box.min.y, box.min.z], [box.max.x, box.min.y, box.min.z],
          [box.min.x, box.max.y, box.min.z], [box.max.x, box.max.y, box.min.z],
          [box.min.x, box.min.y, box.max.z], [box.max.x, box.min.y, box.max.z],
          [box.min.x, box.max.y, box.max.z], [box.max.x, box.max.y, box.max.z],
        ];
        var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        var v = new THREE.Vector3();
        corners.forEach(function (c) {
          v.set(c[0], c[1], c[2]).project(camera);
          var px = (v.x * 0.5 + 0.5) * canvas.width;
          var py = (1 - (v.y * 0.5 + 0.5)) * canvas.height;
          minX = Math.min(minX, px); maxX = Math.max(maxX, px);
          minY = Math.min(minY, py); maxY = Math.max(maxY, py);
        });
        minX = Math.max(0, Math.floor(minX)); minY = Math.max(0, Math.floor(minY));
        maxX = Math.min(canvas.width, Math.ceil(maxX)); maxY = Math.min(canvas.height, Math.ceil(maxY));
        var w = Math.max(1, maxX - minX), h = Math.max(1, maxY - minY);

        var copy = document.createElement("canvas");
        copy.width = canvas.width; copy.height = canvas.height;
        copy.getContext("2d").drawImage(canvas, 0, 0);
        var ctx2d = copy.getContext("2d");
        var data = ctx2d.getImageData(minX, minY, w, h).data;
        var sum = 0, count = w * h;
        for (var i = 0; i < data.length; i += 4) {
          sum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
        }
        var meanLuminance = count ? sum / count : 0;

        // Plinth-top edge row: project the edge-highlight ring's own
        // world Y at the plinth center to a screen row, scan its full
        // canvas width, report the fraction of pixels over 0.15.
        v.set(0, CONFIG.plinthTopY + 0.004, CONFIG.plinthDepth / 2 - 0.04).project(camera);
        var edgeRowY = Math.round((1 - (v.y * 0.5 + 0.5)) * canvas.height);
        edgeRowY = Math.max(0, Math.min(canvas.height - 1, edgeRowY));
        // "Across at least 60% of its width" is read as 60% of the
        // PLINTH's own on-screen width, not the full canvas row — most
        // of the canvas row is black background beside the plinth at
        // this framing (object occupies roughly the lower two-thirds,
        // not the full frame width), so a literal full-canvas-row
        // reading could never pass regardless of how bright the edge
        // is. Plinth screen-space X extent comes from its own four top
        // corners, same projection method as the object bbox above.
        var plinthHalfW = CONFIG.plinthWidth / 2, plinthHalfD = CONFIG.plinthDepth / 2;
        var plinthCorners = [
          [-plinthHalfW, CONFIG.plinthTopY, -plinthHalfD], [plinthHalfW, CONFIG.plinthTopY, -plinthHalfD],
          [-plinthHalfW, CONFIG.plinthTopY, plinthHalfD], [plinthHalfW, CONFIG.plinthTopY, plinthHalfD],
        ];
        var plinthMinX = Infinity, plinthMaxX = -Infinity;
        plinthCorners.forEach(function (c) {
          v.set(c[0], c[1], c[2]).project(camera);
          var px = (v.x * 0.5 + 0.5) * canvas.width;
          plinthMinX = Math.min(plinthMinX, px); plinthMaxX = Math.max(plinthMaxX, px);
        });
        plinthMinX = Math.max(0, Math.floor(plinthMinX));
        plinthMaxX = Math.min(canvas.width, Math.ceil(plinthMaxX));
        var rowW = Math.max(1, plinthMaxX - plinthMinX);
        var rowData = ctx2d.getImageData(plinthMinX, edgeRowY, rowW, 1).data;
        var overThreshold = 0;
        for (var j = 0; j < rowData.length; j += 4) {
          var l = (0.2126 * rowData[j] + 0.7152 * rowData[j + 1] + 0.0722 * rowData[j + 2]) / 255;
          if (l > 0.15) overThreshold++;
        }
        var edgeFraction = overThreshold / (rowData.length / 4);

        return {
          meanLuminance: meanLuminance,
          bboxPx: { x: minX, y: minY, w: w, h: h },
          edgeRowY: edgeRowY,
          plinthEdgeVisibleFraction: edgeFraction,
          plinthEdgeVisible: edgeFraction >= 0.6,
        };
      },
      // Coordinator order 24 Sep, plinth-material pass (fix 2): "mean
      // luminance of the plinth front face in the screenshot at most
      // 0.12." Samples the LEFT and RIGHT margins of the plinth's
      // front vertical face (each the outer ~22% of its on-screen
      // width, full height) rather than the whole face, because the
      // object itself stands in front of the face's centre — at this
      // framing the object is narrower than the 1.9-unit-wide plinth,
      // so both margins are genuine exposed plinth material and never
      // object pixels, without needing per-pixel object/plinth
      // segmentation. Same canvas-readback method as measureLuminance.
      measurePlinthFrontLuminance: function () {
        var w = CONFIG.plinthWidth / 2, d = CONFIG.plinthDepth / 2;
        var corners = [
          [-w, 0, d], [w, 0, d], [-w, CONFIG.plinthTopY, d], [w, CONFIG.plinthTopY, d],
        ];
        var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        var v = new THREE.Vector3();
        corners.forEach(function (c) {
          v.set(c[0], c[1], c[2]).project(camera);
          var px = (v.x * 0.5 + 0.5) * canvas.width;
          var py = (1 - (v.y * 0.5 + 0.5)) * canvas.height;
          minX = Math.min(minX, px); maxX = Math.max(maxX, px);
          minY = Math.min(minY, py); maxY = Math.max(maxY, py);
        });
        minX = Math.max(0, Math.floor(minX)); minY = Math.max(0, Math.floor(minY));
        maxX = Math.min(canvas.width, Math.ceil(maxX)); maxY = Math.min(canvas.height, Math.ceil(maxY));
        var faceW = Math.max(1, maxX - minX), faceH = Math.max(1, maxY - minY);
        var marginW = Math.max(1, Math.round(faceW * 0.22));

        var copy = document.createElement("canvas");
        copy.width = canvas.width; copy.height = canvas.height;
        copy.getContext("2d").drawImage(canvas, 0, 0);
        var ctx2d = copy.getContext("2d");

        function meanLumOf(x, w2, y, h2) {
          if (w2 <= 0 || h2 <= 0) return 0;
          var data = ctx2d.getImageData(x, y, w2, h2).data;
          var sum = 0, count = w2 * h2;
          for (var i = 0; i < data.length; i += 4) {
            sum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
          }
          return count ? sum / count : 0;
        }
        var leftLum = meanLumOf(minX, marginW, minY, faceH);
        var rightLum = meanLumOf(maxX - marginW, marginW, minY, faceH);
        return {
          meanLuminance: (leftLum + rightLum) / 2,
          leftLuminance: leftLum,
          rightLuminance: rightLum,
          facePx: { x: minX, y: minY, w: faceW, h: faceH, marginW: marginW },
        };
      },
    },
  };
}
