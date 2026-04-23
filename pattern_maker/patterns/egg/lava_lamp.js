/*
  Lava Lamp 3D (metaballs)

  Blob centers drift through the volume with a strong vertical bias. Each
  pixel sums an inverse-square contribution from every blob; the sum is
  smoothstepped into an "inside-ness" in 0..1, which drives both palette
  position and brightness. Result: discrete glowing globs with real edges.

  What keeps it visually alive (each addressed a specific "too boring" note):
    - Colored cool background. Pure black backgrounds read as "off LEDs".
      Palette spans violet/indigo (pos 0) through black transition (pos ~0.15)
      into the warm lava ramp. A small v floor lights the background dimly,
      so there's always *something* on every pixel.
    - Per-blob temperature. Each blob carries its own palette-offset so
      some globs read cool-red, others hot-yellow. Temperature is combined
      via field-weighted average, so merging blobs average their colors.
    - Asymmetric vertical motion. Real wax rises fast (hot, buoyant) and
      falls slow (cooling). A second harmonic on the bob phase sharpens
      peaks and flattens troughs, breaking the sine-wave monotony.
    - Global breathing pulse. A slow sinusoid biases overall temperature
      up and down, so the whole lamp periodically "heats up" and "cools".
    - Internal banding. Palette position gets a small high-frequency
      perturbation from inside-ness itself, so blob interiors show faint
      heat-zone rings instead of a single flat color.

  Why metaballs not perlin: perlin is a smooth gradient field with no
  surface. Lava lamps are defined by their *surface* — the wax/water
  interface. Metaballs give that surface implicitly (level set of a sum
  of radial kernels) while staying O(NUM_BLOBS) per pixel.

  Why sin(time(p)*PI2 + offset): sin of a sawtooth phase wraps continuously
  (sin(PI2)==sin(0)), so blobs orbit forever with no teleport artifacts
  when time() resets.

  Sliders:
    Speed       bob rate
    Brightness  overall intensity
    Scale       blob size (larger = fatter globs, more merging)
    Viscosity   vertical-vs-lateral motion ratio (1 = pure wax lamp, 0 = chaotic goop)
    Fade Speed  palette cross-fade rate
*/

// ============================================================
// Palettes — all share the same shape: dark (often colored) ambient at
// pos 0, near-black transition around pos 0.12-0.18, then a saturated
// warm/colored ramp up to a bright highlight at pos 1.0. That shape is
// what makes this look like a lava lamp under every palette — light
// blobs popping out of a dark background, not a uniform hue wash.
// ============================================================

// Classic Lava — violet ambient, red/orange/yellow core
var lava_classic = [
  0.00, 0.060, 0.010, 0.180,
  0.08, 0.030, 0.000, 0.080,
  0.15, 0.010, 0.000, 0.020,
  0.30, 0.180, 0.000, 0.000,
  0.48, 0.600, 0.060, 0.000,
  0.68, 0.950, 0.280, 0.010,
  0.84, 1.000, 0.650, 0.050,
  0.94, 1.000, 0.880, 0.200,
  1.00, 1.000, 0.950, 0.520,
]

// Hellfire — dark plum ambient, pure fire core
var lava_hellfire = [
  0.00, 0.080, 0.000, 0.040,
  0.10, 0.020, 0.000, 0.010,
  0.18, 0.000, 0.000, 0.000,
  0.32, 0.250, 0.000, 0.020,
  0.50, 0.700, 0.020, 0.000,
  0.70, 1.000, 0.180, 0.000,
  0.85, 1.000, 0.450, 0.020,
  0.95, 1.000, 0.700, 0.100,
  1.00, 1.000, 0.850, 0.250,
]

// Plasma — deep navy ambient, purple/magenta/hot-pink core
var lava_plasma = [
  0.00, 0.020, 0.010, 0.180,
  0.08, 0.010, 0.000, 0.080,
  0.15, 0.008, 0.000, 0.020,
  0.30, 0.200, 0.000, 0.250,
  0.50, 0.500, 0.010, 0.500,
  0.70, 0.900, 0.060, 0.400,
  0.85, 1.000, 0.200, 0.350,
  0.95, 1.000, 0.400, 0.350,
  1.00, 1.000, 0.600, 0.450,
]

// Emerald Ember — dark forest ambient, green/chartreuse/gold core
var lava_emerald = [
  0.00, 0.010, 0.070, 0.050,
  0.08, 0.005, 0.030, 0.020,
  0.15, 0.000, 0.010, 0.005,
  0.30, 0.020, 0.200, 0.010,
  0.50, 0.120, 0.500, 0.020,
  0.70, 0.400, 0.800, 0.040,
  0.85, 0.800, 0.900, 0.080,
  0.95, 1.000, 0.850, 0.120,
  1.00, 1.000, 0.950, 0.350,
]

// Abyss Glow — dark teal ambient, cyan/turquoise/amber core (cool base,
// warm tip — like bioluminescent magma)
var lava_abyss = [
  0.00, 0.010, 0.060, 0.080,
  0.08, 0.000, 0.020, 0.030,
  0.15, 0.000, 0.005, 0.010,
  0.30, 0.000, 0.200, 0.250,
  0.50, 0.030, 0.500, 0.550,
  0.70, 0.200, 0.800, 0.600,
  0.85, 0.700, 0.850, 0.250,
  0.95, 1.000, 0.700, 0.080,
  1.00, 1.000, 0.850, 0.200,
]

var allPalettes = [lava_classic, lava_hellfire, lava_plasma, lava_emerald, lava_abyss]

// ---------- cross-fade ----------
// Resample each pair at SAMPLES evenly-spaced positions and lerp them
// into a working palette every frame. ~16 samples + setPalette is cheap
// compared to per-pixel work.
var SAMPLES = 16
var blendedPalette = array(SAMPLES * 4)
var paletteA = 0
var paletteB = 1
var paletteTimer = 0
var paletteHoldSeconds = 45
var paletteFadeSeconds = 15

// Output globals for samplePalette (avoids allocating return arrays).
var sampR = 0, sampG = 0, sampB = 0

function samplePalette(pal, t) {
  var n = pal.length
  var si = 4
  while (si < n && pal[si] < t) si += 4
  if (si >= n) {
    sampR = pal[n - 3]; sampG = pal[n - 2]; sampB = pal[n - 1]
    return
  }
  var p0 = pal[si - 4], p1 = pal[si]
  var span = p1 - p0
  var ff = span > 0 ? (t - p0) / span : 0
  var r0 = pal[si - 3], g0 = pal[si - 2], b0 = pal[si - 1]
  var r1 = pal[si + 1], g1 = pal[si + 2], b1 = pal[si + 3]
  sampR = r0 + (r1 - r0) * ff
  sampG = g0 + (g1 - g0) * ff
  sampB = b0 + (b1 - b0) * ff
}

function rebuildPalette(blendT) {
  var palA = allPalettes[paletteA]
  var palB = allPalettes[paletteB]
  var ii, xx, rA, gA, bA
  var step = 1 / (SAMPLES - 1)
  for (ii = 0; ii < SAMPLES; ii++) {
    xx = ii * step
    samplePalette(palA, xx)
    rA = sampR; gA = sampG; bA = sampB
    samplePalette(palB, xx)
    blendedPalette[ii * 4]     = xx
    blendedPalette[ii * 4 + 1] = rA + (sampR - rA) * blendT
    blendedPalette[ii * 4 + 2] = gA + (sampG - gA) * blendT
    blendedPalette[ii * 4 + 3] = bA + (sampB - bA) * blendT
  }
  setPalette(blendedPalette)
}

rebuildPalette(0)

// ============================================================
// Blob state (flat arrays — no per-frame allocation)
// ============================================================
var NUM_BLOBS = 8

var blobX = array(NUM_BLOBS)
var blobY = array(NUM_BLOBS)
var blobZ = array(NUM_BLOBS)

var periodX = array(NUM_BLOBS)
var periodY = array(NUM_BLOBS)
var periodZ = array(NUM_BLOBS)

var phaseOffX = array(NUM_BLOBS)
var phaseOffY = array(NUM_BLOBS)
var phaseOffZ = array(NUM_BLOBS)

// Per-blob size multiplier: mix of big lumbering globs and small darting
// hot ones. Variance is where interest lives — uniform-size blobs in sync
// look mechanical.
var blobSizeMul = array(NUM_BLOBS)

// Per-blob temperature in ~0.45..1.05. Weighted-averaged in render so
// merging blobs gradually blend color (orange + red = warm orange in the
// overlap region). Values > 1 are allowed — the palette clamps naturally.
var blobTemp = array(NUM_BLOBS)

var sizeSeeds = array(NUM_BLOBS)
sizeSeeds[0] = 1.7;  sizeSeeds[1] = 0.5;  sizeSeeds[2] = 1.2;  sizeSeeds[3] = 0.45
sizeSeeds[4] = 1.9;  sizeSeeds[5] = 0.7;  sizeSeeds[6] = 1.0;  sizeSeeds[7] = 0.5

var tempSeeds = array(NUM_BLOBS)
tempSeeds[0] = 0.55; tempSeeds[1] = 1.00; tempSeeds[2] = 0.70; tempSeeds[3] = 1.05
tempSeeds[4] = 0.50; tempSeeds[5] = 0.90; tempSeeds[6] = 0.80; tempSeeds[7] = 0.95

var i
for (i = 0; i < NUM_BLOBS; i++) {
  // Small blobs dart (short periods), big blobs lumber (long periods).
  periodY[i] = (2.6 + i * 0.35) * (0.55 + sizeSeeds[i] * 0.55)
  periodX[i] = (6.5 + i * 1.0)  * (0.70 + sizeSeeds[i] * 0.40)
  periodZ[i] = (8.3 + i * 1.2)  * (0.70 + sizeSeeds[i] * 0.40)
  phaseOffY[i] = i * 0.7853
  phaseOffX[i] = i * 1.9098
  phaseOffZ[i] = i * 2.7925
  blobSizeMul[i] = sizeSeeds[i]
  blobTemp[i] = tempSeeds[i]
}

// ============================================================
// Sliders
// ============================================================
var speedMul = 9.75
var brightness = 1
var blobR2 = 0.022
var viscosity = 0.45
var fadeSpeedMul = 1

export function sliderSpeed(v) { speedMul = 2.0 + v * 23.0 }
export function sliderBrightness(v) { brightness = v }
export function sliderScale(v) { blobR2 = 0.008 + v * 0.040 }
export function sliderViscosity(v) { viscosity = v }
export function sliderFadeSpeed(v) { fadeSpeedMul = 0.2 + v * 4 }

// ============================================================
// Frame
// ============================================================
var ampY = 0.52
var ampLateralBase = 0.11
var ampLateralRange = 0.26

// Breathing pulse (global temperature modulator) — slow, irrational period
// so it doesn't sync with bob cycles.
var breathPeriod = 11.3
var breath = 1

export function beforeRender(delta) {
  // Palette cross-fade: hold on A, fade from A->B over paletteFadeSeconds,
  // then B becomes A and we pick the next palette. fadeSpeedMul scales
  // wall time so the slider accelerates both hold and fade together.
  paletteTimer += (delta / 1000) * fadeSpeedMul
  if (paletteTimer >= paletteHoldSeconds + paletteFadeSeconds) {
    paletteA = paletteB
    paletteB = (paletteB + 1) % allPalettes.length
    paletteTimer = 0
  }
  var blendT = paletteTimer < paletteHoldSeconds
    ? 0
    : (paletteTimer - paletteHoldSeconds) / paletteFadeSeconds
  rebuildPalette(blendT)

  var ampXZ = ampLateralBase + ampLateralRange * (1 - viscosity)
  // Breath: 0.82..1.18. Small enough not to pulse hard, big enough to feel
  // like the whole lamp is "warming" and "cooling".
  breath = 1 + 0.18 * sin(time(breathPeriod / speedMul) * PI2)

  var j
  for (j = 0; j < NUM_BLOBS; j++) {
    var py = periodY[j] / speedMul
    var px = periodX[j] / speedMul
    var pz = periodZ[j] / speedMul
    var phY = time(py) * PI2 + phaseOffY[j]
    var phX = time(px) * PI2 + phaseOffX[j]
    var phZ = time(pz) * PI2 + phaseOffZ[j]

    // Asymmetric vertical bob: sin(p) + 0.35*sin(2p) peaks sharply (fast
    // rise, slow fall) — molten-wax buoyancy read. Normalized to keep
    // amplitude ~= ampY. Peak of sin(p)+0.35*sin(2p) is ~1.26.
    var sY = (sin(phY) + 0.35 * sin(2 * phY)) / 1.26
    blobY[j] = 0.5 + ampY  * sY
    blobX[j] = 0.5 + ampXZ * sin(phX)
    blobZ[j] = 0.5 + ampXZ * sin(phZ)
  }
}

// ============================================================
// Render
// ============================================================
var fieldEps = 0.0025
var threshLo = 0.9
var threshHi = 2.4

// Palette remap: background (inside=0) sits at ~0.05 (cool violet zone).
// Full interior (inside=1) reaches ~0.97 (warm highlight). This way every
// pixel shows *something* — dim violet ambient when no blob is near,
// ramping through black transition into warm lava as a blob arrives.
var bgPos = 0.05
var bgV = 0.09           // persistent dim ambient glow
var posRange = 0.92      // 0.05 -> 0.97

export function render3D(index, x, y, z) {
  // Accumulate field and weighted temperature in one pass.
  var f = 0
  var fT = 0
  var k
  for (k = 0; k < NUM_BLOBS; k++) {
    var dx = x - blobX[k]
    var dy = y - blobY[k]
    var dz = z - blobZ[k]
    var contrib = blobR2 * blobSizeMul[k] / (dx * dx + dy * dy + dz * dz + fieldEps)
    f += contrib
    fT += contrib * blobTemp[k]
  }
  var temperature = f > 0 ? fT / f : 0.8
  var inside = smoothstep(threshLo, threshHi, f)

  // Palette position: background anchor + warm ramp scaled by temperature
  // and global breath. Inner band: a small triangle-wave perturbation of
  // inside adds faint heat-zone rings inside each blob, so the interior
  // isn't a flat smooth gradient.
  var band = (triangle(inside * 2.3) - 0.5) * 0.06
  var pos = bgPos + inside * posRange * temperature * breath + band * inside
  if (pos < 0) pos = 0
  if (pos > 1) pos = 1

  // Quadratic gamma on brightness keeps edges crisp. bgV floor keeps the
  // cool ambient lit so the background never goes to pure black.
  var v = bgV + inside * inside * brightness
  paint(pos, v)
}

// 2D fallback: slice through the middle of the volume.
export function render2D(index, x, y) {
  render3D(index, x, y, 0.5)
}

// 1D fallback: march a vertical line so bobs still read on a strip.
export function render(index) {
  var p = index / pixelCount
  render3D(index, 0.5, p, 0.5)
}
