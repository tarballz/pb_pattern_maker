/*
  Fibonacci Bloom — a rotating Fibonacci-spiral sunflower on the egg

  The Fibonacci spirals are drawn directly as colored ridges — two
  families superimposed and counter-rotating:

    8-family: 8 clockwise spirals (F₆). Slope +1.225 rad/depth, swept
              ~70° pole-to-pole. Each arm gets its own palette slice,
              so all 8 arms are simultaneously visible as 8 distinct
              hues around the egg.

    13-family: 13 counter-clockwise spirals (F₇). Slope −0.466 rad/
              depth, ~27° sweep. Finer, painted in its own palette
              offset — 13 more distinct hues.

  Combined, 104 migrating intersection nodes bloom where a bright 8-arm
  crosses a bright 13-arm. Because the two families rotate counter to
  each other at different rates, the node pattern evolves continuously
  — nothing cycles fast enough to flicker.

  Macro breath: each family's amplitude independently waxes and wanes
  over ~50s and ~70s (out of phase), so the dominant spiral family
  trades places over the course of a minute. Sometimes 8 thick spirals
  rule; sometimes the 13 finer ones; sometimes a mixed grid.

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
// PATTERN — visible Fibonacci spiral arms
// ============================================================
//
// Two counter-rotating spiral-arm families painted directly as colored
// ridges — not hidden geometry with dim dots on top. Each family draws
// on the golden-angle phyllotaxis math (seeds 8-apart and 13-apart are
// the angularly-nearest seed neighbors, so their arms are the
// Fibonacci spirals you see in sunflowers):
//
//   F₆ family: 8 clockwise spirals, slope  +1.225 rad/depth (~70° sweep
//              top-to-bottom). Derived from 8·GA mod 2π = 0.35 rad over
//              arm-step depth 8/28 = 0.286.
//   F₇ family: 13 counter-clockwise spirals, slope −0.466 rad/depth
//              (~27° sweep). Derived from (13·GA mod 2π)'s shortest arc
//              = −0.216 rad over arm-step depth 13/28 = 0.464.
//
// Visual richness comes from painting each ARM its own palette slice:
// going once around the egg at any depth, you sweep a full palette
// cycle (8 distinct colors for the 8-family, 13 for the 13-family).
// Counter-rotation + slow macro amplitude breath on each family keeps
// the pattern evolving without any single LED cycling fast.

var GA = PI * (3 - sqrt(5))   // 2.39996 rad ≈ 137.507°

var SLOPE8 = 1.225       // F₆ arm tilt (rad per unit depth)
var SLOPE13 = -0.466     // F₇ arm tilt, counter direction
var ARMS8 = 8
var ARMS13 = 13
var SECT8 = PI2 / 8      // angular width of one 8-family sector
var SECT13 = PI2 / 13

// Baseline glow — small, so the arm colors pop.
var baseGlow = 0.05

// Sliders.
var speed = 1
var brightness = 1
var armSharpness = 45    // higher = crisp line arms, lower = fat ribbons

export function sliderSpeed(v) { speed = 0.3 + v * 2.4 }
export function sliderBrightness(v) { brightness = 0.3 + v * 0.7 }
export function sliderArmSharpness(v) { armSharpness = 15 + v * 120 }

// Per-LED azimuth cache (fixed geometry).
var thetaCache = array(pixelCount)
for (i = 0; i < pixelCount; i++) thetaCache[i] = -999

// Frame state:
//   rot8, rot13   — arm-family rotation phases, counter-directional
//   amp8, amp13   — macro amplitude breath (0.35..1.0) on each family,
//                   periods ~50s and ~70s, offset so sometimes 8-family
//                   dominates and sometimes 13-family does
//   tDrift        — slow global palette-position drift
var rot8 = 0
var rot13 = 0
var amp8 = 1
var amp13 = 1
var tDrift = 0

export function beforeRender(delta) {
  setupPalette(delta)
  var sp = speed

  // Counter-rotating spirals at different periods — intersection nodes
  // between the two families migrate continuously, never synchronize.
  rot8 = time(0.38 / sp) * PI2            // ~25s, CW
  rot13 = -time(0.54 / sp) * PI2          // ~35s, CCW

  // Macro amplitude breathing — slow waxing/waning of each family's
  // visibility, out of phase. The two families trade dominance over
  // ~1 minute: sometimes 8 thick spirals rule the egg, sometimes the
  // 13 finer ones, sometimes a mixed grid.
  amp8 = 0.35 + 0.65 * wave(time(0.77 / sp))           // ~50s
  amp13 = 0.35 + 0.65 * wave(time(1.06 / sp) + 0.5)    // ~70s, π-offset

  // Slow palette-position drift (~33s).
  tDrift = time(0.50 / sp)
}

export function render3D(index, x, y, z) {
  var theta = thetaCache[index]
  if (theta < -500) {
    theta = atan2(z - 0.5, x - 0.5)
    thetaCache[index] = theta
  }

  var depth = 1 - y

  // --- F₆ (8-arm) family ---
  // phase8 varies smoothly with theta (range 2π per revolution).
  // Fold into one sector [−SECT8/2, +SECT8/2) to find shortest distance
  // to the nearest arm center. Every sector is identical geometry →
  // 8 arms appear.
  var phase8 = theta - SLOPE8 * depth - rot8
  var fold8 = mod(phase8 + SECT8 * 0.5, SECT8) - SECT8 * 0.5
  var arm8 = amp8 / (1 + fold8 * fold8 * armSharpness)

  // --- F₇ (13-arm) family ---
  // 1.5× sharpness on the 13-family — its arms are closer together
  // (smaller sectors), so narrower arms keep them distinct.
  var phase13 = theta - SLOPE13 * depth - rot13
  var fold13 = mod(phase13 + SECT13 * 0.5, SECT13) - SECT13 * 0.5
  var arm13 = amp13 / (1 + fold13 * fold13 * armSharpness * 1.5)

  // Combine via probabilistic OR — arm crossings read bright without
  // clipping to white (both families contribute).
  var combined = arm8 + arm13 - arm8 * arm13

  // Pole fade: spiral projections degenerate at the poles, so gently
  // attenuate there. 4·y·(1−y) peaks at equator, zero at poles.
  var poleFade = 4 * y * (1 - y)

  var v = baseGlow + combined * (0.3 + 0.7 * poleFade)

  // Palette position — here's the color richness:
  //   phase8 · 1/(2π) maps radians → palette cycles. Across the 8 arms
  //   at one depth, we sweep the palette ONCE (each arm gets 1/8 of
  //   the palette = 8 distinct hues simultaneously visible).
  //   13-family uses its own offset (+0.35) to distinguish its hues
  //   from the 8-family's.
  //   A little depth contribution (+0.12·depth) stratifies color
  //   pole-to-pole. tDrift rotates the whole mapping slowly.
  var pos
  if (arm8 * 1.5 > arm13) {
    pos = phase8 * 0.1591549 + depth * 0.12 + tDrift
  } else {
    pos = phase13 * 0.1591549 + depth * 0.12 + tDrift + 0.35
  }
  pos = pos - floor(pos)

  // Gamma + brightness.
  v = v * v * brightness

  // Dithering deadband — hard snap below the PWM threshold to
  // prevent per-pixel flicker on dark troughs.
  if (v < 0.04) v = 0

  paint(pos, v)
}

export function render2D(index, x, y) {
  render3D(index, x, y, 0.5)
}
