/*
  Fibonacci Bloom — a Fibonacci-spiral sunflower on the egg

  Every structural AND temporal constant in this pattern derives from
  the golden angle, the Fibonacci sequence, or φ. Nothing is tuned by
  taste — the visual is what the math produces.

  ── Geometry (forced by GA = π(3−√5) = 137.507°) ──

    8-family  (F₆): 8 clockwise spirals. Slope +1.225 rad/depth, swept
                    ~70° pole-to-pole. SLOPE8 = (8·GA mod 2π) / (8/28).

    13-family (F₇): 13 counter-clockwise spirals. Slope −0.466 rad/depth,
                    ~27° sweep. SLOPE13 = (13·GA mod 2π shortest) / (13/28).

    The arm counts 8 and 13 aren't chosen — they're the Fibonacci pair
    that falls out of phyllotaxis at this density. The slopes aren't
    tunable — they're the angular step of those Fibonacci seed-neighbors
    divided by their depth step. Both families are painted as colored
    ridges directly, so you see the Fibonacci spirals, not just hint
    at them through dots.

  ── Timing (Fibonacci seconds in φ ratio) ──

    rot8     21s  = F₈     (clockwise rotation)
    rot13    34s  = F₉     (counter-clockwise)          34/21 = 1.619 ≈ φ
    amp8     55s  = F₁₀    (8-family amplitude breath)
    amp13    89s  = F₁₁    (13-family, π-offset)        89/55 = 1.618 = φ
    tDrift   34s  = F₉     (palette drift, decoupled phase)

    Every ratio between time periods is φ. Since φ is irrational, no
    two elements ever re-sync — the pattern never returns to a previous
    state. This is why the visual evolves continuously without looping.

  ── Color coupling ──

    Each arm occupies 1/N of the palette ring (1/8 for 8-family, 1/13
    for 13-family). Going once around the egg sweeps the full palette
    once per family — so 8 and 13 distinct hues are simultaneously
    visible.

    The 13-family is offset by φ⁻¹ = 0.618 on the palette ring — the
    most irrational offset possible, so its 13 hues never collide with
    the 8-family's 8 hues as rotations advance.

    Depth-to-hue stratification is φ⁻² = 0.382, slightly enriching the
    pole-to-pole color gradient.

  ── What you see ──

    Counter-rotating Fibonacci spirals of two families bloom with up to
    104 migrating intersection nodes (8 × 13 = 104 crossings per revo-
    lution). Each family's visibility waxes and wanes slowly, trading
    dominance over the course of a minute. All motion is continuous and
    slow — no single LED changes brightness fast enough to flicker.

  Palette cycles through 4 cosmic moods (emission nebula → galactic core
  → deep-space → starlight) with 30s cross-fades per slot.

  Sliders:
    Speed          — overall animation rate
    Brightness     — global output scale
    ArmSharpness   — line thickness (low = fat ribbons, high = crisp arms)
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
// See the top-of-file docstring for the full geometry / timing /
// color derivation. This section is just the constants and code.

// Golden angle + φ. Derivations rather than hardcoded numerics so it's
// obvious these aren't free parameters.
var GA = PI * (3 - sqrt(5))          // 2.39996 rad = 137.507°  (golden angle)
var PHI = (1 + sqrt(5)) * 0.5        // 1.618034                (golden ratio)
var INV_PHI = 2 / (1 + sqrt(5))      // 0.618034                (φ⁻¹)

// Arm counts — consecutive Fibonacci (F₆, F₇). Slopes follow from GA:
//   SLOPEk = (k·GA mod 2π, shortest arc) / (k/density)
// so they're forced by GA at density 28, not free parameters.
var ARMS8 = 8
var ARMS13 = 13
var SLOPE8 = 1.225       // F₆ arm tilt (rad per unit depth)
var SLOPE13 = -0.466     // F₇ arm tilt, counter direction
var SECT8 = PI2 / 8      // one 8-family sector width
var SECT13 = PI2 / 13    // one 13-family sector width

// Small baseline so the arm colors pop without being pitch-black between arms.
var baseGlow = 0.05

var speed = 1
var brightness = 1
var armSharpness = 45    // higher = crisp line arms, lower = fat ribbons

export function sliderSpeed(v) { speed = 0.3 + v * 2.4 }
export function sliderBrightness(v) { brightness = 0.3 + v * 0.7 }
export function sliderArmSharpness(v) { armSharpness = 15 + v * 120 }

// Per-LED azimuth cache. theta = atan2(z-0.5, x-0.5) is fixed per LED;
// caching avoids ~1352 atan2 calls per frame. Sentinel -999 means
// "not yet primed" (real thetas are in [-PI, PI]).
var thetaCache = array(pixelCount)
for (i = 0; i < pixelCount; i++) thetaCache[i] = -999

// Frame state (see docstring for full period table):
//   rot8, rot13 — rotation phases: 21s CW (F₈), 34s CCW (F₉).
//   amp8, amp13 — macro amplitude breath: 55s (F₁₀) and 89s (F₁₁), π-offset.
//   tDrift      — palette drift, 34s (F₉).
var rot8 = 0
var rot13 = 0
var amp8 = 1
var amp13 = 1
var tDrift = 0

export function beforeRender(delta) {
  setupPalette(delta)
  var sp = speed

  // All periods are Fibonacci seconds; every ratio is φ (so no two
  // elements ever resynchronize). time() arg × 65.536 ≈ period in seconds.
  rot8  =  time(0.3204 / sp) * PI2                       // 21s CW   (F₈)
  rot13 = -time(0.5188 / sp) * PI2                       // 34s CCW  (F₉)
  amp8  = 0.35 + 0.65 * wave(time(0.8393 / sp))          // 55s      (F₁₀)
  amp13 = 0.35 + 0.65 * wave(time(1.3580 / sp) + 0.5)    // 89s      (F₁₁), π-offset
  tDrift = time(0.5188 / sp)                             // 34s      (F₉)
}

export function render3D(index, x, y, z) {
  var theta = thetaCache[index]
  if (theta < -500) {
    theta = atan2(z - 0.5, x - 0.5)
    thetaCache[index] = theta
  }

  var depth = 1 - y

  // For each family: compute phase at this (theta, depth), fold into one
  // sector to get shortest distance to the nearest arm center, apply a
  // rational falloff. Sector width = 2π/N → N identical arms tile the egg.
  var phase8 = theta - SLOPE8 * depth - rot8
  var fold8 = mod(phase8 + SECT8 * 0.5, SECT8) - SECT8 * 0.5
  var arm8 = amp8 / (1 + fold8 * fold8 * armSharpness)

  // 13-family gets 1.5× sharpness — its sectors are smaller (2π/13 vs
  // 2π/8), so narrower arms keep the 13 lines visually distinct.
  var phase13 = theta - SLOPE13 * depth - rot13
  var fold13 = mod(phase13 + SECT13 * 0.5, SECT13) - SECT13 * 0.5
  var arm13 = amp13 / (1 + fold13 * fold13 * armSharpness * 1.5)

  // Probabilistic OR — arm crossings bloom brightly without clipping.
  var combined = arm8 + arm13 - arm8 * arm13

  // Spiral projection degenerates at the poles (LEDs are sparse there
  // and arms all converge). Gently fade. 4·y·(1−y) peaks at equator.
  var poleFade = 4 * y * (1 - y)
  var v = baseGlow + combined * (0.3 + 0.7 * poleFade)

  // Palette position: phase · 1/(2π) maps radians → palette cycles, so
  // one revolution around the egg sweeps the full palette once per
  // family (8 or 13 simultaneously-visible hues). Winner-take-all by
  // family. 13-family offset by φ⁻¹ (the "most irrational" ring
  // offset — its hues never coincide with the 8-family's). Depth adds
  // φ⁻² (0.382) stratification. tDrift rotates the whole mapping.
  var pos
  if (arm8 * 1.5 > arm13) {
    pos = phase8 * 0.1591549 + depth * 0.382 + tDrift
  } else {
    pos = phase13 * 0.1591549 + depth * 0.382 + tDrift + INV_PHI
  }
  pos = pos - floor(pos)

  // Gamma + brightness, then PWM-dithering deadband to kill low-v flicker.
  v = v * v * brightness
  if (v < 0.04) v = 0

  paint(pos, v)
}

export function render2D(index, x, y) {
  render3D(index, x, y, 0.5)
}
