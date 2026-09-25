# assets/vendor/three — versions and provenance

Vendored by the HERO LANE (v3-hero), Thursday 24 September 2026, for RB v3
"THE OBJECT" (contract: `redesign-2026/RB-V3-DIRECTION-CONTRACT.md` §3.1-3.2,
§7 HERO LANE). Owner of this directory: HERO LANE only.

## Source

`npm pack three@latest` from the public npm registry, run in a scratch
directory (`/tmp/.../rb-v3-hero/npm-scratch/`), NOT installed into the repo
and NOT a dependency of anything in this tree — the files below are the
built output copied out of the tarball, then minified with `terser` (npx,
v5.51.2) because the npm package no longer ships a minified ESM build.

- **three version: 0.186.0** (dist-tag `latest` at pack time, satisfies the
  contract's "r160 or later"; three's internal `REVISION` constant is `186`).
- tarball shasum (from `npm pack` itself): `08f70ce80dffa9247a567b421165bec630e86f8d`
- Licence: MIT, copied to `LICENSE-three.txt` (unchanged from the package).

## Files and SHA256

| File | Source in the `three` npm package | SHA256 |
|---|---|---|
| `three.module.min.js` | `build/three.module.js`, minified | `06ec52fe78ccf8a4b2bc4d0ede05bf3af5e05c74126f813d6097bfbbc9907cf6` |
| `three.core.js` | `build/three.core.js`, minified, filename kept exact — see note below | `fe546fcf1c6316510097d51a7dd665467edac54043db1641f1805120a6abefaa` |
| `addons/loaders/GLTFLoader.min.js` | `examples/jsm/loaders/GLTFLoader.js`, minified | `f409432d2e03a7f0d205faac14fe3c2f6def38b8d95be0d1cf523630d1967054` |
| `addons/loaders/DRACOLoader.min.js` | `examples/jsm/loaders/DRACOLoader.js`, minified | `61ba233293476e96add0d6ff9da474f5dfe987a258f4240b0e20dfaa677eb96a` |
| `addons/environments/RoomEnvironment.min.js` | `examples/jsm/environments/RoomEnvironment.js`, minified | `61c453098734dc468a6fa10d9eccb9b1051bb2b6e9a16f14376f3d467a485eaf` |
| `addons/utils/BufferGeometryUtils.js` | `examples/jsm/utils/BufferGeometryUtils.js`, minified (GLTFLoader dependency, no `.min` in the filename — see note below) | `1efb3d43406fe608bf3b78945a4100ce96072b08b208d84cd25f5ebde8d68fd3` |
| `addons/utils/SkeletonUtils.js` | `examples/jsm/utils/SkeletonUtils.js`, minified (GLTFLoader dependency, same reason) | `b7a5b6709e7e74b39bebd43465a7d48c205a1c4d42bade522b5fbff5b7f00703` |
| `addons/objects/Reflector.min.js` | `examples/jsm/objects/Reflector.js`, minified (planar reflection, contract §3.2) | `e7a83220e8b69b1eb584ff5ea6963823852b6865a093b03028660f3e69e692f5` |
| `draco/gltf/draco_wasm_wrapper.js` | `examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js`, copied as-is (prebuilt emscripten glue) | `8bb2952d2ba7d67e1414f8df819410cb0434a666be53f671fff75f68843d76f6` |
| `draco/gltf/draco_decoder.wasm` | `examples/jsm/libs/draco/gltf/draco_decoder.wasm`, copied as-is | `a680d927bed9cb864ddbd63521868891af2bfbe755092761b4837487618df8ac` |
| `draco/gltf/draco_decoder.js` | `examples/jsm/libs/draco/gltf/draco_decoder.js`, JS-only fallback for browsers without WASM, copied as-is | `8625489da79a805f4f2a7d511c3e52d8b4085608a9d2a4d5f4f9de5db0aea04f` |
| `LICENSE-three.txt` | package root `LICENSE` (MIT), unchanged | `8b378ebe60e2fe500158cb0ac71cb5e8b7d92953c2abcc63a0eb90499653b5bc` |

Recompute: `sha256sum $(find assets/vendor/three -type f \( -name "*.js" -o -name "*.wasm" -o -name "*.txt" \))`

## Why minified locally instead of "the" official minified build

Since three r150-ish, the npm package stops publishing `.min.js` for the
module build (bundlers are expected to minify). The contract names the file
`three.module.min.js`, so this lane ran `npx terser --module -m -c` against
the unminified `build/three.module.js` and the three addon files it needed,
using default terser settings (no unusual flags, no source transforms
beyond minification). Nothing in `three`'s source was hand-edited.

## Import resolution: importmap for bare specifiers, filenames for relative ones

`GLTFLoader.js` imports `'three'` (bare specifier, importmap-resolved) and
two relative sibling files, `../utils/BufferGeometryUtils.js` and
`../utils/SkeletonUtils.js`. A relative specifier is NOT rewritten by an
importmap (importmaps only remap bare/absolute-ish module specifiers) — it
resolves straight against the importing file's own URL. That is why those
two utils files are named exactly `BufferGeometryUtils.js` and
`SkeletonUtils.js` here, with no `.min` in the filename, even though their
contents are minified: naming them `*.min.js` would 404 the moment
GLTFLoader tries to load its own dependency, which is exactly the bug this
lane hit and fixed while testing the demo (see the demo's server log —
two 404s on `addons/utils/BufferGeometryUtils.js` / `SkeletonUtils.js`
before the rename). `DRACOLoader.js` and `RoomEnvironment.js` only import
bare `'three'`, so they had no such constraint. `three.module.min.js`
itself has the same issue one level down — `build/three.module.js` does
`import {...} from './three.core.js'` — so `three.core.js` is vendored
here too, with that exact filename (no `.min`), sitting next to
`three.module.min.js`. Both discoveries came from actually loading the
demo, not from reading the package source in advance: the first attempt
shipped `*.min.js` names for every file uniformly and the browser's own
404s (visible in the demo's local server log and in a Playwright
console-message capture) caught both breaks before any commit claimed
the vendoring worked.

None of the vendored files had their import statements hand-edited.
Bare-specifier resolution is done entirely by the page's
`<script type="importmap">` (see `parts/WIRING.md`), which is why the demo
and the eventual integration must use the SAME importmap block. Map:

```json
{
  "imports": {
    "three": "./assets/vendor/three/three.module.min.js",
    "three/addons/loaders/GLTFLoader.js": "./assets/vendor/three/addons/loaders/GLTFLoader.min.js",
    "three/addons/loaders/DRACOLoader.js": "./assets/vendor/three/addons/loaders/DRACOLoader.min.js",
    "three/addons/environments/RoomEnvironment.js": "./assets/vendor/three/addons/environments/RoomEnvironment.min.js",
    "three/addons/objects/Reflector.js": "./assets/vendor/three/addons/objects/Reflector.min.js"
  }
}
```

`v3-hero.js` imports exactly those five bare specifiers, never a relative
path into `assets/vendor/three/`, so the importmap is the single point of
truth for versions. `Reflector.js` (the plinth's planar reflection, contract
§3.2) is the stock three.js mirror-plane implementation, not hand-rolled;
`v3-hero.js` wraps its `onBeforeRender` hook to skip two frames in three so
the reflection render-to-texture happens on every third frame as specified,
without touching the vendored file itself.

## Draco decoder weight note

`DRACOLoader` defaults to the WASM path (`draco_wasm_wrapper.js` + `.wasm`,
about 250KB combined) and only falls back to the 512KB `draco_decoder.js`
JS path when WebAssembly is unavailable. Both are lazy-fetched by the
loader's own worker, on first decode, not on script parse; they are not
requested until a GLB actually loads. `v3-hero.js` points
`DRACOLoader.setDecoderPath()` at `assets/vendor/three/draco/gltf/`.

## Not vendored here

No CDN reference anywhere (contract + `web-motion` skill: no hotlinking).
Nothing in this directory is installed as an npm dependency of the repo;
`npm pack` ran in a scratch dir outside the repo and only the built files
were copied in.
