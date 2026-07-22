# Motion Design

What motion feels good on an LED sculpture and why — not the primitive mechanics
(`time()`/`wave()`/`triangle()`/`delta`), which live in
[`waveforms.md`](./waveforms.md). House default is organic, slow-evolving motion
(lava_lamp / oil_slick / fibonacci_bloom family); high-energy/geometric styles get
a one-line note where the rule differs, not a rewrite.

## Timescale layering

Rich ambient motion runs on **2–3 distinct timescales**: slow global drift (tens
of seconds), medium feature travel (seconds), fast micro-detail (sub-second).
Uniform-speed motion reads flat; layered speeds read like a living scene because
that's how natural scenes actually move — background slower than foreground.
Shipped precedent: cosmic_bloom stacks ~10s rotation / ~6.5s cascade / ~0.65s
shimmer; fibonacci_dream runs 13s→233s across five layers.

Keep adjacent layers roughly **4–15× apart** — untested hypothesis, calibrate
on-sculpture; below ~3× the layers blur into one ambiguous speed, above ~20×
the slow layer stops reading as motion and just becomes "state." Give each
layer its own `time()` tap, sampled once in `beforeRender`:

```js
export function beforeRender(delta) {
  drift   = time(0.60)    // ~39 s: slow global hue/position drift
  motion  = time(0.0995)  // ~6.5 s: main feature travel
  shimmer = time(0.0151)  // ~1.0 s: micro-detail
}
```
`time(x)` period is `x * 65.536` s. Pick φ-flavored decimals (`0.618`, `0.382`,
`0.0995` rather than round numbers like `0.1`) so ratios between layers stay
irrational-ish — see fibonacci_bloom's periods, consecutive Fibonacci seconds
(21s/34s/55s/89s) that approximate φ and never re-sync within a viewing session.

## Wrap safety

Every quantity derived from `time()` must pass through a periodic function
(`wave`, `triangle`, `sin(x * PI2)`) or be used as pure phase — never as a raw
position. `time()` wraps every `interval * 65.536` s; anything built directly
from the sawtooth value snaps at that wrap. This is a real diagnosed bug class,
not a theoretical one:

```js
// UNSAFE — position built straight from the sawtooth; jumps every ~65.5*0.05 s
var badX = 0.5 + amp * time(0.05)

// SAFE — same phase, driven through sin(): continuous across the wrap
var okX = 0.5 + amp * sin(time(0.05) * PI2)
```
Audit every `time()` use in a pattern against this before shipping — see
`waveforms.md` for the full wave/triangle/square API.

## Asymmetric easing

Natural events are asymmetric in time: impulses attack fast and decay slowly
(sparks, embers, RC discharge); buoyant motion rises slowly and settles more
abruptly. A pure symmetric sine reads as a machine because nothing physical
actually moves that way. Shipped precedent: lava_lamp's wax rises fast (hot,
buoyant) and falls slow (cooling) — a second harmonic breaks the symmetry:

```js
var sY = (sin(phY) + 0.35 * sin(2 * phY)) / 1.26  // fast rise, slow fall
```

For one-shot flashes/sparkles, the canonical shader-art envelope is iq's
`expImpulse` — grows fast, decays slowly, peaks at `t = 1/k`:

```js
function expImpulse(t, k) { var h = k * t; return h * exp(1 - h) }
```

`pow()` reshapes a symmetric `triangle()` the same way: `pow(triangle(t), k)`
with `k > 1` narrows the peak (short bright pulse, long dark dwell — a
heartbeat); `1 - pow(1 - triangle(t), k)` widens the plateau (long glow, quick
dip — breathing/glow, see next section).

For `delta`-driven physics (impacts, triggered events), attack additively and
decay multiplicatively — exponential decay is frame-rate correct and reads as
real dissipation, where linear decay reads mechanical:

```js
if (triggered) energy = min(1, energy + delta * 0.01)  // fast attack
else           energy *= pow(0.999, delta)              // slow exponential decay
```

## Breathing

A slow, small-amplitude modulation of overall brightness/intensity is the
cheapest "alive idle" a pattern has — it's the difference between a static
texture and a living thing. Apple's researched sleep-LED rate (12 breaths/min,
~5 s period) is the calm-but-not-sluggish default; a raw sine dwells too long
mid-brightness and reads metronomic, so use the community `e^sin` shape instead
(sharper peak, longer low dwell, like real inhale/exhale):

```js
export function beforeRender(delta) {
  var s = sin(time(0.076) * PI2)                       // ~5 s period (12/min)
  breath = (exp(s) - 0.36788) / (2.71828 - 0.36788)     // 0..1, e^sin shape
  globalV = 0.55 + 0.45 * breath                        // modulate depth; never to black
}
```
Shipped precedent: lava_lamp's global breath biases `temperature` by
`0.82..1.18` — small enough not to pulse hard, big enough to feel like the
whole piece is warming and cooling. Registers (period = 60/breaths-per-minute):
**8–12 s** meditative, **4–6 s** resting/alive (the Apple-researched zone) —
both product-backed; **under 2.5 s** reads anxious is an untested hypothesis
extrapolated from respiration norms, reserve for intentional urgency and
calibrate on-sculpture. Keep depth to ~20–45% of full brightness; bottoming to
full-off reads as blinking, not breathing.

## Drift vs. events

Continuous drift is the calm baseline (soft-fascination — the eye can rest on
it indefinitely); sparse discrete events (sparkles, pulses) are what keeps that
baseline from becoming wallpaper the eye stops registering. Neither alone works:
all-drift goes inert, all-events becomes a noise trap.

```js
// Poisson-ish spawner: ~one event per avgMs, frame-rate independent.
export function beforeRender(delta) {
  if (random(1) < delta / avgMs) {          // avgMs = 8000 -> ~1 event / 8 s
    sparkIdx = floor(random(pixelCount))
    sparkEnergy = 1
  }
  sparkEnergy *= pow(0.998, delta)          // slow decay ties the event back into drift
}
```
The decay tail matters: the event is discrete, but its aftermath is continuous,
so the pattern never flips between "modes." Jittering interval spawn (never
perfectly periodic — a metronome reads as a machine, not a creature) is well
supported; the exact bands are untested hypothesis, calibrate on-sculpture:
calm register ~one noticeable event per 5–30 s, lively register ~1–4 s,
anything faster than ~1/s starts reading as party/alarm mode.

**Per-element jitter** is the same idea in the spatial domain — give every
pixel/segment its own phase so identical elements never move in lockstep:
`wave(t + index * 0.618)` (golden-angle spacing, no visible ranks), or persist
per-element random speeds at startup. Shipped precedent: lava_lamp couples
period to size (`small ⇒ short period`) so blob mass reads physically instead
of uniform blobs moving in sync, which is the deadest possible look.

**`perlinFbm`** (2–3 octaves) approximates the 1/f "regular irregularity" of
candle flames and water natively — drive a slow `time()` tap through its third
coordinate for a meandering, never-linear path instead of jittering per-frame:
`px = x + 0.2 * perlin(time(0.15) * 4, 0, 0, seed)`.

## Speed as register

For a sculpture viewed from a few meters, think in **crossing time** — how long
a feature takes to traverse the piece — not abstract velocity. The meditative
band is well supported; the faster bands are untested hypothesis, calibrate
on-sculpture:
- **Meditative:** 5–30 s per traversal (the lava-lamp/cloud/candle band).
- **Energetic:** ~0.5–2 s per traversal — comparable to music-tempo periods.
- **Chaotic/alarming:** under 0.5 s plus high spatial frequency; this range
  also triggers peripheral-vision motion capture (solid vision science), which
  is why an overly fast ambient pattern is annoying even out of the corner of
  the eye even though its application to sculptures specifically is untested.

Judge speed at the single-LED level, not the pattern level: a fast-traveling
pattern is fine only if no individual pixel's brightness curve changes fast
enough to flicker. Frame-rate independence is a hard rule, not a nicety —
`time()` is wall-clock already; anything driven by `delta` must integrate it
(`t = (t + delta * speed) % 1`) rather than incrementing per frame, or the same
pattern runs at wildly different speeds on a 40 FPS map versus a 400 FPS strip
(full mechanics in `waveforms.md`).

## Palette cadence — the slowest timescale

Color motion gets its own (slowest) two-timescale pair, separate from the
positional layers above: a long **hold** where the palette reads as a fixed
mood, then a comparatively brief **crossfade** to the next. As shipped patterns
matured this cadence consistently slowed — lava_lamp's rewrite moved from 8s
hold / 6s fade to **45 s hold / 15 s fade** (fade ≈ a third of hold); oil_slick
and warp_core settled near 25s/12s. Faster cadences read as animation, not mood.

```js
// Two-timescale palette cadence: ~45 s hold, ~15 s crossfade (fade = 1/3 of hold)
export function beforeRender(delta) {
  var phase = time(0.9155)                        // ~60 s = 45 hold + 15 fade
  fadeT = clamp((phase - 0.75) / 0.25, 0, 1)       // 0 for the hold, 0..1 over the fade
}
```
`fadeT` is the crossfade weight between the current and next `setPalette()`
array; see [`color-craft.md`](./color-craft.md) for how the two arrays get
resampled into one working palette each frame — this doc only owns the timing.

## Sources

- PB expression docs: https://github.com/simap/pixelblaze/blob/master/README.expressions.md
- Wrap-glitch diagnosis (wizard): https://forum.electromage.com/t/periodic-discontinuity-or-jump-in-pattern/4559
- time() vs delta + sync (wizard): https://forum.electromage.com/t/timing-between-different-pixelblazes-time-vs-delta/2376
- iq shaping functions (expImpulse): https://iquilezles.org/articles/functions/
- Irrational/φ frequency ratios (Xor): https://mini.gmshaders.com/p/dot-noise
- Apple breathing LED: https://patents.google.com/patent/US6658577B2/en
- e^sin breathing curve: https://makersportal.com/blog/2020/3/27/simple-breathing-led-in-arduino
- Ambient animation layering practice: https://www.smashingmagazine.com/2025/09/ambient-animations-web-design-principles-implementation/
- Attention Restoration Theory (soft/hard fascination): https://en.wikipedia.org/wiki/Attention_restoration_theory
- Repo-mined: `patterns/egg/lava_lamp.js`, `fibonacci_bloom.js`, `cosmic_bloom.js`, `oil_slick.js` (git `5a7579d` palette-cadence slowdown)
