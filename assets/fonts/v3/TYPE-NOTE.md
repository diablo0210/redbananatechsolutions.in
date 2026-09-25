DESIGN.md does not exist on this branch yet (integrator has not committed the skeleton at the
time this lane ran). Per the contract, this section is parked here and should be pasted under
its own "## Type" heading into DESIGN.md once that file exists, verbatim, without edits from
another lane.

## Type

**Display: Bricolage Grotesque** (variable: `opsz` 12→96, `wght` 200→800, `wdth` 75→100).
**Text: Instrument Sans** (variable: `wght` 400→700; Google currently ships this family's
public woff2 with only the `wght` axis live, though its metadata lists `wdth` too — verified
by inspecting the downloaded font's own `fvar` table, not assumed).
**Mono (figures): IBM Plex Mono 500** (static), per contract §4 — reused, not re-picked.

### Why, against the real render

Four contract-listed display candidates (Bricolage Grotesque, Familjen Grotesk, Hanken
Grotesk, Instrument Sans) were rendered as full hero mockups — eyebrow, the exact live H1
("Technology you don't just see. / You experience.", 70ea6f1 index.html lines 85-88, confirmed
still the live copy in the integrator's uncommitted index.html), and sub-line — at 96px caps
size, 1440 and 390 widths, real webfonts, Playwright/Chromium screenshots. Files:
`/home/vivek/Cultre/fleet/redesign-2026/rb-v3/type/{bricolage,familjen,hanken,instrument}-{1440,390}.png`,
plus `body-compare-1440.png` (three body-suitable candidates at 1.125rem/1.3 leading).

At 96px caps, Bricolage Grotesque is the only candidate with real character: the round
counters (O, D, G) pinch into a slightly squared aperture instead of a plain oval, the italic
"YOU EXPERIENCE." carries flared, almost-inked terminals that read as drawn rather than
sheared, and the tied-together "DON'T" apostrophe sits as a small ball, not a stroke. Familjen
and Hanken are competent but generic at this size — their italics are a plain 12° shear with
no terminal treatment, and Hanken's counters are noticeably rounder/softer, reading closer to
a humanist UI face than "high tech." Instrument Sans is the cleanest of the four but that
cleanliness is exactly why it fails as display: at 96px it reads as an app headline, not a
signal — the brief was "cool funky fonts... not boring," and Instrument Sans at display size
is the safe choice the brief explicitly rejected. Bricolage also fails as body text (confirmed
in the Google Fonts data: Body_Suitable=No, and visually its low x-height/high-contrast
character marks get fussy under 24px) — which is exactly why it's display-only and paired with
a quiet text face, per the KINETIC MODE rule "paired against something quiet so it can shout."

For the text face, the three body-suitable candidates (Instrument Sans, Hanken Grotesk,
Familjen Grotesk) were set at 1.125rem/1.3 leading with real site copy. Instrument Sans is the
most neutral of the three — lowest visual contrast, most even rhythm — which is the correct
foil for Bricolage's loud display character and closest to Moto's own "neutral grotesk" body
language. It is also Google's tier-B "SaaS, tech, apps, UI" pick, a better match to "high tech
and new age" than Familjen (tier C, vendored already for the v2-kinetic wave — reusing it here
would make v3 read as a retint of v2 rather than its own decision) or Hanken (tier C, rounder,
more corporate/editorial).

Mono stays IBM Plex Mono per contract §4 (vendored, static 500) — not re-litigated; it is used
for `.mono`/`.fig` only (numbers wall, dates, counts), set with `font-variant-numeric:
tabular-nums` so columns of figures don't jitter as digits change width.

### What was fixed: U+2192 (right arrow)
Fixed 24 Sep 2026. The original gap (below, kept for the record) turned out to affect not
just capabilities.html's "scan → remaster → print → finish" line but also two `.mono`-styled
live links on index.html ("All six, in detail →", "Read the full case study →") — re-checked
by grepping "→" across all seven committed HTML pages against `.mono`-styled elements before
deciding scope, per this lane's brief. Because of that, **all three faces** (Bricolage
Grotesque, Instrument Sans, and IBM Plex Mono) were re-subset with the arrow added, not just
the two originally suspected.

Root cause confirmed: it isn't only Google's *served* Latin subset that lacks U+2192 — the
vendored source files this lane originally subset from (`assets/fonts/redbanana/bricolage-
grotesque-var.woff2` and `assets/fonts/redbanana/ibm-plex-mono-500.woff2`) also lack it in
their own `cmap` tables, and Instrument Sans has no local vendored source at all. Re-fetching
Google's current `css2` API for all three families (unicode-range `U+2000-206F` block, which
does carry U+2191/U+2193/U+2212/U+2215) confirmed U+2192 is absent from every range Google
serves for these families — not a stale-vendor problem, a genuine gap in what Google ships.
The fix therefore had to start from a full, non-subset source with the glyph actually present:
the static/variable master `.ttf` files from the `google/fonts` GitHub repo (`ofl/
bricolagegrotesque/BricolageGrotesque[opsz,wdth,wght].ttf`, `ofl/instrumentsans/
InstrumentSans[wdth,wght].ttf`, `ofl/ibmplexmono/IBMPlexMono-Medium.ttf`), each confirmed to
contain `arrowright` (U+2192) before use.

**Method**: `fonttools` 4.65.0, already installed (`pyftsubset` on PATH). For Instrument Sans,
first pinned the `wdth` axis to its default (100) with `fontTools.varLib.instancer` (`python3
-m fontTools.varLib.instancer InstrumentSans[wdth,wght].ttf wdth=100 -o instrument-wghtonly.ttf`)
to reproduce the original wght-only variable font. The original per-font `pyftsubset` recipe
was reverse-engineered by diffing this lane's shipped `.woff2` table-by-table (`GDEF`/`GPOS`/
`GSUB` sizes, GSUB feature tags, presence/absence of `cvt `/`fpgm`/`prep`) against several
candidate re-subsets until an exact table-size match was found; it was
`--layout-features='kern,mark,mkmk'` for Bricolage (GSUB ends up empty — no GSUB-only features
like `frac`/`numr`/`locl` apply to this glyph set — but GPOS kerning is kept in full, ~49 KB),
`--layout-features='kern,mark,mkmk,liga'` for Instrument Sans, `--layout-features=
'kern,mark,mkmk,aalt,dnom,frac,numr,ordn,salt,sinf,ss01,ss02,ss03,ss04,ss05,sups,zero'` for IBM
Plex Mono (matching its fuller feature set), and `--no-hinting` on all three (confirmed: without
it, `cvt `/`fpgm`/`prep` tables reappear and the raw GitHub master's glyf table balloons by
tens of KB versus the original hinting-stripped output). Each command's `--unicodes` argument
was the font's own existing `cmap` codepoint list (read back from the shipped `.woff2`, so nothing
already in the subset was dropped) plus `U+2192` appended — extending, not re-deriving, the
character set in TYPE-NOTE.md's "Subset character set" section below. Commands run from
`/tmp` against the downloaded masters, e.g.:
```
pyftsubset BricolageGrotesque[opsz,wdth,wght].ttf --output-file=bricolage-grotesque-var.woff2 \
  --flavor=woff2 --unicodes=U+0020,U+0021,...,U+2122,U+2192 \
  --layout-features='kern,mark,mkmk' --no-hinting
```
Verified per font: table-by-table byte sizes matched the pre-fix shipped file almost exactly
(GDEF/GPOS/GSUB/cmap/hmtx/name identical or within single digits of bytes), the new
`arrowright` glyph has 1 real contour (not `.notdef`/tofu), and `fvar` axes are unchanged
(Bricolage opsz 12-96/wght 200-800/wdth 75-100; Instrument Sans wght 400-700 only, `wdth`
pinned as before).

**Before → after, this lane's shipped files** (`assets/fonts/v3/`):
- `bricolage-grotesque-var.woff2`: 78,456 B → 78,536 B (+80 B)
- `instrument-sans-var.woff2`: 19,284 B → 19,120 B (-164 B; GPOS kerning table came out
  smaller with the extra glyph in the subset closure, not larger — verified, not assumed)
- `ibm-plex-mono-500.woff2`: 15,316 B → 15,344 B (+28 B)
- **New total, fonts + licences: 126,262 B** (~123 KB, still against the 300 KB budget;
  licence files untouched)

### Historical: what failed (fixed above, kept for the record)
Neither Bricolage Grotesque's nor Instrument Sans's Google-served Latin subsets included a
right-arrow glyph (U+2192, "→") — checked directly against each font's `cmap` table. Any
"→" used as a live glyph (e.g. a "Learn more →" link) silently fell through to the next
font in the stack (`ui-sans-serif, system-ui, sans-serif`) rather than rendering in-family.
This is now fixed (see above) — the subsets carry the glyph and `assets/css/v3-type.css`'s
`unicode-range` descriptors include U+2192.

### Files and bytes (assets/fonts/v3/)
- `bricolage-grotesque-var.woff2` — 78,536 B, was 78,456 B (opsz+wght+wdth kept; originally
  subset from the vendored `assets/fonts/redbanana/bricolage-grotesque-var.woff2`, itself
  Google's Latin block; the 24 Sep U+2192 fix re-subset from the full `google/fonts` GitHub
  master instead, since neither that vendored file nor Google's served Latin block contain the
  glyph — see "What was fixed" above)
- `instrument-sans-var.woff2` — 19,120 B, was 19,284 B (wght kept; originally subset from
  Google's Latin block, `pxiTypc9vsFDm051Uf6KVwgkfoSxQ0GsQv8ToedPibnr0SZe1Q.woff2`; the U+2192
  fix re-subset from the full `google/fonts` GitHub master, wdth axis re-pinned to 100)
- `ibm-plex-mono-500.woff2` — 15,344 B, was 15,316 B (originally copied byte-for-byte from
  `assets/fonts/redbanana/ibm-plex-mono-500.woff2`, already subset; the U+2192 fix re-subset
  from the full `google/fonts` GitHub master `IBMPlexMono-Medium.ttf` instead, once index.html's
  `.mono`-styled "→" links showed the mono face needed the glyph too)
- `OFL-BricolageGrotesque.txt`, `OFL-InstrumentSans.txt`, `OFL-IBMPlexMono.txt` — licences,
  ~4.4 KB each, unchanged
- **Total, fonts + licences: 126,262 B** (~123 KB), was 126,318 B, against a 300 KB budget.

Subset character set: printable ASCII (U+0020–007E) plus © · – — ' ' " " … ™ **and, as of 24
Sep 2026, → (U+2192)**, derived by scraping the text nodes of every page on this branch
(`index.html`, `about.html`, `capabilities.html`, `contact.html`, `privacy.html`, `work.html`,
`404.html`) and `PRODUCT.md` — the universe of text the contract commits this rebuild to using,
since §6 requires every fact byte-identical to those sources. U+2192 was added to all three
faces' subsets (not only the two display/text faces originally suspected) after grepping "→"
across those seven pages showed index.html's `.mono`-styled "All six, in detail →" and "Read
the full case study →" links also render through the mono face. A handful of Devanagari
characters found in that scrape are not carried (these are Latin display/text faces; Devanagari
falls through to the system font stack regardless of what's subset in).

### CSS: `assets/css/v3-type.css`
`@font-face` for all three families, `font-display: swap`, `unicode-range` matching the subset
above. Each webfont has a paired `*-Fallback` face (`local()`-only, `ascent-override` /
`descent-override` / `line-gap-override` / `size-adjust` computed from the shipped font's own
`hhea`/`OS/2` tables against the CSS Fonts WG's published Arial reference metrics —
`xAvgCharWidth 904 / unitsPerEm 2048`), so the swap from system font to webfont doesn't reflow.
Tokens: `--font-display`, `--font-text`, `--font-mono`. Scale: `--fs-h1`
`clamp(3rem, 1.6rem + 6vw, 6.4rem)` down to `--fs-h3`, matching the Moto reference sizes
(6.4/5.2/4.2rem at 1440); body 1rem–1.125rem at 1.3 leading, -0.003em tracking; display at
-0.02em, uppercase; `.mono`/`.fig` with `font-variant-numeric: tabular-nums`.

### Axis animation + CLS verification
Demo: `assets/fonts/v3/demo/axis-demo.html` (10-line tween of `font-variation-settings` on
`wght`/`wdth`/`opsz`, sampled two frames 900ms apart — `"wght" 520,"wdth" 91,"opsz" 62` →
`"wght" 764,"wdth" 99,"opsz" 92`, confirmed different, so the axis genuinely animates).
Screenshots: `rb-v3/type/axis-demo-frame1.png`, `axis-demo-frame2.png`.

CLS was measured with Playwright's `layout-shift` PerformanceObserver while artificially
delaying every `.woff2` response by 400ms (a worse-case stand-in for a slow first load with no
preload) on the served page. Measured **CLS 0.029** for the one shift the observer recorded, at
the moment the real webfonts finish loading and swap in over the fallback face. This number is
inflated by this sandbox: an isolated test (`local()` `@font-face` with `size-adjust: 50%`
against a bare probe element) showed the `size-adjust` descriptor had **zero** effect on
rendered width in this specific headless Chromium build (1244) even though the identical
technique visibly worked in the full-page swap test — meaning `local()` font matching is only
partially honored here, so the fallback face understates its own correction and the observed
shift is larger than a real desktop/mobile browser (where `local("Arial")`/`local("Liberation
Sans")` resolve normally) would show. The fix that matters in production is upstream of all
this: the type lane's `<link rel=preload>` request in `parts/WIRING.md` gets both variable
fonts fetched before first paint, which removes the 400ms delay this test manufactured in the
first place — on a preloaded load there is no fallback-to-webfont swap to shift at all.

### Investigated 24 Sep 2026: "Opened" renders as "0pened" — NOT a font defect, no fix applied
A defect report (DOM `textContent` confirmed byte-correct "Opened", but visually the capital
`O` displays as a dotted zero) was investigated and reproduced, but traced to the **test
environment's rendering, not `ibm-plex-mono-500.woff2`**. No font file was changed. Full
finding, so the next person doesn't re-open this:

**Reproduced as reported**: a bare `file://` HTML page, `@font-face` only pointing at
`assets/fonts/v3/ibm-plex-mono-500.woff2`, `font-feature-settings:'lnum','tnum'`, rendered via
the same sandboxed headless Chromium 1244 build (`/home/vivek/.cache/ms-playwright/chromium-1244`)
used across this branch's QA — "Opened" showed a dotted zero in place of the capital O.

**But the trigger isn't `lnum`/`tnum`**: this font's GSUB table has neither feature — its only
GSUB tags are `aalt dnom frac numr ordn salt sinf ss01-05 sups zero` (dumped with fontTools).
Removing `font-feature-settings` entirely, or isolating `lnum` alone / `tnum` alone / neither,
produced the byte-identical rendered artifact in all four cases — proof the feature toggle is
inert here, not causal.

**And it isn't the 977551e re-subset**: the *pre*-977551e vendored file,
`assets/fonts/redbanana/ibm-plex-mono-500.woff2` (this lane's own original subsetting source,
untouched by either commit on this branch), reproduces the identical dotted-O artifact in the
same test. Whatever this is, it predates both of this lane's commits.

**Font data itself checked and found correct**: dumped `glyf`/`cmap`/`GSUB` with fontTools
(`TTFont`, `getGlyphSet()`, `RecordingPen`) for both the shipped `assets/fonts/v3/` file and the
pre-subset `assets/fonts/redbanana/` file. The `O` glyph is 2 contours (outer ring + counter),
byte-identical point-for-point between the two files, with no third "dot" contour of any kind —
that only exists on the separate `zero` glyph (3 contours: ring, counter, dot), also identical
between files. `cmap` maps U+004F to glyph `O` and U+0030 to glyph `zero` correctly in both.
The only GSUB feature that touches figures at all is `zero` (OpenType "slashed zero"), and its
single lookup substitutes `zero`→`glyph00057` (the slashed-zero alternate) — never `O`, in
either file. There is no corruption, no glyph-ID remap error, and no stray substitution
anywhere in the table data pyftsubset produced.

**An independent rasterizer renders it correctly**: converted the shipped `.woff2` to `.ttf`
with fontTools and rendered "Opened" with Python's PIL/`ImageFont` (libfreetype, a completely
different code path from Chromium's Skia) at sizes 16–200px. Every size shows a clean, correctly
round `O` — no dot, no artifact. Screenshots not committed (scratch verification), but
reproducible with the commands in this note's own method above plus
`fontTools.ttLib.TTFont(...).save(..., flavor=None)` to de-flavor to `.ttf` first.

**Control test nails it down to the sandbox, not any font file**: rendered "Opened" in the same
headless Chromium 1244 build using two system fonts with no connection whatsoever to this
lane's pipeline — `DejaVu Sans Mono` and `Liberation Mono` (pre-installed OS fonts, never
touched by pyftsubset, never downloaded from google/fonts). Both show the identical dotted-O
artifact for the same word. A rendering bug that appears in fonts nobody subset, in a family
nobody chose, is not a defect in `ibm-plex-mono-500.woff2` — it is this specific sandboxed
Chromium build's font rasterizer mishandling round counters in this word/size combination. This
lines up with the CLS section above, which already flagged this exact Chromium 1244 build as
unreliable for font-metric behavior (`local()` matching / `size-adjust` partially inert here).

**Live-page confirmation, so this isn't dismissed on a bare-page technicality**: served the
branch's actual `index.html` on `localhost:8955` (port 8954 was already held by a process this
lane did not start, serving an unrelated stale checkout at commit d4b94cb — left untouched per
hygiene rules) and screenshotted the numbers-wall's "Opened / 14 August 2026" tile at 1440×900
in the same Chromium 1244 build. The live tile shows the same dotted-O artifact, `document.
querySelector('.wall-tile--dated .wall-figure').textContent` still reads exactly `"Opened"`,
the four adjacent numeric figures (`6`, `2`, `51`, `3,000+`) render with no artifact at all
(tabular alignment unaffected — the bug is letter-specific, not digit/tnum-related), and the
mono `→` (U+2192) links ("All six, in detail →", "Read the full case study →", fixed in
977551e) still render in-family with no regression.

**Disposition**: no change made to `ibm-plex-mono-500.woff2`, `bricolage-grotesque-var.woff2`,
`instrument-sans-var.woff2`, or `assets/css/v3-type.css` — there is nothing in them to fix.
Re-subsetting again would not change a single byte of relevant table data and risks
regressing the U+2192 fix for no gain. What was NOT verified: whether this artifact is visible
in a real, non-sandboxed browser (Chrome/Firefox/Safari on an actual desktop or phone) — that
needs a person looking at a real screen, which this environment cannot do. If Vivek or the
Director sees "0pened" in a normal browser outside this sandbox, this finding is wrong and the
investigation should reopen from there; until then, treat the Chromium-1244-sandbox screenshot
this defect report was based on as inconclusive, not as proof of a shipped bug.
