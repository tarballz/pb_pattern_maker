/*
  Slicer 3D — tumbling plane with wake ripples

  What it is
  ----------
  A single plane passes through the center of the egg. Its normal vector
  tumbles slowly in 3D, so the plane continuously changes orientation.
  Where the plane meets the LEDs (signed distance ≈ 0), a bright ring
  lights up on the surface. Out from the plane in both directions,
  concentric ripples propagate outward like a shockwave.

  What's unique about it
  ----------------------
  This is about as visually "3D" as a pattern can be on a closed surface:

    - You see a bright ring that is literally the intersection of a 3D
      plane with the egg. Because the egg is ovoid (not spherical), the
      ring's shape *morphs* as the plane rotates — sometimes a narrow
      loop around the long axis, sometimes a wide oval across the belly.
      That shape change is only possible if the LEDs actually have real
      (x,y,z) positions.
    - The ring tumbles: you can watch the plane's orientation change in
      3D, pivoting around axes you can point to.
    - The wake ripples flow *outward perpendicular to the plane*, in a
      direction that visibly rotates with the plane. At any moment you
      can see "the ripples are flowing this way right now."
    - The two halves of the egg (on each side of the plane) take
      different hues from the palette, so you see a sharp color
      discontinuity that sweeps around as the plane tumbles.

  How it works
  ------------
  - beforeRender picks a plane normal by spherical coords with two slowly
    drifting angles. Four sin/cos per frame — fine.
  - Per LED: signed distance from the plane through the egg center is a
    single dot product (3 mul + 3 add). abs(d) → ring + wake math.
  - Ring: linear falloff within `ringThickness`, quadratic gamma for a
    sharp bright band.
  - Wake: `wave(|d| * rippleFreq - ripplePhase)` makes outward-traveling
    shells. A linear fade with |d| keeps far ripples from overpowering
    the ring.
  - Hue: positive side of the plane uses h1, negative side uses h2
    (opposite palette positions), plus a small drift with |d| for a
    gradient into the shell colors. Palette positions are wrapped into
    [0,1) before paint() (house convention).
  - Between the ring and the wake crests the egg goes dark on purpose —
    the black gap is intentional negative space that keeps the ring and
    ripples readable, not a missing ambient floor.

  2D strategy: RE-PARAMETERIZE (2d-parity.md strategy c). render2D drives
  the same ring + wake math with a signed distance from a 2D-native
  rotating line in the panel's own plane. The old z=0 slice reused the 3D
  normal, which went degenerate whenever the tumble pointed near ±z
  (nx,ny → 0 made d near-constant, flattening the whole panel); the 2D
  direction (n2x, n2y) is always unit-length, so the line never collapses.

  Palette crossfade is the same manager as hc_pat.js / gyroid.js.

  Sliders
  -------
  - Speed         — global animation rate (tumble + ripple propagation).
  - Brightness    — output multiplier.
  - RingThickness — width of the bright ring at the plane.
  - RippleFreq    — number of concentric wake shells visible.
  Trigger: IncrementPalette — jump to the next palette, skipping the fade.
*/

////////////////////////////////
// START PALETTE STUFF
////////////////////////////////

//teal to purple
var bhw1_05_gp = [
    0,   1,221, 53,
  255,  73,  3,178]
arrayMutate(bhw1_05_gp,(v, i ,a) => v / 255);

//yellow-orange-purple-navy
var bhw1_04_gp = [
    0, 229,227,  1,
   15, 227,101,  3,
  142,  40,  1, 80,
  198,  17,  1, 79,
  255,   0,  0, 45]
arrayMutate(bhw1_04_gp,(v, i ,a) => v / 255);

//red-orange-pink-purple-blue
var Sunset_Real_gp = [
    0, 120,  0,  0,
   22, 179, 22,  0,
   51, 255,104,  0,
   85, 167, 22, 18,
  135, 100,  0,103,
  198,  16,  0,130,
  255,   0,  0,160]
arrayMutate(Sunset_Real_gp,(v, i ,a) => v / 255);

//purple pink red
var Analogous_3_gp = [
    0,  67, 55,255,
   63,  74, 25,255,
  127,  83,  7,255,
  191, 153,  1, 45,
  255, 255,  0,  0]
arrayMutate(Analogous_3_gp,(v, i ,a) => v / 255);

//blue-purple-red
var Analogous_1_gp = [
    0,   3,  0,255,
   63,  23,  0,255,
  127,  67,  0,255,
  191, 142,  0, 45,
  255, 255,  0,  0]
arrayMutate(Analogous_1_gp,(v, i ,a) => v / 255);

//black-blue-magenta-white
var black_Blue_Magenta_White_gp = [
    0,   0,  0,  0,
   42,   0,  0, 45,
   84,   0,  0,255,
  127,  42,  0,255,
  170, 255,  0,255,
  212, 255, 55,255,
  255, 255,255,255]
arrayMutate(black_Blue_Magenta_White_gp,(v, i ,a) => v / 255);

var palettes = [bhw1_05_gp, bhw1_04_gp, Sunset_Real_gp, Analogous_3_gp,
                Analogous_1_gp, black_Blue_Magenta_White_gp]

var PALETTE_HOLD_TIME = 12
var PALETTE_TRANSITION_TIME = 4

export var currentIndex = 0
var nextIndex = (currentIndex + 1) % palettes.length

export function triggerIncrementPalette() {
  currentIndex = (currentIndex + 1) % palettes.length
}

var pixel1 = array(3)
var pixel2 = array(3)

var PALETTE_SIZE = 16
var currentPalette = array(4 * PALETTE_SIZE)

var inTransition = 0
var blendValue = 0
runTime = 0

setPalette(currentPalette)
buildBlendedPalette(palettes[currentIndex], palettes[nextIndex], blendValue)

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

////////////////////////////////
// END PALETTE STUFF
////////////////////////////////


// Pattern controls
var speed = 0.5
var brightness = 1
var ringThickness = 0.08
var rippleFreq = 8

export function sliderSpeed(v)          { speed = 0.1 + v * 1.9 }         // 0.1 .. 2.0
export function sliderBrightness(v)     { brightness = v }
export function sliderRingThickness(v)  { ringThickness = 0.02 + v * 0.2 } // 0.02 .. 0.22
export function sliderRippleFreq(v)     { rippleFreq = 3 + v * 15 }        // 3 .. 18

// Per-frame state
var nx, ny, nz          // plane normal
var n2x, n2y            // 2D-native line direction for render2D (always unit)
var ripplePhase         // expanding-shell phase
var h1, h2              // hue offsets for each side of the plane
var invRingThickness    // cached 1/ringThickness for render

export function beforeRender(delta) {
  setupPalette(delta)

  // Tumbling plane normal via spherical coordinates. Two incommensurate
  // slow rotations so the plane keeps reorienting without cycling.
  var a = time(0.35 / speed) * PI2   // ~23s at speed=1
  var b = time(0.27 / speed) * PI2   // ~18s at speed=1
  var sa = sin(a), ca = cos(a)
  var sb = sin(b), cb = cos(b)
  nx = sa * cb
  ny = sa * sb
  nz = ca

  // Re-parameterized 2D line direction (audit: intermittent depth collapse).
  // Reuses the slow `a` rotation but stays in the panel plane, so unlike
  // (nx, ny) — which shrink toward zero when the 3D normal tumbles near ±z —
  // this vector is always unit-length and the 2D line never degenerates.
  n2x = ca
  n2y = sa

  // Wake ripples propagating outward from the plane. wave() wraps naturally,
  // so the sawtooth phase has no visible reset.
  ripplePhase = time(0.04 / speed) // ~2.6s period at speed=1

  // Hue offsets — opposite sides of the palette, slowly drifting as a whole.
  h1 = time(0.7 / speed)
  h2 = h1 + 0.5

  invRingThickness = 1 / ringThickness
}

// Shared per-pixel body for render3D/render2D (audit fix: refactored out of
// render3D unchanged). d is the signed distance from the tumbling plane (3D)
// or the rotating line (2D) through the center.
function renderSlice(d) {
  var ad = abs(d)

  // Bright ring where the plane meets the surface. Linear falloff within
  // ringThickness, then quadratic gamma for a sharp bright band.
  var ring = max(0, 1 - ad * invRingThickness)
  ring = ring * ring

  // Wake ripples on both sides of the plane. Linear fade with distance so
  // far ripples don't compete with the ring for attention.
  var ripple = wave(ad * rippleFreq - ripplePhase)
  ripple = ripple * ripple * (1 - min(ad * 2, 1))

  // Sharp color split across the plane, with a subtle hue drift outward so
  // each half has a gradient from the ring into the wake ripples.
  // Wrapped into [0,1) before paint() (audit: unwrapped palette position).
  var h = (d > 0 ? h1 : h2) + ad * 0.2
  h = h - floor(h)

  var v = min(ring + ripple * 0.6, 1)

  paint(h, v * brightness)
}

export function render3D(index, x, y, z) {
  // Signed distance from the tumbling plane through the egg's center.
  renderSlice((x - 0.5) * nx + (y - 0.5) * ny + (z - 0.5) * nz)
}

// 2D strategy: re-parameterize (2d-parity.md strategy c) — the same ring +
// wake math driven by a 2D-native rotating line. The old z=0 slice went flat
// whenever the tumbling 3D normal pointed near ±z (nx,ny → 0 made d
// near-constant across the panel); (n2x, n2y) is always unit-length, so the
// line always has structure.
export function render2D(index, x, y) {
  renderSlice((x - 0.5) * n2x + (y - 0.5) * n2y)
}

// 1D fallback: project the strip across the x axis through the egg's midline.
export function render(index) {
  render3D(index, index / pixelCount, 0.5, 0.5)
}
