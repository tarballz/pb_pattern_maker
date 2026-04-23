/*
  Fibonacci Dream — trippy kin of fibonacci_bloom

  Same Fibonacci/phyllotaxis skeleton as fibonacci_bloom.js (8 & 13
  golden-angle spirals, φ-ratio timing), with three added layers that
  make it more psychedelic without breaking the math:

    1. Golden-angle theta warp — a 3-lobed wave() perturbs the
       angular coordinate BEFORE the spiral math runs. Wobble phase
       rotates on F₁₃ (233s). Arms breathe in and out laterally
       like they're painted on a slowly-sloshing liquid.

    2. Depth wobble — y gets a small bow that travels around the
       egg on F₁₂ (144s). Spirals undulate pole-to-pole.

    3. Crossing-node bloom — where an 8-arm meets a 13-arm
       (arm8 * arm13 is high), a shimmer on F₇ (13s) lights up the
       104 intersections as floating seed-points.

    4. Iridescent hue wobble — palette position gets a small
       depth-and-time dependent jiggle so the color never sits
       still even when the arms do.

  All extra time periods are still Fibonacci seconds, so every ratio
  in the stack remains φ — nothing re-syncs, ever.

  Sliders:
    Speed          — overall animation rate
    Brightness     — global output scale
    ArmSharpness   — line thickness (low = fat ribbons, high = crisp arms)
    WarpAmount     — how much the theta warp twists the spirals
*/

// ============================================================
// PALETTES — 4-slot cosmic progression
// ============================================================

//https://phillips.shef.ac.uk/pub/cpt-city/pj/4/vibrant
//white-teal-yellow-red-magenta-blue-black
var vibrant_gp = [
    0, 255,255,255,
   31,   3,197,108,
   71, 245,251, 77,
  120, 255, 15, 66,
  166, 225,  1,233,
  214,  51, 94,253,
  255,   0,  0,  0]
arrayMutate(vibrant_gp,(v, i ,a) => v / 255);

//https://phillips.shef.ac.uk/pub/cpt-city/nd/basic/BlacK_Blue_Magenta_White
//black-navy-blue-purple-magenta-pink-white
var BlacK_Blue_Magenta_White_gp = [
    0,   0,  0,  0,
   43,   0,  0,128,
   85,   0,  0,255,
  127, 128,  0,255,
  170, 255,  0,255,
  212, 255,128,255,
  255, 255,255,255]
arrayMutate(BlacK_Blue_Magenta_White_gp,(v, i ,a) => v / 255);

//https://phillips.shef.ac.uk/pub/cpt-city/nd/terra/Tertiary_04a
//lime-teal-navy-purple-red
var Tertiary_04a_gp = [
    0,  87,217,  0,
   64,  43,115, 70,
  127,   0, 14,140,
  191, 108, 18, 91,
  255, 217, 22, 43]
arrayMutate(Tertiary_04a_gp,(v, i ,a) => v / 255);

//https://phillips.shef.ac.uk/pub/cpt-city/jjg/misc/virus
//black-navy-teal-green-brown-red-orange-yellow
var virus_gp = [
    0,   0,  0,  6,
   32,   0, 13, 75,
   64,   0,100,100,
   96,   0,148, 42,
  127, 112,103,  0,
  159, 207, 35,  0,
  191, 224,112,  0,
  223, 239,179,  0,
  255, 254,250,  0]
arrayMutate(virus_gp,(v, i ,a) => v / 255);

var palettes = [vibrant_gp, BlacK_Blue_Magenta_White_gp, Tertiary_04a_gp, virus_gp]

// ============================================================
// PALETTE MANAGER (same as fibonacci_bloom)
// ============================================================

var PALETTE_HOLD_TIME = 20
var PALETTE_TRANSITION_TIME = 10

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
// PATTERN CONSTANTS
// ============================================================

var GA = PI * (3 - sqrt(5))          // golden angle (rad)
var PHI = (1 + sqrt(5)) * 0.5        // φ
var INV_PHI = 2 / (1 + sqrt(5))      // φ⁻¹ = 0.618...
var INV_PI2 = 1 / PI2                // radians → cycles
var INV_TWO_PI = INV_PI2             // alias

// Arm geometry (identical to fibonacci_bloom — forced by GA)
var ARMS8 = 8
var ARMS13 = 13
var SLOPE8 = 1.225
var SLOPE13 = -0.466
var SECT8 = PI2 / 8
var SECT13 = PI2 / 13

var baseGlow = 0.06

var speed = 1
var brightness = 1
var armSharpness = 45
var warpAmount = 1     // multiplier on the theta-warp term (user slider)

export function sliderSpeed(v)        { speed = 0.3 + v * 2.4 }
export function sliderBrightness(v)   { brightness = 0.3 + v * 0.7 }
export function sliderArmSharpness(v) { armSharpness = 15 + v * 120 }
export function sliderWarpAmount(v)   { warpAmount = 0.2 + v * 1.8 }

// Per-LED cache — atan2 is ~expensive, fix it once.
// Also cache a per-LED "warp carrier" offset so every egg looks slightly
// different but each LED is stable across frames.
var thetaCache = array(pixelCount)
for (i = 0; i < pixelCount; i++) thetaCache[i] = -999

// Frame state
//   rot8   21s CW   (F₈)
//   rot13  34s CCW  (F₉)
//   amp8   55s      (F₁₀)
//   amp13  89s      (F₁₁)
//   tDrift 34s      (F₉)
// Trippy additions (all Fibonacci-second periods):
//   warpPhase   233s (F₁₃) — θ-warp carrier
//   depthPhase  144s (F₁₂) — pole-to-pole wobble
//   nodeShimmer 13s  (F₇)  — brightness on the 104 crossings
//   huePulse    34s  (F₉)  — iridescence carrier (decoupled from tDrift)
//   palRetro    89s  (F₁₁) — palette counter-drift
var rot8 = 0
var rot13 = 0
var amp8 = 1
var amp13 = 1
var tDrift = 0
var warpPhase = 0
var depthPhase = 0
var nodeShimmer = 1
var huePulse = 0
var palRetro = 0

export function beforeRender(delta) {
  setupPalette(delta)
  var sp = speed

  rot8  =  time(0.3204 / sp) * PI2                       // 21s CW   (F₈)
  rot13 = -time(0.5188 / sp) * PI2                       // 34s CCW  (F₉)
  amp8  = 0.35 + 0.65 * wave(time(0.8393 / sp))          // 55s      (F₁₀)
  amp13 = 0.35 + 0.65 * wave(time(1.3580 / sp) + 0.5)    // 89s      (F₁₁), π-offset
  tDrift = time(0.5188 / sp)                             // 34s      (F₉)

  // trippy carriers
  warpPhase   = time(3.5553 / sp)                        // 233s     (F₁₃)
  depthPhase  = time(2.1973 / sp)                        // 144s     (F₁₂)
  nodeShimmer = 0.55 + 0.45 * wave(time(0.1984 / sp))    // 13s      (F₇)
  huePulse    = time(0.5188 / sp) + 0.37                 // 34s F₉, offset from tDrift
  palRetro    = -time(1.3580 / sp)                       // 89s backward (F₁₁)
}

export function render3D(index, x, y, z) {
  var theta = thetaCache[index]
  if (theta < -500) {
    theta = atan2(z - 0.5, x - 0.5)
    thetaCache[index] = theta
  }

  var depth = 1 - y

  // ─── Golden-angle theta warp ────────────────────────────────
  // wave() is a cheap LUT. 3-lobed carrier around the egg; its phase
  // drifts on F₁₃. Amplitude = 0.22·warpAmount rad (~13° max) so the
  // spiral lattice stays recognizable while constantly re-flowing.
  var warpCarrier = theta * 0.4775 + warpPhase             // 3 * θ/2π + φ(t)
  var thetaWarp = (wave(warpCarrier) - 0.5) * 0.22 * warpAmount
  var thetaW = theta + thetaWarp

  // ─── Depth wobble ──────────────────────────────────────────
  // A small, theta-dependent bow on y. Max ±0.04 so the arms undulate
  // pole-to-pole without pixels ever moving to a point that isn't
  // physically covered.
  var depthWobble = (wave(theta * INV_PI2 + depthPhase) - 0.5) * 0.08
  var depthW = depth + depthWobble

  // ─── Two-family spiral field (same math as bloom) ──────────
  var phase8 = thetaW - SLOPE8 * depthW - rot8
  var fold8 = mod(phase8 + SECT8 * 0.5, SECT8) - SECT8 * 0.5
  var arm8 = amp8 / (1 + fold8 * fold8 * armSharpness)

  var phase13 = thetaW - SLOPE13 * depthW - rot13
  var fold13 = mod(phase13 + SECT13 * 0.5, SECT13) - SECT13 * 0.5
  var arm13 = amp13 / (1 + fold13 * fold13 * armSharpness * 1.5)

  // Probabilistic-OR combine + crossing bloom.
  // cross peaks only where both arms are near their centers — that's
  // the 104 phyllotaxis seed-points. Square it so the bloom is tight,
  // then shimmer it on F₇.
  var combined = arm8 + arm13 - arm8 * arm13
  var cross = arm8 * arm13                                 // ∈ [0, ~1]
  var bloom = cross * cross * 3.0 * nodeShimmer

  // Pole fade (spiral math degenerates at poles)
  var poleFade = 4 * y * (1 - y)
  var v = baseGlow + (combined + bloom) * (0.3 + 0.7 * poleFade)

  // ─── Color ────────────────────────────────────────────────
  // Winner-take-all by family, with an iridescent wobble so the hue
  // never sits even on a static arm. palRetro pushes the whole ring
  // backwards on F₁₁ — two palette rotations (tDrift forward at F₉,
  // palRetro backward at F₁₁) with a φ ratio between them.
  var pos
  if (arm8 * 1.5 > arm13) {
    pos = phase8 * 0.1591549 + depthW * 0.382 + tDrift
  } else {
    pos = phase13 * 0.1591549 + depthW * 0.382 + tDrift + INV_PHI
  }
  // iridescence: a small depth+time hue jiggle (±0.04 of the palette ring)
  pos = pos + 0.08 * (wave(depthW * 0.5 + huePulse) - 0.5) + palRetro * 0.15
  pos = pos - floor(pos)

  // Gamma + brightness, deadband to kill low-v flicker
  v = v * v * brightness
  if (v < 0.04) v = 0

  paint(pos, v)
}

export function render2D(index, x, y) {
  render3D(index, x, y, 0.5)
}
