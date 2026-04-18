/*
  Pulsars 3D — orbiting light sources with expanding shells

  What it is
  ----------
  Two bright point sources orbit through the interior of the egg along
  incommensurate 3D Lissajous paths. Each source illuminates nearby LEDs
  as a moving "core glow", and emits expanding spherical shells of light
  that propagate outward through the volume.

  What's unique about it
  ----------------------
  This is the clearest possible demo that the LEDs know their 3D position:

    - You can visually track each source as a bright spot sliding around
      the egg — not just side-to-side, but front-to-back and top-to-bottom
      too. The orbit is unambiguously 3D; you couldn't fake it by painting
      on a 2D surface.
    - The pulses are *spherical* shells. A new shell appears as a ring
      that grows outward in every direction at once and wraps around the
      egg, which only makes sense if the LED positions really do form a
      3D object.
    - The two sources use opposite sides of the palette, so as they pass
      each other their colors overlap and trade dominance — another cue
      that you're looking at two bodies moving through a volume, not a
      single pattern painted onto a surface.

  How it works
  ------------
  - In beforeRender, each source's (x,y,z) is computed once per frame from
    wave() over incommensurate periods per axis, clamped to [0.2, 0.8] so
    the sources stay comfortably inside the egg.
  - Per LED, hypot3 gives the distance to each source.
  - Core glow uses inverse-quadratic falloff (`coreGlow / (d*d*k + 1)`),
    which peaks at the source and decays smoothly.
  - Shells are produced by `wave(d * shellDensity - shellPhase)`: a
    traveling wave in distance-space. As shellPhase advances, the wave
    crests — the "shells" — move outward at constant speed. A distance
    fade dims far-away shells so fresh pulses near the source read
    strongest.
  - Each source has its own slowly-drifting hue; whichever source
    contributes more brightness to an LED wins its hue. Additive total
    brightness, cubic gamma via `paint`.

  Palette crossfade is the same manager as hc_pat.js / gyroid.js.

  Sliders
  -------
  - Speed        — global animation rate (orbits + shell propagation).
  - Brightness   — output multiplier.
  - CoreGlow     — brightness of the source cores.
  - ShellDensity — how many concentric shells are visible at once.
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
var coreGlow = 1.0
var shellDensity = 6

export function sliderSpeed(v)        { speed = 0.1 + v * 1.9 }      // 0.1 .. 2.0
export function sliderBrightness(v)   { brightness = v }
export function sliderCoreGlow(v)     { coreGlow = 0.2 + v * 1.8 }   // 0.2 .. 2.0
export function sliderShellDensity(v) { shellDensity = 3 + v * 12 }  // 3 .. 15 shells

// Per-frame state
var x1, y1, z1, x2, y2, z2
var shellPhase, h1, h2

export function beforeRender(delta) {
  setupPalette(delta)

  // Two sources on incommensurate Lissajous paths, clamped to [0.2, 0.8]
  // so they stay inside the egg. Different periods per axis and per source
  // mean the orbits never line up, so motion never looks static.
  x1 = 0.2 + 0.6 * wave(time(0.17 / speed))
  y1 = 0.2 + 0.6 * wave(time(0.23 / speed))
  z1 = 0.2 + 0.6 * wave(time(0.19 / speed))

  x2 = 0.2 + 0.6 * wave(time(0.29 / speed) + 0.3)
  y2 = 0.2 + 0.6 * wave(time(0.31 / speed) + 0.5)
  z2 = 0.2 + 0.6 * wave(time(0.13 / speed) + 0.7)

  // Shell phase — advances continuously; wave() wraps naturally.
  // Period ~0.78s at speed=1; shells sweep outward at roughly 0.2 u/s.
  shellPhase = time(0.012 / speed)

  // Per-source hue offsets — opposite sides of the palette, slowly drifting.
  h1 = time(0.9 / speed)
  h2 = h1 + 0.5
}

export function render3D(index, x, y, z) {
  var d1 = hypot3(x - x1, y - y1, z - z1)
  var d2 = hypot3(x - x2, y - y2, z - z2)

  // Core glow — inverse-quadratic falloff makes the source position clearly
  // visible as a bright spot that tracks the orbit.
  var core1 = coreGlow / (d1 * d1 * 25 + 1)
  var core2 = coreGlow / (d2 * d2 * 25 + 1)

  // Expanding shells in distance-space. Cubic gamma sharpens them, and a
  // linear distance fade dims shells that have travelled far from their source.
  var ring1 = wave(d1 * shellDensity - shellPhase)
  var ring2 = wave(d2 * shellDensity - shellPhase)
  ring1 = ring1 * ring1 * ring1 * (1 - min(d1 * 1.3, 1))
  ring2 = ring2 * ring2 * ring2 * (1 - min(d2 * 1.3, 1))

  // Each source contributes brightness additively; whichever contributes
  // more wins the hue. In overlap zones both are bright and we get nice
  // mixing, with a clean hue hand-off as one source moves closer than the other.
  var b1 = core1 + ring1
  var b2 = core2 + ring2
  var v = min(b1 + b2, 1)
  var h = (b1 > b2) ? h1 : h2

  paint(h, v * brightness)
}

// 2D fallback: slice at z == 0.
export function render2D(index, x, y) {
  render3D(index, x, y, 0)
}

// 1D fallback: walk the pattern along x so the strip preview stays alive.
export function render(index) {
  render3D(index, index / pixelCount, 0.5, 0.5)
}
