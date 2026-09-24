/**
 * gallery-scene.js
 * "The Gallery You Walk Through": Red Banana flagship hero scene.
 *
 * A dark exhibition space the visitor moves through on scroll. Six
 * installations (a plinth, a screen, a suspended object, a projection wall,
 * repeated) light up as the camera nears them. Pointer input adds a small
 * parallax look-around, never a position change.
 *
 * DEPENDENCY: this module expects the UMD Three.js build to already be
 * loaded as `window.THREE` (r160, vendored at ./vendor/three.min.js). Load
 * it with a plain classic <script> tag before importing this module, see
 * demo.html. The r180 ESM file that ships in the shared web-motion-kit
 * vendor/ directory is a trimmed subset (no Scene, no lights, no
 * InstancedMesh) and cannot build this scene; the UMD r160 build carries
 * the full API and is what this module was written and measured against.
 *
 * API:
 *   const scene = createGalleryScene(canvasEl, { signalColor, onReady, quality, static, restLift })
 *   restLift (0..1, default 0): floor brightness for one mid-distance
 *   installation so the rest frame (progress 0) isn't fully dark. Added
 *   for the website-rb-bg Wave 2 merge; does not affect any other caller
 *   that leaves it unset.
 *   scene.setProgress(t)      // 0..1, drive from scroll
 *   scene.setPointer(x, y)    // -1..1
 *   scene.pause() / scene.resume()
 *   scene.destroy()
 *   scene.getStillFrame(mime, quality) -> data URL, for regenerating the fallback poster
 *   scene.getStats() -> { calls, triangles, ... } from renderer.info, for perf verification
 *
 * No per-frame allocation in the render loop: every Vector3/Color used each
 * frame is created once at setup and mutated in place.
 */

const QUALITY_PRESETS = {
  low: {
    maxDPR: 1,
    pillarPairs: 5, // 10 pillars total
    antialias: false,
    glow: false,
    grainSize: 128,
    fogFar: 70,
  },
  medium: {
    maxDPR: 1.5,
    pillarPairs: 8, // 16 pillars total
    antialias: false,
    glow: true,
    grainSize: 192,
    fogFar: 100,
  },
  high: {
    maxDPR: 2,
    pillarPairs: 12, // 24 pillars total
    antialias: true,
    glow: true,
    grainSize: 256,
    fogFar: 130,
  },
};

const GALLERY_LENGTH = 160; // world units, entrance (z=0) to back wall (z=-160)
const GALLERY_WIDTH = 14;
const EYE_HEIGHT = 3.2;

// Six installations, alternating sides, spaced down the hall. Kind cycles
// through the four forms named in the brief.
const INSTALLATION_KINDS = ['plinth', 'screen', 'suspended', 'projection'];
const INSTALLATION_COUNT = 6;

function makeGrainTexture(THREE, size, signalColor) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Base near-black ground.
  ctx.fillStyle = '#07080a';
  ctx.fillRect(0, 0, size, size);

  // Sparse fine grain, cheap to bake once, reads as a museum floor texture
  // rather than a flat colour.
  const grainCount = Math.round(size * size * 0.12);
  for (let i = 0; i < grainCount; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const v = Math.random() * 14; // faint variance above the base
    ctx.fillStyle = `rgba(${255}, ${255}, ${255}, ${(v / 255).toFixed(3)})`;
    ctx.fillRect(x, y, 1, 1);
  }

  // A faint long streak down the centre fakes a soft reflective sheen
  // without a real reflection pass.
  const grad = ctx.createLinearGradient(0, 0, size, 0);
  const sc = signalColor;
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.5, `rgba(${sc.r * 255 | 0},${sc.g * 255 | 0},${sc.b * 255 | 0},0.05)`);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(GALLERY_WIDTH / 4, GALLERY_LENGTH / 4);
  tex.anisotropy = 1;
  return tex;
}

function makeGlowSpriteTexture(THREE) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

function buildInstallationGeometry(THREE, kind) {
  // Returns an array of { geometry, localPosition, localRotationY } for the
  // given kind, kept deliberately low-poly.
  switch (kind) {
    case 'plinth':
      return [
        { geometry: new THREE.CylinderGeometry(0.6, 0.72, 1.5, 8), y: 0.75, form: 'base' },
        { geometry: new THREE.IcosahedronGeometry(0.42, 0), y: 1.85, form: 'glow' },
      ];
    case 'screen':
      return [
        { geometry: new THREE.BoxGeometry(2.1, 1.3, 0.09), y: 1.7, form: 'glow' },
      ];
    case 'suspended':
      return [
        { geometry: new THREE.OctahedronGeometry(0.52, 0), y: 2.6, form: 'glow' },
      ];
    case 'projection':
      return [
        { geometry: new THREE.PlaneGeometry(3.1, 4.2), y: 2.4, form: 'glow' },
      ];
    default:
      return [];
  }
}

export function createGalleryScene(canvasEl, options = {}) {
  const THREE = typeof window !== 'undefined' ? window.THREE : null;
  if (!THREE || !canvasEl) {
    console.error('[gallery-scene] THREE (UMD, window.THREE) or canvasEl missing, scene not started.');
    return {
      setProgress() {},
      setPointer() {},
      pause() {},
      resume() {},
      destroy() {},
      getStillFrame() { return null; },
      getStats() { return null; },
    };
  }

  const qualityKey = QUALITY_PRESETS[options.quality] ? options.quality : 'medium';
  const preset = QUALITY_PRESETS[qualityKey];
  const staticMode = !!options.static;
  const signalColorHex = options.signalColor || '#ff5a36';
  const signalColor = new THREE.Color(signalColorHex);
  // Wave 2 integration note (Bob 25, merge into website-rb-bg): at rest
  // (progress 0, camera at the entrance) every installation sits beyond
  // FAR_LIT and reads fully dark, so the very first frame — the no-JS/
  // pre-resolve poster included, since getStillFrame() renders this same
  // state — was darker than the brief's "legible at rest" floor wants.
  // Rather than fork the engine per site, one small option: a floor value
  // for exactly one mid-distance installation, so a single low-level glow
  // is already visible before any scroll. Default 0 preserves the engine's
  // original all-dark rest state for any caller that doesn't opt in.
  const restLift = Math.max(0, Math.min(1, typeof options.restLift === 'number' ? options.restLift : 0));
  const restLiftIndex = Math.floor(INSTALLATION_COUNT / 2); // the mid-distance station

  // ---- renderer -----------------------------------------------------
  const renderer = new THREE.WebGLRenderer({
    canvas: canvasEl,
    antialias: preset.antialias,
    alpha: false,
    powerPreference: 'high-performance',
    stencil: false,
    depth: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, preset.maxDPR));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  renderer.shadowMap.enabled = false; // no shadow maps, ever: frame budget

  // ---- scene ----------------------------------------------------------
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#050608');
  scene.fog = new THREE.FogExp2(0x050608, 3.4 / preset.fogFar);

  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 300);
  camera.position.set(0, EYE_HEIGHT, 4);

  // ---- lights: two only, no shadows ------------------------------------
  const hemi = new THREE.HemisphereLight(0x8892a6, 0x030304, 0.8);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 0.85);
  key.position.set(-6, 12, 6);
  key.castShadow = false;
  scene.add(key);
  // A dim signal-coloured fill from the far end, ties the whole hall to the
  // brand colour without adding another real light per installation.
  const fill = new THREE.DirectionalLight(signalColorHex, 0.18);
  fill.position.set(4, 4, -GALLERY_LENGTH);
  fill.castShadow = false;
  scene.add(fill);

  // ---- floor ------------------------------------------------------------
  const grainTex = makeGrainTexture(THREE, preset.grainSize, signalColor);
  const floorGeo = new THREE.PlaneGeometry(GALLERY_WIDTH + 6, GALLERY_LENGTH + 20, 1, 1);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x0b0c10,
    roughness: 0.32,
    metalness: 0.55,
    map: grainTex,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -GALLERY_LENGTH / 2 + 10);
  scene.add(floor);

  // ---- pillars: one InstancedMesh, one draw call -------------------------
  const pillarCount = preset.pillarPairs * 2;
  const pillarGeo = new THREE.BoxGeometry(1.1, 7.5, 1.1);
  const pillarMat = new THREE.MeshStandardMaterial({
    color: 0x111319,
    roughness: 0.6,
    metalness: 0.25,
  });
  const pillars = new THREE.InstancedMesh(pillarGeo, pillarMat, pillarCount);
  pillars.castShadow = false;
  pillars.receiveShadow = false;
  {
    const dummy = new THREE.Object3D();
    const spacing = GALLERY_LENGTH / preset.pillarPairs;
    let idx = 0;
    for (let i = 0; i < preset.pillarPairs; i++) {
      const z = -4 - i * spacing;
      for (let side = -1; side <= 1; side += 2) {
        dummy.position.set(side * (GALLERY_WIDTH / 2 + 1.2), 3.75, z);
        dummy.updateMatrix();
        pillars.setMatrixAt(idx, dummy.matrix);
        idx++;
      }
    }
    pillars.instanceMatrix.needsUpdate = true;
  }
  scene.add(pillars);

  // ---- camera path ------------------------------------------------------
  const pathPoints = [
    new THREE.Vector3(0, EYE_HEIGHT, 4),
    new THREE.Vector3(1.2, EYE_HEIGHT, -18),
    new THREE.Vector3(-1.6, EYE_HEIGHT, -44),
    new THREE.Vector3(1.4, EYE_HEIGHT, -74),
    new THREE.Vector3(-1.2, EYE_HEIGHT, -106),
    new THREE.Vector3(0.8, EYE_HEIGHT, -134),
    new THREE.Vector3(0, EYE_HEIGHT, -GALLERY_LENGTH + 6),
  ];
  const cameraCurve = new THREE.CatmullRomCurve3(pathPoints, false, 'catmullrom', 0.4);

  // ---- installations ------------------------------------------------------
  const glowSpriteTex = preset.glow ? makeGlowSpriteTexture(THREE) : null;
  const installations = [];
  for (let i = 0; i < INSTALLATION_COUNT; i++) {
    const kind = INSTALLATION_KINDS[i % INSTALLATION_KINDS.length];
    const t = (i + 1) / (INSTALLATION_COUNT + 1);
    const along = cameraCurve.getPointAt(t);
    const side = i % 2 === 0 ? 1 : -1;
    const basePos = new THREE.Vector3(along.x + side * (GALLERY_WIDTH / 2 - 1.6), 0, along.z);

    const group = new THREE.Group();
    group.position.copy(basePos);
    group.rotation.y = side > 0 ? -Math.PI / 2.4 : Math.PI / 2.4;

    const parts = buildInstallationGeometry(THREE, kind);
    const glowMeshes = [];
    for (const part of parts) {
      let mat;
      if (part.form === 'glow') {
        mat = new THREE.MeshBasicMaterial({
          color: signalColor.clone().multiplyScalar(0.15),
          toneMapped: true,
        });
        glowMeshes.push(mat);
      } else {
        mat = new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.5, metalness: 0.3 });
      }
      const mesh = new THREE.Mesh(part.geometry, mat);
      mesh.position.y = part.y;
      group.add(mesh);
    }

    let sprite = null;
    if (glowSpriteTex) {
      const spriteMat = new THREE.SpriteMaterial({
        map: glowSpriteTex,
        color: signalColor,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(3.2, 3.2, 1);
      sprite.position.y = 2.0;
      group.add(sprite);
    }

    scene.add(group);
    installations.push({
      position: basePos, // world-space, used for distance calc, never reallocated
      glowMeshes,
      sprite,
      baseGlowColor: signalColor.clone(),
    });
  }

  // ---- resize -------------------------------------------------------------
  function resize() {
    const w = canvasEl.clientWidth || window.innerWidth;
    const h = canvasEl.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(canvasEl);
  window.addEventListener('resize', resize);

  // ---- state, all reused scratch objects (no per-frame allocation) --------
  let progress = 0;
  let pointerX = 0;
  let pointerY = 0;
  let smoothPointerX = 0;
  let smoothPointerY = 0;
  let running = false;
  let userPaused = false;
  let hiddenPaused = document.hidden;
  let intersectionPaused = false;
  let firstFrameDone = false;
  let rafId = null;

  const scratchTarget = new THREE.Vector3();
  const scratchLookTarget = new THREE.Vector3();
  const scratchRight = new THREE.Vector3();
  const scratchUp = new THREE.Vector3(0, 1, 0);
  const scratchDir = new THREE.Vector3();
  const scratchDelta = new THREE.Vector3();

  const NEAR_LIT = 12 * 12; // squared distances, avoids sqrt every frame
  const FAR_LIT = 34 * 34;

  function updateCamera() {
    const t = Math.max(0, Math.min(1, progress));
    cameraCurve.getPointAt(t, scratchTarget);
    camera.position.lerp(scratchTarget, staticMode ? 1 : 0.12);

    const lookT = Math.min(1, t + 0.035);
    cameraCurve.getPointAt(lookT, scratchLookTarget);

    // Pointer parallax: shift the look target sideways/vertically using the
    // camera's own right/up, so it always reads as a look-around, never a
    // strafe.
    smoothPointerX += (pointerX - smoothPointerX) * (staticMode ? 1 : 0.08);
    smoothPointerY += (pointerY - smoothPointerY) * (staticMode ? 1 : 0.08);

    scratchDir.subVectors(scratchLookTarget, camera.position).normalize();
    scratchRight.crossVectors(scratchDir, scratchUp).normalize();
    scratchLookTarget.addScaledVector(scratchRight, smoothPointerX * 1.4);
    scratchLookTarget.y += smoothPointerY * 0.6;

    camera.lookAt(scratchLookTarget);
  }

  function updateInstallations() {
    for (let i = 0; i < installations.length; i++) {
      const inst = installations[i];
      scratchDelta.subVectors(camera.position, inst.position);
      const d2 = scratchDelta.lengthSq();
      let lit = 1 - (d2 - NEAR_LIT) / (FAR_LIT - NEAR_LIT);
      lit = Math.max(0.06, Math.min(1, lit));
      if (i === restLiftIndex) lit = Math.max(lit, restLift);

      for (let m = 0; m < inst.glowMeshes.length; m++) {
        inst.glowMeshes[m].color.copy(inst.baseGlowColor).multiplyScalar(0.15 + lit * 1.4);
      }
      if (inst.sprite) {
        inst.sprite.material.opacity = lit * 0.85;
      }
    }
  }

  function renderFrame() {
    updateCamera();
    updateInstallations();
    renderer.render(scene, camera);
    if (!firstFrameDone) {
      firstFrameDone = true;
      if (typeof options.onReady === 'function') options.onReady();
    }
  }

  function loop() {
    rafId = requestAnimationFrame(loop);
    renderFrame();
  }

  function computeRunning() {
    return !userPaused && !hiddenPaused && !intersectionPaused;
  }

  function syncRunning() {
    const shouldRun = computeRunning();
    if (shouldRun && !running) {
      running = true;
      if (!staticMode) {
        rafId = requestAnimationFrame(loop);
      } else if (!firstFrameDone) {
        renderFrame();
      }
    } else if (!shouldRun && running) {
      running = false;
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }
  }

  // First frame renders immediately on construction (procedural scene, no
  // asset loading) so the canvas shows something coherent well inside the
  // 300ms budget, then the loop takes over.
  renderFrame();
  syncRunning();

  // ---- visibility + intersection pausing -----------------------------------
  function onVisibilityChange() {
    hiddenPaused = document.hidden;
    syncRunning();
  }
  document.addEventListener('visibilitychange', onVisibilityChange);

  let io = null;
  if (typeof IntersectionObserver !== 'undefined') {
    io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        intersectionPaused = !entry.isIntersecting;
      }
      syncRunning();
    }, { threshold: 0.01 });
    io.observe(canvasEl);
  }

  // ---- public API -----------------------------------------------------------
  return {
    setProgress(t) {
      progress = t;
      if (staticMode) {
        // Static mode still tracks scroll position but renders a single
        // frame per call rather than running a continuous loop.
        renderFrame();
      }
    },
    setPointer(x, y) {
      pointerX = Math.max(-1, Math.min(1, x));
      pointerY = Math.max(-1, Math.min(1, y));
      if (staticMode) renderFrame();
    },
    pause() {
      userPaused = true;
      syncRunning();
    },
    resume() {
      userPaused = false;
      syncRunning();
    },
    destroy() {
      userPaused = true;
      if (rafId != null) cancelAnimationFrame(rafId);
      rafId = null;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('resize', resize);
      if (ro) ro.disconnect();
      if (io) io.disconnect();

      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of mats) {
            if (m.map) m.map.dispose();
            m.dispose();
          }
        }
      });
      grainTex.dispose();
      if (glowSpriteTex) glowSpriteTex.dispose();
      renderer.dispose();
    },
    getStillFrame(mime = 'image/jpeg', quality = 0.85) {
      renderFrame();
      return canvasEl.toDataURL(mime, quality);
    },
    getStats() {
      const info = renderer.info;
      return {
        quality: qualityKey,
        calls: info.render.calls,
        triangles: info.render.triangles,
        pillarInstances: pillarCount,
        installationCount: installations.length,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
      };
    },
  };
}
