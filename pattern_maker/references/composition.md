# Composition

How to arrange layers, depth, and focal interest on a sculpture with no
frame and no fixed viewing angle — not distance-field/rotation mechanics
([`3d-techniques.md`](./3d-techniques.md)), and not color or timing
([`color-craft.md`](./color-craft.md), [`motion-design.md`](./motion-design.md)).
House default is organic, palette-driven, slow-evolving; notes flag
high-energy/geometric differences.

## The layer stack

Every strong pattern here and in shader/generative-art practice resolves to
the same three-layer anatomy, each with a job and a brightness ceiling:

- **Background field** ("context") — 100% coverage, low spatial frequency,
  `v ≤ 0.35`. Mood and color identity, never detail.
- **Midground structure** ("subject") — one recognizable moving thing (band,
  orb, flow), `v ≤ 0.8`. The layer the eye tracks — never two subjects.
- **Foreground accents** ("life") — sparse, small, fast; the only layer
  allowed `v = 1.0` (sparkles, glints, comet heads).

**Restraint is the strongest documented principle here.** Target ~20%
average fill (shipped closed-loop brightness controllers chase 0.1–0.2;
foreground stays under ~5% of pixels at any instant) — mostly-lit reads as
glare and kills contrast. Feed layers into each other rather than running
unrelated animations: sample the background's own value to place or tint
foreground accents so the stack reads as one organism, not three
screensavers. Shipped precedent: `lava_lamp.js`'s dim colored ambient floor
(`bgV = 0.09`) plus a metaball surface (chosen because the phenomenon *is*
a surface — a smooth gradient field has no edge to be one) plus a per-blob
temperature blend is this stack in practice. Baseline floors elsewhere run
0.05 (accent-dominant) to 0.25 (surface-dominant) by which layer carries
the shape.

```js
function screen(a, b) { return a + b - a * b }   // see Compositing math below

export function render3D(index, x, y, z) {
  var bg = 0.25 + 0.10 * wave(x * 0.7 + z * 0.4 + tSlow)   // L1, capped 0.35
  var d = abs(y - bandPos)
  var mid = 0.8 * smoothstep(0.25, 0.05, d)                // L2, capped 0.8
  var v = screen(bg, mid)
  var spark = random(1) < 0.004 * bg ? 1 : 0               // L3, seeded by L1
  if (spark) { hsv(hue, 0.2, 1) } else { hsv(hue, 1, v * v) }
}
```

## Compositing math in 0–1

PixelBlaze has no blend-mode API — compositing is arithmetic in value space
before the one `hsv()`/`rgb()` call per pixel.

| Operator | Formula | When it's right |
|---|---|---|
| Saturating add | `min(a + b, 1)` | Light physically adds; glow-over-dark. Hard-clips — only when one layer is near-zero at the other's peak. |
| Screen | `a + b - a*b` | Add-like, asymptotic to 1 — never clips. Default "stack lights" op. |
| Max | `max(a, b)` | Winner-takes-pixel; overlaps don't get brighter, each layer keeps its own contrast — for structures that must stay individually legible. |
| Multiply | `a * m` | Masking: vignettes, negative space, onion shells. Also doubles as gamma (`v * v`). |
| Conditional overwrite | `if (top) draw top else base` | Proven idiom for sparse foreground accents — no color math, just replace. |

Screen is exactly `fibonacci_bloom.js`'s "probabilistic OR" —
`arm8 + arm13 - arm8*arm13` lets two spiral families cross and brighten
without clipping, since both contribute rather than one overwriting the
other. Budget layers so the worst-case sum stays near ~1.2 and let screen
soft-clip the rest — a hard clamp rails every RGB channel to white and kills
hue; screen just asymptotes (the layer-stack code above already uses it).

## Focal interest without a frame

A sculpture viewed in the round has no rule-of-thirds and no "front" — every
angle is one, so focal interest has to be temporal and positional, not
framed. VR/360° eye-tracking research is consistent: **motion** and
**brightness** are the reliable gaze levers.

- **Wandering hotspot.** One bright locus whose center orbits the sculpture
  slowly; modulate value, saturation, *and* accent rate by proximity so
  every azimuth periodically gets the "front."
- **Axial density gradient.** The vertical axis is the one landmark every
  viewer shares — grade activity along y (quiet base → active crown) rather
  than azimuthal placement. On an egg specifically, poles are shared by
  every azimuth and the equator is local (half the viewers); punctuating
  the poles and traveling the equator is a reasonable extension — untested
  on-sculpture.

```js
var dx = x - cx, dy = y - cy, dz = z - cz
var focus = max(0, 1 - hypot3(dx, dy, dz) / 0.4)   // 0..1 proximity to hotspot
v = v * (0.35 + 0.65 * focus)
sparkleRate = baseRate * focus                      // life clusters at the focus
```

How the hotspot moves over time is pacing, owned by
[`motion-design.md`](./motion-design.md#drift-vs-events); this section only
owns *where* interest lives spatially.

## Scale contrast: two octaves, not five

fbm theory calls for a power-law stack of scales, but a sculpture only has
200–1500 LEDs to spend. An egg-scale map has ~30 LEDs around its largest
circumference, and Nyquist kills anything finer than ~8–10 cycles around it.
In practice **you get two spatial octaves, maybe three, and no more** — one
base scale (1–2 features across the whole sculpture) and one detail scale
at 4–8× that frequency (Nyquist arithmetic from map density, not a sourced
LED-art rule — treat the exact octave count as an untested hypothesis and
calibrate on-sculpture). A full 5-octave fbm wastes budget and aliases into
shimmer. Canonical fbm ratios still apply within that budget: lacunarity
2.0 (each octave doubles frequency), gain 0.5 (each halves amplitude) —
offset slightly (1.99/2.01) so peaks don't align.

```js
var big   = wave(x * 1.5 + tSlow)              // base: ~1.5 cycles, low freq
var small = wave((x * 6 + y * 5) - tFast * 4)  // detail: 4x freq, half gain
var field = big * 0.67 + small * 0.33
```

Pairing scale with *speed* per layer (big = slow, small = fast) is a timing
question owned by
[`motion-design.md`](./motion-design.md#timescale-layering) — pick the two
scales deliberately here, don't duplicate the speed pairing.

## Foreground shapes & falloffs

[`3d-techniques.md`](./3d-techniques.md#signed-distance-fields-sdf) owns SDF
primitives and rotation/distance mechanics; extend it here for sizing.
**Shell width:** a hard `d < 0 ? 1 : 0` edge aliases badly, crawling and
stair-stepping as the shape moves. `smoothstep(w, -w, d)` with `w` ≈ 1–2 LED
spacings is the workhorse: crisp but stable. Size `w` in map units per LED
(`≈ 1/sqrt(N)` surface, `≈ 1/cbrt(N)` volumetric), not a fixed constant.

**Glow falloff.** `1/d` (standard Shadertoy glow) has a long tail that lifts
the sculpture's floor even after clamping. Gaussian-support falloff has
finite extent, no floor-lift, no clipped core — prefer it as default.

| Profile | Formula | Reading on LEDs |
|---|---|---|
| Hard shell | `d < 0 ? 1 : 0` | Aliases — avoid |
| Smoothstep shell | `smoothstep(w, -w, d)` | Workhorse edge, `w` sized to LED pitch |
| Inverse glow | `k / d`, clamped | Long tail lifts the floor — window it |
| Gaussian glow | `exp(-k·d²)` ≈ `pow(max(0, 1 - d*d/sigma2), 2)` | Best default: compact, no floor-lift |

Minimum readable feature size ~3 LED spacings — smaller strobes between
pixels as it moves. Gamma (`v*v`) goes after compositing, not before — see
[`color-craft.md`](./color-craft.md#gamma-as-aesthetics) for placement.

```js
var d = hypot3(dx, dy, dz) - 0.08                    // orb SDF, r = 0.08
var core = smoothstep(0.03, -0.03, d)                 // shell, w ~ 1.5 LED spacings
var halo = pow(max(0, 1 - pow(max(0, d) / 0.15, 2)), 2)  // Gaussian-ish, finite support
var v = max(core, halo * 0.6)
```

## Depth on a real 3D sculpture

Unlike a screen, the sculpture already has real depth — the eye gets stereo
and occlusion for free. Pattern choices either reinforce that or flatten it.

- **Differential rotation between layers.** Rotate background and midground
  in world coordinates at different rates, even different axes — the direct
  3D analog of a parallax starfield. Use
  [`3d-techniques.md`](./3d-techniques.md#rotation)'s rotation matrices per
  layer; here, own *why* the rates should differ.
- **Z-graded color temperature.** Grade hue/saturation along one axis, warm
  near / cool far — one more depth device alongside rotation. Gradient
  construction is [`color-craft.md`](./color-craft.md#palette-craft)'s
  (cosine palettes make it a one-line `t = z` lookup).
- **Interior vs. surface, on volumetric maps.** With interior LEDs, radial
  contrast is the strongest device — dim/warm/slow interior against
  brighter/cooler/faster skin (or inverse, glowing-core): compute
  `r = hypot3(x-0.5, y-0.5, z-0.5)` once, grade every layer by it.
- **Prove the third dimension.** Foreground a cue a flat surface couldn't
  fake: `slicer.js`'s ring *morphs* as the cutting plane tumbles the egg's
  asymmetric form; `axial_flow.js` aligns three cues to one tumbling axis.

```js
var a1 = time(0.30) * PI2, a2 = -time(0.08) * PI2   // slow bg, faster mid, opposing spin
var xb = (x - 0.5) * cos(a1) - (z - 0.5) * sin(a1)  // bg rotates about y
var xm = (x - 0.5) * cos(a2) - (y - 0.5) * sin(a2)  // mid rotates about z, opposite sense
```

## Persistent state as the organic engine

The single most consistent trait separating acclaimed community patterns
from mediocre ones: they carry state between frames — heat buffers,
particle energies, sim cells — instead of being a pure function of
`(t, x, y, z)`. Fresh-from-`time()` every frame reads mechanical; a pattern
that remembers last frame and decays it reads organic. The heat-buffer
idiom (adapted from Ben Hencke's `sparks.js`, MIT, via jvyduna/pb-examples)
is the worked mini-version: a state array allocated **once, outside any
render function**, written in `beforeRender`, decayed every frame with a
frame-rate-aware `pow(rate, delta)` — not a fixed per-frame multiply, which
runs at different speeds on different FPS maps — only ever read in `render`.

```js
var heat = array(pixelCount)              // allocated ONCE, at module scope

export function beforeRender(delta) {
  for (i = 0; i < pixelCount; i++) heat[i] *= pow(0.995, delta)  // frame-rate-aware decay
  // deposit new energy at event sites, e.g.: heat[spawnIndex] += 1
}

export function render(index) {
  var v = heat[index]; v = v * v            // gamma last
  hsv(hue, 1, v)
}
```

## Sources

- Inigo Quilez — fbm, smin, distance functions, palettes: https://iquilezles.org/articles/
- Tyler Hobbs — Randomness in Composition; QQL Design Philosophy: https://www.tylerxhobbs.com/words/
- ElectroMage forum — layered effects, no blend-mode API: https://forum.electromage.com/t/general-coding-concept-layered-effects/2780
- FastLED lib8tion (`qadd8` saturating add): https://fastled.io/docs/df/da2/group__lib8tion.html
- Shadertoy glow tutorial (inspirnathan) — 1/d glow, clamping: https://inspirnathan.com/posts/65-glow-shader-in-shadertoy/
- Jim Campbell — low-res LED art, contrast over detail: https://coolhunting.com/culture/artist-jim-campbell-stripped-down-works/
- VR/360° eye-tracking — motion & brightness as gaze attractors: https://doi.org/10.3390/mti6070054
- Christopher Schardt — Burning Man Journal, pacing over spectacle: https://journal.burningman.org/2015/12/burning-man-arts/brc-art/christopher-schardt-from-engineering-to-aesthetics/
- Ben Hencke, `sparks.js` (MIT, via jvyduna/pb-examples) — heat-buffer idiom; this repo's `lava_lamp.js`, `fibonacci_bloom.js`, `slicer.js`, `axial_flow.js`
