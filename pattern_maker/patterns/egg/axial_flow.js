/*
  Axial Flow 3D — tumbling axis, traveling rings, pole beacon,
                  hemisphere hue sweep

  What it is
  ----------
  A single traveling wave scrolls along one axis through the egg. The
  axis itself slowly tumbles in 3D, so the direction of flow keeps
  reorienting. A bright beacon sits at the + end of the axis and
  wanders across the surface as the axis turns.

  Why this is obviously 3D-mapped
  -------------------------------
  Three cues, all structurally aligned with the tumbling axis — none
  of which could be faked from a 2D surface parametrization for
  arbitrary axis orientations:

    1. A single unambiguous direction the rings are flowing.
    2. Closed-loop rings wrapping all the way around the egg — trace
       any ring over the back and it closes.
    3. Hemisphere hue sweep — each hemisphere maps its equator→pole
       span onto a full half of the palette, so the entire palette is
       visible across the egg at any moment, with a complementary-
       color jump at the equator ring.

  How it works (hot path is all mul/add — no divides, no sqrts)
  -------------------------------------------------------------
  - beforeRender builds the axis via spherical coords (4 sin/cos/frame).
  - Per LED:
    * psq = |P|² + 0.25 is a geometric constant per LED — cached on
      first sight so subsequent frames read it from an array.
    * proj = dot(centered_pos, axis).
    * Primary rings: wave(proj * bandFreq - wavePhase), quadratic gamma.
    * Beacon: with n a unit vector, |P - 0.5n|² = psq - proj, so the
      squared distance to the + pole is a single subtraction. Linear
      max(0, 1 - d²·k) falloff keeps everything divide-free.
    * Hue: hemisphere sweep — each hemisphere maps |proj| onto a full
      half of the palette, with +0.5 offset on the negative side for
      a sharp complementary jump at the equator. Plus slow drift.

  Palette crossfade is the same manager as hc_pat.js / gyroid.js.

  Sliders
  -------
  - Speed       — global rate (axis tumble + ring scroll).
  - Brightness  — output multiplier.
  - BandFreq    — number of rings visible across the egg (~3..12).
  - BeaconGlow  — beacon brightness (0 turns both beacons off).
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
var bandFreq = 6
var beaconGlow = 1.2

export function sliderSpeed(v)       { speed = 0.1 + v * 1.9 }      // 0.1 .. 2.0
export function sliderBrightness(v)  { brightness = v }
export function sliderBandFreq(v)    { bandFreq = 3 + v * 9 }       // 3 .. 12
export function sliderBeaconGlow(v)  { beaconGlow = v * 2 }         // 0 .. 2 (0 = off)

// Per-frame state
var nx, ny, nz           // axis direction (unit vector)
var wavePhase            // scrolling phase of the traveling rings
var paletteDrift         // slow hue drift along the palette

// Per-LED squared-distance-to-center cache. psq for each LED is a fixed
// geometric constant — computing it per frame wastes ~6 ops per pixel.
// Array defaults to zeros; render3D populates on first sight.
var psqCache = array(pixelCount)

export function beforeRender(delta) {
  setupPalette(delta)

  // Axis direction via spherical coordinates. Two incommensurate slow
  // rotations so the axis keeps reorienting without cycling.
  var a = time(0.45 / speed) * PI2   // azimuth, ~30s at speed=1
  var b = time(0.60 / speed) * PI2   // polar,   ~40s at speed=1
  var sb = sin(b), cb = cos(b)
  nx = sb * cos(a)
  ny = sb * sin(a)
  nz = cb

  // Rings scroll one band per ~4s at speed=1. wave() wraps naturally,
  // so the sawtooth phase has no visible reset.
  wavePhase = time(0.06 / speed)

  // Slow hue drift across the palette.
  paletteDrift = time(1 / speed)
}

export function render3D(index, x, y, z) {
  // Per-LED geometric constant: psq = |P|² + 0.25, cached on first
  // sight. After the first frame this is just an array read.
  var psq = psqCache[index]
  if (!psq) {
    var dx = x - 0.5, dy = y - 0.5, dz = z - 0.5
    psq = dx * dx + dy * dy + dz * dz + 0.25
    psqCache[index] = psq
  }

  // Signed depth along the axis. Level sets of this are parallel planes;
  // their intersections with the egg are the closed-loop rings you see.
  var proj = (x - 0.5) * nx + (y - 0.5) * ny + (z - 0.5) * nz
  var ad = abs(proj)

  // Primary traveling rings along the axis.
  var ring = wave(proj * bandFreq - wavePhase)
  ring = ring * ring

  // Pole beacon at (center + 0.5 * n). With n a unit vector,
  //   |P - 0.5n|² = |P|² - proj + 0.25 = psq - proj
  // Linear max(0, 1 - d²·k) falloff, no divides.
  var bdSq = psq - proj
  var beacon = beaconGlow * max(0, 1 - bdSq * 10)

  // Colored floor: rings and beacon both fall to true 0 between bands,
  // so keep a low always-on glow rather than dropping to (0,0,0).
  var v = 0.05 + 0.95 * min(ring + beacon, 1)

  // Hemisphere hue sweep — each hemisphere maps equator→pole onto a
  // full half of the palette, so the whole palette is visible across
  // the egg at any moment. The +0.5 offset on the negative hemisphere
  // produces a sharp complementary-color jump at the equator ring.
  var h = (proj > 0 ? 0 : 0.5) + ad + paletteDrift

  // v's 0.05 floor above only guarantees a colored ambient glow at
  // Brightness=1 — multiplying by `brightness` scales that floor right
  // back down with it, so at low slider settings the effective floor can
  // drop under the ~0.04 hard-zero deadband and undo the whole point of
  // having one (color-craft.md "Background is a color decision"). Re-clamp
  // after the multiply, but only while the pattern is actually on, so
  // Brightness=0 still means fully off rather than a phantom glow.
  var vOut = v * brightness
  if (brightness > 0) vOut = max(vOut, 0.045)

  paint(h, vOut)
}

// 2D fallback: slice at z == 0. In 2D the axis collapses to a plane
// orientation — still a clean rolling-stripe pattern. Caveat: the pole
// beacon lives off this flat slice whenever the tumbling axis tilts
// toward/away from z, so it can pop in and out of the panel as the
// axis turns rather than staying continuously visible.
export function render2D(index, x, y) {
  render3D(index, x, y, 0)
}

// 1D fallback: walk the strip along x through the egg's midline so the
// editor preview stays alive.
export function render(index) {
  render3D(index, index / pixelCount, 0.5, 0.5)
}
