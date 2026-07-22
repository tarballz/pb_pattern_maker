/*
  Cosmic Bloom — 5-fold kaleidoscopic bloom on the egg

  A deliberately psychedelic 3D-showcase pattern. Petals fold around the
  pole-to-pole axis (N-fold symmetry), a wavefront blooms down from the
  top pole (y=1), breathing rings radiate from the vertical spine, and a
  fast micro-shimmer keeps the surface alive. Cosmic jewel palette:
  violet-navy troughs, violet→magenta mid, hot-pink→gold crests.

  2D strategy: RE-PARAMETERIZE (2d-parity.md decision-tree Q3 — the N-fold
  kaleidoscope is azimuthal). render2D re-derives theta = atan2(y-0.5,
  x-0.5) around the panel's own center; panel radial distance doubles as
  both the pole-axis coordinate (center = top pole, edge = bottom pole)
  and the equatorial-radius analog for the breathing rings. A z=0.5 slice
  would collapse theta to {0, π} (failure class 1) and erase the petals.

  Raw hsv() (no palette array) is deliberate: three hand-tuned value/
  saturation zones with a crest hue-shift through red into gold — a 1D
  gradient palette can't carry independent per-zone saturation
  (color-craft.md palette-vs-hsv decision guide).

  Sliders:
    Speed      — overall animation rate (1x at default)
    Fold       — rotational symmetry count (3..9, default 5)
    Brightness — global output scale
*/

var speed = 1
var fold = 5
var foldInv = PI2 / 5
var brightness = 1

// Slider handler fires on pattern load with saved value (often 0 on first
// install). Map so even v=0 gives usable 0.4x speed, v=0.5 → 1x, v=1 → 2.5x.
export function sliderSpeed(v) {
  speed = 0.4 + v * 2.1
}
export function sliderFold(v) {
  fold = 3 + floor(v * 6 + 0.0001)
  if (fold > 9) fold = 9
  foldInv = PI2 / fold
}
export function sliderBrightness(v) {
  brightness = 0.3 + v * 0.7
}

// Per-LED spatial caches. theta = atan2(z-0.5, x-0.5), r = hypot(x-0.5, z-0.5).
// Both are fixed geometric constants; computing them every frame would cost
// ~1352 atan2 + hypot calls. Populate on first sight, read thereafter.
// thetaCache sentinel: -999 means "not yet cached" (real values are in [-PI, PI]).
var thetaCache = array(pixelCount)
var rCache = array(pixelCount)
for (i = 0; i < pixelCount; i++) thetaCache[i] = -999

// Time phases driven by PB's time() — each time(interval) returns a sawtooth
// 0..1 with period ≈ interval * 65.536s. Dividing interval by speed makes
// larger speed = shorter period = faster motion.
var tSlow = 0        // 0..PI2, drives rotation of the folded theta wedge
var tBreath = 0      // 0..PI2, drives breathing radial rings
var tBloom = 0       // 0..1,   drives y-direction traveling wave
var tShimmer = 0     // 0..PI2, drives fast per-LED shimmer

export function beforeRender(delta) {
  tSlow    = time(0.15 / speed) * PI2   // ~10s full rotation at speed=1
  tBreath  = time(0.04 / speed) * PI2   // ~2.6s breath period at speed=1
  tBloom   = time(0.10 / speed)         // ~6.5s y-wave period at speed=1
  tShimmer = time(0.01 / speed) * PI2   // ~0.65s shimmer period at speed=1
}

export function render3D(index, x, y, z) {
  // Fetch cached per-LED polar coordinates around the vertical axis.
  var theta = thetaCache[index]
  var r
  if (theta < -500) {
    var cx = x - 0.5
    var cz = z - 0.5
    theta = atan2(cz, cx)
    r = hypot(cx, cz)
    thetaCache[index] = theta
    rCache[index] = r
  } else {
    r = rCache[index]
  }

  // --- Geometric layers ---

  // 5-fold (or N-fold) kaleidoscope fold around the vertical axis, rotating.
  // mod() keeps theta+tSlow positive before folding; multiplying by fold
  // re-expands the wedge to [0, 2*PI) so downstream trig sees full range.
  var thetaFolded = mod(theta + tSlow, foldInv) * fold

  // 10 lobes (2 per fold) that pitch gently down y — the pitch is what
  // makes the lobes corkscrew around the egg instead of being flat bands.
  var petal = sin(thetaFolded * 2 + 0.8 * y - tSlow * 2)

  // Breathing rings traveling outward from the vertical spine.
  var ringWave = sin(3.5 * r - tBreath)

  // Traveling wave along the pole axis — the "bloom" now reads as a
  // continuous cascade from top (y=1) to bottom (y=0). Always visible,
  // no dead zones.
  var yWave = sin(y * 4.5 - tBloom * PI2)

  // Per-LED phase-offset micro-shimmer.
  var shimmer = sin(tShimmer + index * 0.137) * 0.12

  // Compose all four layers additively. Range ≈ ±1.5.
  var I = 0.7 * petal + 0.5 * ringWave + 0.5 * yWave + shimmer
  var In = clamp((I + 1.5) / 3.0, 0, 1)

  // --- Cosmic jewel palette ---
  // Three zones. Crest zone wraps hue through red (0.92 → 1.08 ≡ 0.08)
  // into gold so peaks shift IN-HUE instead of desaturating to white.
  var h, s, v
  if (In < 0.33) {
    var tt = In / 0.33
    h = 0.72
    s = 0.95
    v = mix(0.22, 0.40, tt)
  } else if (In < 0.75) {
    var tt = (In - 0.33) / 0.42
    h = mix(0.75, 0.88, tt)
    s = 0.95
    v = mix(0.40, 0.78, tt)
  } else {
    var tt = (In - 0.75) / 0.25
    h = mix(0.92, 1.08, tt)
    s = 0.90
    v = mix(0.78, 1.0, tt)
  }

  // Saturation floor — never desaturate to white (clipping fix, not dimming).
  if (s < 0.35) s = 0.35

  // Gamma correction for perceptually linear brightness on LEDs.
  v = v * v

  // Global brightness slider.
  v = v * brightness

  // Dithering deadband — hard snap below the PWM dithering threshold to
  // prevent flicker on dark troughs. No soft floor.
  if (v < 0.04) v = 0

  hsv(h, s, v)
}

// 2D — RE-PARAMETERIZED, not sliced (see header): theta from
// atan2(y-0.5, x-0.5) around the panel center; panel radius r maps to
// the pole-axis coordinate (center = top pole y=1, edge = bottom pole
// y=0) and also stands in for the equatorial radius driving ringWave,
// so all four layers stay live instead of theta collapsing to {0, π}.
export function render2D(index, x, y) {
  var dx = x - 0.5
  var dy = y - 0.5
  var theta = atan2(dy, dx)
  var r = sqrt(dx * dx + dy * dy)
  if (r > 0.5) r = 0.5
  var yEquiv = 1 - 2 * r

  var thetaFolded = mod(theta + tSlow, foldInv) * fold

  var petal = sin(thetaFolded * 2 + 0.8 * yEquiv - tSlow * 2)

  // Breathing rings — panel radius is the equatorial-radius analog.
  var ringWave = sin(3.5 * r - tBreath)

  // Bloom cascade travels center (top pole) → edge (bottom pole).
  var yWave = sin(yEquiv * 4.5 - tBloom * PI2)

  var shimmer = sin(tShimmer + index * 0.137) * 0.12

  var I = 0.7 * petal + 0.5 * ringWave + 0.5 * yWave + shimmer
  var In = clamp((I + 1.5) / 3.0, 0, 1)

  // Same cosmic jewel palette zones as render3D.
  var h, s, v
  if (In < 0.33) {
    var tt = In / 0.33
    h = 0.72
    s = 0.95
    v = mix(0.22, 0.40, tt)
  } else if (In < 0.75) {
    var tt = (In - 0.33) / 0.42
    h = mix(0.75, 0.88, tt)
    s = 0.95
    v = mix(0.40, 0.78, tt)
  } else {
    var tt = (In - 0.75) / 0.25
    h = mix(0.92, 1.08, tt)
    s = 0.90
    v = mix(0.78, 1.0, tt)
  }

  if (s < 0.35) s = 0.35

  v = v * v
  v = v * brightness
  if (v < 0.04) v = 0

  hsv(h, s, v)
}

// 1D fallback — walk the pole axis (ember_drift.js convention, AGENTS.md).
export function render(index) {
  render3D(index, 0.5, index / pixelCount, 0.5)
}
