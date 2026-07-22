/*
  Fibonacci Bloom — phyllotaxis wavefront on the egg

  Seeds spawn at the top pole (y=1) and descend in a sunflower-style
  phyllotaxis layout: every seed is placed at the previous angle plus the
  golden angle (137.5°). That single rule is what produces the visible
  Fibonacci-number spiral count.

  A bright wavefront sweeps top→bottom. Pixels whose azimuth lies near
  an ideal golden-angle spiral ridge light up; pixels between ridges
  stay dark. Color is drawn from a 4-palette cosmic progression
  (emission nebula → galactic core → deep-space purple → starlight)
  with continuous cross-fades ~30s per slot.

  Golden-ratio walk on palette position means adjacent seeds land on
  distinct palette colors — a second hat-tip to φ.

  2D strategy: RE-PARAMETERIZE (2d-parity.md decision-tree Q3 — golden-angle
  spirals around the pole axis are azimuthal). render2D re-derives theta =
  atan2(y-0.5, x-0.5) around the panel's own center and maps panel radial
  distance to depth (center = top pole, edge = bottom pole): the ridges
  become rotating golden-angle spokes and the wavefronts become expanding
  rings. A z=0.5 slice would collapse theta to {0, π} (failure class 1),
  leaving only the wavefronts.

  Sliders:
    Speed          — overall animation rate
    Brightness     — global output scale
    RidgeSharpness — how tight the spiral ridges are (low = wide glow, high = crisp lines)
*/

// ============================================================
// PALETTES — 4-slot cosmic progression, fetched via palette_maker
// ============================================================

//https://phillips.shef.ac.uk/pub/cpt-city/bhw/bhw1/bhw1_oldladyinpurple
//pink-purple-black (emission nebula)
var bhw1_oldladyinpurple_gp = [
    0, 212,130,230,
    3, 212,130,230,
   82, 128,  0,128,
  158,  69, 24, 70,
  255,   0,  0,  0]
arrayMutate(bhw1_oldladyinpurple_gp,(v, i ,a) => v / 255);

//https://phillips.shef.ac.uk/pub/cpt-city/bhw/bhw2/bhw2_xc
//navy-purple-brown-orange-yellow (galactic core)
var bhw2_xc_gp = [
    0,  56, 30, 68,
    3,  56, 30, 68,
   59,  89,  0,130,
  122, 103,  0, 86,
  158, 205, 57, 29,
  184, 223,117, 35,
  219, 241,177, 41,
  255, 247,247, 35]
arrayMutate(bhw2_xc_gp,(v, i ,a) => v / 255);

//https://phillips.shef.ac.uk/pub/cpt-city/bhw/bhw1/bhw1_14
//black-purple-navy-blue-navy-purple-black (deep space)
var bhw1_14_gp = [
    0,   0,  0,  0,
   12,  35,  4, 48,
   54,  70,  8, 96,
   81,  56, 48,168,
  120,  43, 89,239,
  146,  64, 59,175,
  186,  86, 30,110,
  234,  43, 15, 55,
  255,   0,  0,  0]
arrayMutate(bhw1_14_gp,(v, i ,a) => v / 255);

//https://phillips.shef.ac.uk/pub/cpt-city/neota/elem/crackly-ice
//black-navy-teal-gray-white (starlight / ion trail)
var crackly_ice_gp = [
    0,   0,  0,  3,
   38,  30, 32, 78,
   76,  59, 64,153,
  166, 157,160,204,
  255, 255,255,255]
arrayMutate(crackly_ice_gp,(v, i ,a) => v / 255);

var palettes = [bhw1_oldladyinpurple_gp, bhw2_xc_gp, bhw1_14_gp, crackly_ice_gp]

// ============================================================
// PALETTE MANAGER — verbatim from perlin_kal.js idiom
// Holds on one palette for PALETTE_HOLD_TIME seconds, then
// cross-fades to the next over PALETTE_TRANSITION_TIME seconds.
// ============================================================

var PALETTE_HOLD_TIME = 20         // seconds steady per slot
var PALETTE_TRANSITION_TIME = 10   // seconds cross-fade between slots

var currentIndex = 0
var nextIndex = (currentIndex + 1) % palettes.length

var pixel1 = array(3)
var pixel2 = array(3)

var PALETTE_SIZE = 16
var currentPalette = array(4 * PALETTE_SIZE)

var inTransition = 0
var blendValue = 0
var runTime = 0

setPalette(currentPalette)

// Sample a gradient palette into an rgbArray at position v.
function paint2(v, rgbArray, pal) {
  var k, u, l
  var rows = pal.length / 4
  for (i = 0; i < rows; i++) {
    k = pal[i * 4]
    if (k >= v) break
  }
  if ((i == 0) || (i >= rows) || (k == v)) {
    i = 4 * min(rows - 1, i)
    rgbArray[0] = pal[i + 1]
    rgbArray[1] = pal[i + 2]
    rgbArray[2] = pal[i + 3]
  } else {
    i = 4 * (i - 1)
    l = pal[i]
    u = pal[i + 4]
    pct = 1 - (u - v) / (u - l)
    rgbArray[0] = mix(pal[i + 1], pal[i + 5], pct)
    rgbArray[1] = mix(pal[i + 2], pal[i + 6], pct)
    rgbArray[2] = mix(pal[i + 3], pal[i + 7], pct)
  }
}

// Rebuild currentPalette as the blend of pal1 and pal2 at fraction `blend`.
function buildBlendedPalette(pal1, pal2, blend) {
  var entry = 0
  for (var i = 0; i < PALETTE_SIZE; i++) {
    var v = i / PALETTE_SIZE
    paint2(v, pixel1, pal1)
    paint2(v, pixel2, pal2)
    currentPalette[entry++] = v
    currentPalette[entry++] = mix(pixel1[0], pixel2[0], blend)
    currentPalette[entry++] = mix(pixel1[1], pixel2[1], blend)
    currentPalette[entry++] = mix(pixel1[2], pixel2[2], blend)
  }
}

buildBlendedPalette(palettes[currentIndex], palettes[nextIndex], blendValue)

function setupPalette(delta) {
  runTime = (runTime + delta / 1000) % 3600
  if (inTransition) {
    if (runTime >= PALETTE_TRANSITION_TIME) {
      runTime = 0
      inTransition = 0
      blendValue = 0
      currentIndex = (currentIndex + 1) % palettes.length
      nextIndex = (nextIndex + 1) % palettes.length
    } else {
      blendValue = runTime / PALETTE_TRANSITION_TIME
    }
    buildBlendedPalette(palettes[currentIndex], palettes[nextIndex], blendValue)
  } else if (runTime >= PALETTE_HOLD_TIME) {
    runTime = 0
    inTransition = 1
  }
}

// ============================================================
// PATTERN
// ============================================================

// Golden-angle constants.
var GA = PI * (3 - sqrt(5))   // 2.39996 rad ≈ 137.507°
var INV_PHI = 0.6180339887

// Phyllotaxis seed density along the egg's pole axis. Higher = more,
// tighter spiral ridges; lower = fewer, wider spirals. At 1352 LEDs on
// the egg, ~28 gives visible Fibonacci spiral counts without aliasing.
var seedDensity = 28

// Always-on palette glow so every pixel reads its palette color even
// between ridges — prevents the egg from looking dark and empty. Unlike
// the sibling variants' arm formulas, ridgeA/ridgeB here aren't folded
// into a bounded sector, so they (and their product) can sit arbitrarily
// close to 0 across most of the surface — baseGlow alone sets the true
// floor for a large fraction of pixels. See the render3D/render2D tail for
// why that floor needs re-clamping after the brightness multiply too.
var baseGlow = 0.22

// Sliders.
var speed = 1
var brightness = 1
var ridgeSharpness = 35   // k in 1/(1 + sp^2 * k); higher = tighter ridges

export function sliderSpeed(v) { speed = 0.3 + v * 2.4 }
export function sliderBrightness(v) { brightness = 0.3 + v * 0.7 }
export function sliderRidgeSharpness(v) { ridgeSharpness = 10 + v * 90 }

// Per-LED spatial caches. theta = atan2(z-0.5, x-0.5) and the base seed
// index (1-y)*seedDensity are fixed geometric constants per LED; caching
// avoids ~1352 atan2 calls per frame. Sentinel -999 means "not yet
// cached" (real thetas are in [-PI, PI]).
var thetaCache = array(pixelCount)
var seedBaseCache = array(pixelCount)
for (i = 0; i < pixelCount; i++) thetaCache[i] = -999

// Frame state — five independent motion axes at golden-ratio-related
// periods so they never synchronize. Periods (at speed=1) chosen near
// the Fibonacci sequence {5, 8, 13, 21, 33} seconds — each is roughly
// φ times the previous. T = 65.536 * the time() argument.
//
//   breathRidge    ~5s    ridge width pulse
//   tWaveA         ~8s    top→bottom wavefront
//   tRotateA       ~13s   clockwise spiral rotation
//   tRotateB       ~21s   counter-clockwise rotation (slower, φ×)
//   tWaveB         ~21s   bottom→top counter-wavefront
//   densityPulse   ~33s   seed-density breath
//   tDrift         ~33s   palette color drift
var tRotateA = 0
var tRotateB = 0
var tWaveA = 0
var tWaveB = 0
var breathRidge = 0
var densityPulse = 1
var tDrift = 0

export function beforeRender(delta) {
  setupPalette(delta)
  var sp = speed
  tWaveA       = time(0.12 / sp)            // ~8s primary wavefront
  tRotateA     = time(0.20 / sp) * PI2      // ~13s spiral spin (CW)
  tRotateB     = time(0.32 / sp) * PI2      // ~21s counter-spin (CCW)
  tWaveB       = time(0.32 / sp)            // ~21s upward wave
  breathRidge  = wave(time(0.08 / sp))      // ~5s ridge width breath
  densityPulse = 0.82 + 0.36 * wave(time(0.50 / sp))   // ~33s density breath
  tDrift       = time(0.50 / sp)            // ~33s palette color drift
}

export function render3D(index, x, y, z) {
  // Lazy per-LED cache prime: azimuth + base seed index are fixed per LED.
  var theta = thetaCache[index]
  var seedStatic
  if (theta < -500) {
    var cx = x - 0.5
    var cz = z - 0.5
    theta = atan2(cz, cx)
    thetaCache[index] = theta
    seedStatic = (1 - y) * seedDensity
    seedBaseCache[index] = seedStatic
  } else {
    seedStatic = seedBaseCache[index]
  }

  // Live seed index — varies each frame as density breathes.
  var seedN = seedStatic * densityPulse

  // Breath modulates ridge tightness: wide (0.45×) → narrow (1.35×).
  var effSharp = ridgeSharpness * (0.45 + 0.9 * breathRidge)

  // --- Spiral family A: clockwise-rotating golden-angle ridge ---
  var angleA = mod(seedN * GA + tRotateA + PI, PI2) - PI
  var dA = abs(theta - angleA)
  if (dA > PI) dA = PI2 - dA
  var ridgeA = 1 / (1 + dA * dA * effSharp)

  // --- Spiral family B: counter-rotating, phase-offset by PI/φ ---
  // The φ-offset keeps families A and B from ever collapsing onto each
  // other. Counter-rotation means their intersection nodes travel, which
  // is what creates the "moving bright points" look of a sunflower.
  var angleB = mod(seedN * GA - tRotateB + PI * INV_PHI + PI, PI2) - PI
  var dB = abs(theta - angleB)
  if (dB > PI) dB = PI2 - dB
  var ridgeB = 1 / (1 + dB * dB * effSharp * 0.7)

  // Combine families — probabilistic OR gives soft crossings without clipping.
  var ridge = ridgeA + ridgeB - ridgeA * ridgeB

  // --- Wavefront A: primary, top (y=1) → bottom (y=0) ---
  var depth = 1 - y
  var distA = depth - tWaveA
  if (distA > 0.5) distA -= 1
  if (distA < -0.5) distA += 1
  // Asymmetric bell — sharper leading edge, long trailing tail.
  var tailA = distA < 0 ? 7 : 3.5
  var waveA = 1 / (1 + distA * distA * tailA)

  // --- Wavefront B: secondary, bottom → top, slower and softer ---
  // Peak position = 1 - tWaveB. As tWaveB climbs 0→1, peak moves 1→0.
  var distB = depth + tWaveB - 1
  if (distB > 0.5) distB -= 1
  if (distB < -0.5) distB += 1
  var waveB = 1 / (1 + distB * distB * 6)

  // Combine wavefronts — additive with a soft cap so they can overlap
  // brightly in the middle but never wash out to pure white.
  var wave = waveA + 0.55 * waveB
  if (wave > 1.1) wave = 1.1

  // Compose: baseline glow + animated highlight.
  var v = baseGlow + (1 - baseGlow) * ridge * wave

  // Palette position — couple seed (axial), azimuth, and time with
  // golden-ratio weights. Each axis contributes independently so hue
  // varies continuously across the whole surface and over time. The
  // 1/(2π) on theta normalizes it; φ⁻¹ is our signature weight.
  var pos = seedStatic * INV_PHI + theta * 0.1592 * INV_PHI + tDrift
  pos = pos - floor(pos)

  // Gamma, then brightness. baseGlow's pre-gamma floor (0.22) alone isn't
  // enough: at the emulator's default Brightness=0.65 slider probe,
  // baseGlow^2 * 0.65 ≈ 0.031 sits below the 0.04 dithering deadband, so
  // the plain "hard-snap below threshold" form (still used by the sibling
  // fibonacci_bloom*.js files, safe there because their sector-folded arm
  // formulas rarely reach baseGlow's floor) was zeroing most inter-ridge
  // pixels here — dead LEDs on the sculpture, not "dark valleys"
  // (color-craft.md, "Background is a color decision"). Re-clamp after the
  // brightness multiply instead, so the ambient floor survives any
  // Brightness > 0 — same fix shape as axial_flow.js. Brightness == 0
  // still means fully off.
  v = v * v * brightness
  if (brightness > 0) v = max(v, 0.045)

  paint(pos, v)
}

// 2D — RE-PARAMETERIZED, not sliced (see header): theta from
// atan2(y-0.5, x-0.5) around the panel center, depth from radial
// distance (center = top pole, edge = bottom pole). Same math as
// render3D from seedN onward, with the panel-derived coordinates.
export function render2D(index, x, y) {
  var dx = x - 0.5
  var dy = y - 0.5
  var theta = atan2(dy, dx)
  var r = sqrt(dx * dx + dy * dy)
  if (r > 0.5) r = 0.5
  var depth = 2 * r
  var seedStatic = depth * seedDensity

  var seedN = seedStatic * densityPulse

  var effSharp = ridgeSharpness * (0.45 + 0.9 * breathRidge)

  var angleA = mod(seedN * GA + tRotateA + PI, PI2) - PI
  var dA = abs(theta - angleA)
  if (dA > PI) dA = PI2 - dA
  var ridgeA = 1 / (1 + dA * dA * effSharp)

  var angleB = mod(seedN * GA - tRotateB + PI * INV_PHI + PI, PI2) - PI
  var dB = abs(theta - angleB)
  if (dB > PI) dB = PI2 - dB
  var ridgeB = 1 / (1 + dB * dB * effSharp * 0.7)

  var ridge = ridgeA + ridgeB - ridgeA * ridgeB

  // Wavefront A: rings expanding from the panel center (the "top pole").
  var distA = depth - tWaveA
  if (distA > 0.5) distA -= 1
  if (distA < -0.5) distA += 1
  var tailA = distA < 0 ? 7 : 3.5
  var waveA = 1 / (1 + distA * distA * tailA)

  // Wavefront B: counter-rings contracting from the edge.
  var distB = depth + tWaveB - 1
  if (distB > 0.5) distB -= 1
  if (distB < -0.5) distB += 1
  var waveB = 1 / (1 + distB * distB * 6)

  var wave = waveA + 0.55 * waveB
  if (wave > 1.1) wave = 1.1

  var v = baseGlow + (1 - baseGlow) * ridge * wave

  var pos = seedStatic * INV_PHI + theta * 0.1592 * INV_PHI + tDrift
  pos = pos - floor(pos)

  // See render3D for why the floor is re-clamped after the multiply.
  v = v * v * brightness
  if (brightness > 0) v = max(v, 0.045)

  paint(pos, v)
}

// 1D fallback — walk the pole axis (ember_drift.js convention, AGENTS.md).
export function render(index) {
  render3D(index, 0.5, index / pixelCount, 0.5)
}
