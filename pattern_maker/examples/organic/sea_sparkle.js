/*
  Sea Sparkle  (motion-design showcase)

  Bioluminescent water at night — named for Noctiluca scintillans, the
  "sea sparkle" plankton. A dim teal haze wanders through the volume on a
  never-repeating Lissajous drift, a slow swell rolls upward through it, a
  fine ripple shimmers on top, and the whole sea breathes on a resting-calm
  ~5 s cycle. Every so often a plankton bloom flashes: a soft cyan burst that
  ignites almost instantly and fades over a second or two back into the drift.

  Techniques demonstrated:
    - Four incommensurate wrap-safe timescales, φ-flavored intervals so they
      never visibly re-sync: drift ~40.5 s + ~25 s Lissajous pair (0.618 /
      0.382), swell ~7.0 s (0.107), shimmer ~1.0 s (0.0151); adjacent
      positional layers sit 5.8x and 7.1x apart, inside the doc's 4-15x band
      (motion-design.md#timescale-layering).
    - Wrap safety: drift offsets pass through sin(), swell/shimmer sawtooths
      are used only as pure phase into wave() — nothing is built from a raw
      time() position (motion-design.md#wrap-safety).
    - Breathing idle: e^sin curve at ~5 s (the Apple-researched resting rate,
      12/min), depth 42% and never to black — the breath rides on top of the
      colored floor, it can't bottom the sea out
      (motion-design.md#breathing).
    - Sparse events over a drift baseline: a Poisson spawner (~1 flash per
      Flash Rate seconds, frame-rate independent via delta/avgMs) fires
      blooms whose long decay tail ties each event back into the drift so the
      pattern never flips between modes (motion-design.md#drift-vs-events).
    - Asymmetric easing: each bloom's envelope is iq's expImpulse (k=5 —
      peak at 200 ms, ~1.5 s tail): fast attack, slow exponential-flavored
      decay, nothing symmetric (motion-design.md#asymmetric-easing).
    - Delta-based state: flash ages integrate delta (capped so fixed-point
      ms accumulators can't overflow); spawn chance integrates delta
      (motion-design.md#drift-vs-events, #speed-as-register).
    - House-default palette array with a designed value-shape (near-black
      blue floor -> deep water -> teal -> cyan -> pale spark), painted with a
      clamped v (color-craft.md#palette-craft, #white-hot-highlights).

  2D strategy: hybrid — the haze/swell field slices at K=0.5 (decision-tree
  Q1: a noise field's planar cut has the same statistics, and the swell axis
  y is in-plane), but the flashes are 3D point events, so their falloff drops
  the z term (project / drop-a-term, the lava_lamp metaball variant) instead
  of dimming whenever a bloom spawns off-plane
  (2d-parity.md#the-decision-tree, workflow item 5).

  Rubric self-check (visual-rubric.md): strongest on timescales/wrap-safety,
  breathing, and drift-vs-events. Peak flashes deliberately stop at pale
  aqua rather than full white — bioluminescence is an anti-white register
  (crest stays tinted; color-craft.md#white-hot-highlights alternative).
  1D fallback is a vertical column: blooms read there only when they spawn
  near it — documented sparsity, not a bug.

  Sliders:
    Speed       water tempo — low end abyssal stillness, high end a lively
                surface chop (breathing stays at its own rate by design)
    Brightness  overall intensity
    Flash Rate  bloom frequency — low end ~1 per 22 s (calm register),
                high end ~1 per 2.5 s (lively register)
*/

var speed = 1
var brightness = 1
var flashMs = 9000

export function sliderSpeed(v) { speed = 0.3 + v * 2.2 }
export function sliderBrightness(v) { brightness = v }
export function sliderFlashRate(v) { flashMs = 22000 - v * 19500 }

// Designed value-shape palette: dark-weighted lower half, saturated teal
// ramp, pale (not white) spark crest.
var abyss = [
  0.00, 0.000, 0.008, 0.030,
  0.18, 0.000, 0.030, 0.080,
  0.45, 0.000, 0.140, 0.220,
  0.72, 0.050, 0.450, 0.500,
  0.90, 0.400, 0.850, 0.800,
  1.00, 0.700, 0.980, 0.900,
]
setPalette(abyss)

// Flash slots — allocated once at module scope, reused forever.
var NUM_FLASH = 3
var fx = array(NUM_FLASH)
var fy = array(NUM_FLASH)
var fz = array(NUM_FLASH)
var fAge = array(NUM_FLASH)
var fEnv = array(NUM_FLASH)

var i
for (i = 0; i < NUM_FLASH; i++) fAge[i] = 30000  // born long-dead

// iq's expImpulse: fast attack, slow decay, peaks at t = 1/k.
function expImpulse(t, k) { var hh = k * t; return hh * exp(1 - hh) }

// Screen composite: add-like, asymptotic to 1, never clips.
function screen(a, b) { return a + b - a * b }

var driftX = 0, driftY = 0, swellPhase = 0, shimPhase = 0, globalV = 1

export function beforeRender(delta) {
  // Lissajous wander: two incommensurate sine taps meander the noise field
  // forever without a raw-scroll wrap snap.
  driftX = 4 + 0.7 * sin(time(0.618 / speed) * PI2)
  driftY = 4 + 0.7 * sin(time(0.382 / speed) * PI2 + 2.1)
  swellPhase = time(0.107 / speed)   // pure phase into wave()
  shimPhase = time(0.0151 / speed)   // pure phase into wave()

  // e^sin breath, ~5 s period, 42% depth. Independent of Speed: respiration
  // is a physiological register, not water tempo.
  var sB = sin(time(0.076) * PI2)
  globalV = 0.58 + 0.42 * (exp(sB) - 0.36788) / 2.35040

  // Poisson-ish bloom spawner: ~one per flashMs, frame-rate independent.
  if (random(1) < delta / flashMs) {
    var s = 0
    if (fEnv[1] < fEnv[s]) s = 1
    if (fEnv[2] < fEnv[s]) s = 2
    fx[s] = 0.15 + random(0.7)
    fy[s] = 0.15 + random(0.7)
    fz[s] = 0.15 + random(0.7)
    fAge[s] = 0
  }
  for (i = 0; i < NUM_FLASH; i++) {
    if (fAge[i] < 25000) fAge[i] = fAge[i] + delta  // cap: no fixed-point overflow
    fEnv[i] = expImpulse(fAge[i] * 0.001, 5)
  }
}

export function render3D(index, x, y, z) {
  // Drift baseline: wandering luminous haze (one perlin per pixel).
  var n = perlin(x * 2.1 + driftX, y * 2.1 + driftY, z * 2.1, 5) + 0.5

  // Swell: slow noise-warped wave rolling up through the water.
  var swell = wave(y * 1.3 - swellPhase + n * 0.5)

  // Shimmer: fast fine ripple, shallow depth so it reads as texture.
  var shim = 0.85 + 0.15 * wave(shimPhase + x * 3.1 + y * 2.3)

  var base = n * (0.30 + 0.38 * swell) * shim

  // Blooms: finite-support squared-distance falloff (no sqrt), scaled by
  // each slot's expImpulse envelope.
  var fl = 0
  var k, dx, dy, dz, d2, g
  for (k = 0; k < NUM_FLASH; k++) {
    if (fEnv[k] > 0.004) {
      dx = x - fx[k]
      dy = y - fy[k]
      dz = z - fz[k]
      d2 = dx * dx + dy * dy + dz * dz
      g = 1 - d2 * 28
      if (g > 0) fl = fl + g * g * fEnv[k]
    }
  }
  if (fl > 1) fl = 1

  var lum = screen(base, fl)
  var pos = 0.06 + base * 0.72 + fl * 0.55
  if (pos > 1) pos = 1
  // Gamma last; 0.05 colored floor sits outside the breath so the sea never
  // goes fully dark between breaths.
  var v = (0.05 + lum * lum * 0.95 * globalV) * brightness
  paint(pos, min(v, 1))
}

// 2D: field slices at z=0.5 (Q1); bloom falloff drops the z term so every
// flash stays a full-strength event in the panel. See header.
export function render2D(index, x, y) {
  var n = perlin(x * 2.1 + driftX, y * 2.1 + driftY, 1.05, 5) + 0.5
  var swell = wave(y * 1.3 - swellPhase + n * 0.5)
  var shim = 0.85 + 0.15 * wave(shimPhase + x * 3.1 + y * 2.3)
  var base = n * (0.30 + 0.38 * swell) * shim

  var fl = 0
  var k, dx, dy, d2, g
  for (k = 0; k < NUM_FLASH; k++) {
    if (fEnv[k] > 0.004) {
      dx = x - fx[k]
      dy = y - fy[k]
      d2 = dx * dx + dy * dy
      g = 1 - d2 * 28
      if (g > 0) fl = fl + g * g * fEnv[k]
    }
  }
  if (fl > 1) fl = 1

  var lum = screen(base, fl)
  var pos = 0.06 + base * 0.72 + fl * 0.55
  if (pos > 1) pos = 1
  var v = (0.05 + lum * lum * 0.95 * globalV) * brightness
  paint(pos, min(v, 1))
}

// 1D: a vertical column through the sea (blooms read when they spawn nearby).
export function render(index) {
  render2D(index, 0.5, index / pixelCount)
}
