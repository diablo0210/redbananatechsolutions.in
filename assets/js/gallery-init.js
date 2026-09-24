/**
 * gallery-init.js
 * Mounts the shared R&D gallery-scene.js corridor (js/gallery-scene.js,
 * copied verbatim from the parallel scene R&D build — not forked, not
 * reimplemented) and bridges it to the classic, non-module js/main.js via
 * window.RBGallery. main.js owns scroll math and DOM choreography; this
 * file owns only construction and the onReady handoff.
 *
 * Reduced motion is handled by NOT mounting the scene at all: main.js's
 * reduced-motion path shows the static poster + a complete text grid
 * instead (see css/style.css .reduced-motion rules), so there is nothing
 * for this module to do in that case.
 */
import { createGalleryScene } from './gallery-scene.js';

const canvas = document.getElementById('gallery-canvas');
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

window.RBGallery = {
  ready: false,
  setProgress() {},
  setPointer() {},
};

if (canvas && !prefersReduced) {
  const scene = createGalleryScene(canvas, {
    // Red Banana's brand vermilion (direction ruling), not the R&D
    // default — the engine takes colour as a parameter precisely so a
    // site doesn't need its own fork to change it.
    signalColor: '#e2422e',
    // "Medium" tier: verified legible at rest with pillars + one lit
    // installation in the very first frame, and the tier the coordinator
    // named directly. Base brightness raised via a CSS filter on the
    // canvas (see css/style.css #gallery-canvas) rather than editing the
    // vetted engine file.
    quality: 'medium',
    // Wave 2 merge (Bob 25, integrator): one mid-distance installation
    // reads at 18% brightness at rest, so the first frame — poster,
    // no-JS fallback and pre-resolve canvas alike, since getStillFrame()
    // renders this same rest state — is legible before any scroll,
    // without forking gallery-scene.js. See its own comment at the top
    // of the engine for the option's definition.
    restLift: 0.18,
    onReady() {
      window.RBGallery.ready = true;
      document.body.classList.add('js-ready');
      window.dispatchEvent(new CustomEvent('rb-gallery-ready'));
    },
  });

  window.RBGallery.setProgress = (t) => scene.setProgress(t);
  window.RBGallery.setPointer = (x, y) => scene.setPointer(x, y);
  window.RBGallery._scene = scene; // for console/playwright verification only
}
