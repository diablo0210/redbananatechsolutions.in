# Provenance — hero object mesh

Asset lane, RB v3 "THE OBJECT", branch `rb-bg/v3-object`. Written before any GLB was built,
per contract §2 ("provenance of the base mesh to be confirmed by the asset lane before use")
and the asset-lane brief's Part A gate.

## Current file map (updated after Bob 25's coordinator ruling)

| File | Object | Status |
|---|---|---|
| `assets/models/dancing-girl.glb` / `dancing-girl-lo.glb` | Real Dancing Girl, `DancingGirl_24bangles.stl` | **BUILT, USE GATED ON VIVEK'S RULING** (commissioned from K&H Design India, invoice 24 Mar 2025 — see verdict below) |
| `assets/models/ram-sita.glb` / `ram-sita-lo.glb` | Fallback Ram & Sita plate | **BUILT, OURS, no gate** — renamed from `dancing-girl*.glb` on Bob 25's instruction so the filename doesn't mislead any lane about which mesh it is |

Bob 25's ruling (relayed to this lane, not from Vivek directly): the K&H Design India commission was
paid by Red Banana for Red Banana's own product (RBR-001), so this is a **use** decision for Vivek,
not a provenance verdict that blocks building the asset. The GLB below is built and ready; it is not
wired into the live page, and nothing here overrides "nothing live without Vivek" — publishing it is
still Vivek's call.

## Verdict, Dancing Girl (`DancingGirl_24bangles.stl`): **UNKNOWN provenance of the base mesh; commercial facts now known — use gated on Vivek**

### What was checked
- `/home/vivek/Studio/projects/2026-08-08_dg-authenticity/corrected/README.md` — describes only the
  bangle-count and eye corrections applied to an existing source mesh; states no origin for that
  source mesh.
- `/home/vivek/Studio/projects/2026-08-08_dg-authenticity/report/DG_comparison.md` — a forensic
  fidelity comparison of `0. Cultre Dancing Girl 3D Model.stl` (302,848 triangles) against the real
  Mohenjo-daro bronze. Its only relevant line: *"Taken together this indicates a **sculpted
  interpretation of the Dancing Girl rather than a 3D scan of the artefact**."* (line 94). This is an
  inference from surface/anatomical character, not a chain-of-custody record — it says how the mesh
  was likely made (sculpted vs scanned), not who made it or under what rights.
- `/home/vivek/Studio/library/catalogue/*.md` and `/home/vivek/Studio/handbook` — no mesh-origin
  record; the catalogue only lists the Dancing Girl as a candidate SKU referencing the real museum
  bronze as "Original", not the file's source.
- Filesystem identity check: `0. Cultre Dancing Girl 3D Model.stl` (the file the "corrected" pipeline
  and DG_comparison.md both worked from) is **byte-identical** (md5 `82160b70f3e7edc5f6d0d15d27ab64b8`,
  15,142,484 bytes) to `dancinggirl_forprint_amped.stl`, found on the `diablo_2TB` Macbook backup at
  `Desktop 2024-12-25/Cultre/Cultech - Products/Products - 3D Files/`, filesystem birth date
  **24 Sep 2024**, sitting alongside that folder's own `Dancing Girl 1/2/3.jpg` product photography and
  `Cultech Product Sales FY2024-25.xls`. So the mesh has been in Cultech Wave's own product folder,
  under its own SKU, since at least Sep 2024 — it is not a stray download sitting in Downloads.
- Broad grep across `~/Studio`, `~/Documents/Codex`, `~/Desktop`, `~/Downloads` and the backup drive for
  `sketchfab|thingiverse|printables|cults3d|myminifactory|turbosquid|cgtrader` near any Dancing Girl
  file: **zero hits**. No third-party marketplace, no licence file, no readme, no source `.blend`/`.ztl`
  file anywhere.
- **The finding that changes the verdict** — Red Banana's own finance records show this was **paid
  commissioned work**, not an in-house sculpt:
  - `/home/vivek/Cultre/accounts/tools/dumps/sheets/rb-invoices.tsv` line 27: `24-Mar-2025  2  K&H
    Design India  Dancing Girl Order  ₹1,78,360.00 ... ₹1,99,763.20`
  - `/home/vivek/RedBanana/accounts/reports/bank-sheet-review-2026-08-04.md`: *"A vendor-bill register
    with 12 bills (3D Bazaar, STATURE 3D ₹9,48,484, Techcirkle, Print N Design, **K&H Design incl.
    Dancing Girl making charges ₹1,99,763.20**, individual artists, R. Bama ₹12,34,296, Udhbhav Arts
    ₹4,27,500), none in Zoho."*
  - `/home/vivek/RedBanana/accounts/tools/backfill_phase2b.py` line 51: `('K&H Design India', '2',
    '2025-03-24', 199763.20, SUBCONTRACTOR, ... 'paid 03-Jun-25 per IDFC, Dancing Girl making charges')`
  - No purchase order, contract, or IP-assignment document for this vendor bill was found anywhere.

### Why this was originally read as UNKNOWN, not OURS
"OURS" would need an in-house creation record (a named sculptor, source files, a design brief) or an
explicit IP-transfer document for commissioned work. Neither exists. What exists instead is a paid
external commission ("Dancing Girl making charges", K&H Design India, ₹1,99,763.20, invoiced
24-Mar-2025, paid 03-Jun-2025) with no surviving contract or licence terms on file. It is also not
"THIRD PARTY WITH LICENCE" — there is no free/CC download and no licence text of any kind. Under the
brief's original rule this reads as UNKNOWN and UNKNOWN blocks use, so the first pass here did not
build a GLB from `DancingGirl_24bangles.stl` at all (built the OURS fallback, Ram & Sita, instead).

### Coordinator ruling (Bob 25) — build proceeds, use stays gated
Bob 25 reviewed this same evidence and ruled: the commission was Red Banana paying a vendor to make
Red Banana's *own* commercial product (RBR-001, sold under the Red Banana Replicas brand) — a
different situation from using someone else's uncommissioned asset, and the open question is not "do
we have any right to this at all" but "does the invoice/PO give us the specific right to publish this
mesh on the website," which is a business/legal call for Vivek, not an asset-lane provenance call.
Bob 25 is putting the recommendation to Vivek to use it, and instructed this lane not to wait on the
answer to build the file. **This lane still has not located a K&H Design India PO or agreement with
usage terms** — that fact is unchanged; only who is authorised to decide what to do about it has
changed. The GLB below is built, verified, and labelled gated; it is not referenced by any page.

## Verdict, fallback Ram & Sita (`ram_sita_PLATE_all_parts.stl`): **OURS — usable, and used**

Output files: `assets/models/ram-sita.glb` / `ram-sita-lo.glb` (renamed from `dancing-girl.glb` /
`dancing-girl-lo.glb` on Bob 25's instruction, once the real Dancing Girl mesh was also being built,
so the filename would not mislead any lane about which object it names).

- `/home/vivek/Studio/projects/2026-07-29_ram-sita/DESIGN.md`, first line: *"**Original designs**,
  drawn in the Indian shadow-puppet idiom (Tholu Bommalata / wayang kulit lineage). Not traced from an
  artefact — see Provenance below."* And its own Provenance section: *"These are **original designs
  generated procedurally**, drawn from the traditional vocabulary... They are *not* replicas of any
  specific artefact and carry no museum provenance."*
- Full generative source is in the same project: `03_mesh/pupdraw.py` (drawing primitives),
  `03_mesh/ram.py` / `03_mesh/sita.py` (the figures, "every coordinate is editable"),
  `03_mesh/articulate.py` (splits into parts, adds pivots, exports STL), `03_mesh/plate.py` (packs the
  plate). This is procedural, code-generated geometry, not a scan or a commission.
- No hit for "ram sita" / "ram-sita" anywhere in `~/RedBanana/accounts` or `~/Cultre/accounts` vendor
  registers — no commissioned-work paper trail exists for this object, consistent with in-house
  generation.
- Per the brief: *"build from the fallback ... only if ITS provenance is OURS by the same test"* — it
  is, so Part B proceeds on this mesh.

## Part B build record — Ram & Sita (`ram-sita.glb`, `ram-sita-lo.glb`)

Built with Blender 5.2.0 LTS headless (`/home/vivek/.local/bin/blender -b --python build_glb.py`).
Pipeline: import STL, join 6 parts into one mesh, recentre X/Z at 0 and seat the base at the
zero-axis, scale mm to metres, smooth shade with 30° auto-smooth, single PBR material (base colour
`#2a1d15`, metallic 0.9, roughness 0.35), decimate a duplicate to a phone-weight LO mesh, export
plain (uncompressed) glTF, then Draco-compress as a post-process (see note below).

| | Full (`ram-sita.glb`) | LO (`ram-sita-lo.glb`) |
|---|---|---|
| Triangles | 52,840 (source plate geometry, under the 200k budget without any lossy decimation) | 30,000 (collapse-decimated from the full mesh) |
| Bounding box (metres, glTF Y-up) | X 0.3010 x Y(thickness) 0.0016 x Z 0.1824, centred on X/Z=0, base at Y=0 | X 0.3010 x Y 0.0016 x Z 0.1824, same seat |
| File size, Draco-compressed | 109,176 bytes (0.104 MB) | 109,724 bytes (0.105 MB) |
| Budget | ≤1.2 MB, ≤200k tris — **met, with large headroom** | for phones — met |

Both numbers (triangles + bounding box) were independently re-measured after export by loading the
actual `.glb` files in a browser with three.js r160 (module build, CDN) + `GLTFLoader` +
`DRACOLoader`, not just read from the Blender console — see **Verification** below. They match the
Blender build log exactly, confirming Draco compression did not corrupt geometry.

**Draco note**: Blender 5.2.0's bundled Draco bridge (`libbf_intern_draco_bridge.so`) segfaults on
this machine on *any* mesh, verified in isolation on a default primitive cube
(`test_draco_cube.py`, crash trace in `/tmp/blender.crash.txt` at the time, roots in
`io_scene_gltf2/io/exp/draco.py` `__encode_primitive`). Worked around by exporting plain
(uncompressed) GLB from Blender, then Draco-compressing with the `@gltf-transform/cli` (v4.5.0)
`draco` command (edgebreaker method) as a separate, working native binding. Uncompressed sizes were
1.84 MB (full) and 1.14 MB (lo); Draco brought both to ~109 KB. The same workaround is used for every
GLB in this file.

## Verification — Ram & Sita

Ran, not just claimed: `node verify_glb.mjs` in
`/tmp/claude-1000/-home-vivek-diablo-claude/41e78cc9-5531-4df1-9cab-34715469af60/scratchpad/rb-asset-lane/`
(outside the served root), using Playwright (local Chromium) to load
`check.html?file=<name>`, which imports three.js **r160** as an ES module from
`cdn.jsdelivr.net` with `GLTFLoader` + `DRACOLoader` (decoder also from the r160 CDN examples path),
traverses the loaded scene to sum triangle counts from each mesh's index/position buffer, computes a
`THREE.Box3` bounding box, and logs both plus `STATUS: LOADED_OK`.

- `ram-sita.glb`: **LOADED_OK**, 52,840 triangles, bbox size (0.3010, 0.0016, 0.1824) m.
  Screenshot: `.../scratchpad/rb-asset-lane/check-ram-sita.png`.
- `ram-sita-lo.glb`: **LOADED_OK**, 30,000 triangles, bbox size (0.3010, 0.0016, 0.1824) m.
  Screenshot: `.../scratchpad/rb-asset-lane/check-ram-sita-lo.png`.

An earlier build had a real bug caught by this same check: the object's location offset was baked
after scaling rather than before, so the mesh reported a correct *size* but was centred 150 units
away from the origin instead of at it. Fixed by baking the recentre translation into the mesh data
(`transform_apply(location=True, ...)`) before applying the metre scale, then re-verified.

## Part C build record — real Dancing Girl (`dancing-girl.glb`, `dancing-girl-lo.glb`)

**Status: BUILT, USE GATED ON VIVEK'S RULING (commissioned from K&H Design India, invoice 24 Mar
2025).** Built on Bob 25's coordinator instruction after the provenance finding above; not wired into
any page. Same pipeline and same Draco workaround as Ram & Sita, run against
`/home/vivek/Studio/projects/2026-08-08_dg-authenticity/corrected/DancingGirl_24bangles.stl`
(the corrected 24-bangle mesh, not the uncorrected 28-bangle original).

Source mesh: 361,984 triangles, 74.4 x 52.5 x 140.0 mm (matches the corrected/README.md figures
exactly). Decimated (Blender COLLAPSE modifier) to fit the 200k budget, then a second decimation pass
for a phone-weight LO mesh, both re-triangulated after decimating.

| | Full (`dancing-girl.glb`) | LO (`dancing-girl-lo.glb`) |
|---|---|---|
| Triangles | 195,000 (from 361,984 raw) | 55,000 |
| Bounding box (metres, glTF Y-up) | X 0.0744 x Y 0.1400 x Z 0.0525, centred on X/Z=0, base at Y=0 | same, X 0.0744 x Y 0.1400 x Z 0.0525 |
| File size, Draco-compressed | 509,744 bytes (0.486 MB) | 170,672 bytes (0.163 MB) |
| Budget | ≤1.2 MB, ≤200k tris — **met** | ≤60k tris — **met** (55,000) |

Bangle check: rendered a close crop on the corrected (24-bangle) arm after decimation to 195,000
triangles — individual rings stay distinct and countable, no ring-merging from the decimation.
Render: `.../scratchpad/rb-asset-lane/check-render-dg-arm-crop.png` (full-figure render:
`check-render-dg-full.png`).

### Verification — Dancing Girl

Same method as Ram & Sita (Playwright + three.js r160 + GLTFLoader/DRACOLoader, outside the served
root):
- `dancing-girl.glb`: **LOADED_OK**, 195,000 triangles, bbox size (0.0744, 0.1400, 0.0525) m.
  Screenshot: `.../scratchpad/rb-asset-lane/check-dancing-girl.draco.png`.
- `dancing-girl-lo.glb`: **LOADED_OK**, 55,000 triangles, bbox size (0.0744, 0.1400, 0.0525) m.
  Screenshot: `.../scratchpad/rb-asset-lane/check-dancing-girl-lo.draco.png`.

Both bounding boxes match the source STL's documented 74.4 x 52.5 x 140.0 mm exactly (0.0744m =
74.4mm, 0.1400m = 140.0mm, 0.0525m = 52.5mm), confirming the mm-to-metre scale and the base-at-zero
seat are correct.

**What remains open, unchanged by this build**: no K&H Design India PO, contract, or licence/IP-
assignment document has been found anywhere on disk. Building the asset does not resolve that; only
Vivek's ruling (via Bob 25) does.

### Note for the hero lane
`ram_sita_PLATE_all_parts.stl` (built as `assets/models/ram-sita.glb`) is a **flat print plate**: 6 parts (Ram body, 2 arms; Sita body, 2 arms;
all 1.6 mm thick), laid out for a single resin print, real-world footprint 301 × 182 mm, figures
250 mm tall each per DESIGN.md — not a single free-standing 140 mm statue like the Dancing Girl was
meant to be. It was imported and processed exactly as found (all 6 parts, flat, as a plate) because
that is the only geometry this fallback object has; no parts were repositioned into a "standing" pose,
since that would be inventing a pose not in the source. The plinth staging, camera framing and any
pose decisions belong to the hero lane and to Vivek, not to this lane. **This is a visible departure
from the contract's "object on a plinth" language and should be confirmed with Vivek before the hero
lane builds the final scene.**
