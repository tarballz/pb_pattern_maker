/*
  Gyroid 3D — animated triply-periodic minimal surface

  What it is
  ----------
  The gyroid is a minimal surface discovered by Alan Schoen in 1970 while he
  was working at NASA. It is a triply-periodic minimal surface (TPMS),
  meaning it is both periodic in all three spatial axes and locally
  area-minimizing everywhere. Its implicit equation is remarkably compact:

      sin(x) cos(y) + sin(y) cos(z) + sin(z) cos(x) = 0

  What's unique about it
  ----------------------
  Unlike the earlier Schwarz P / D surfaces, the gyroid contains no straight
  lines, no reflection symmetries, and no embedded planes — every point on
  the surface is chiral. It partitions 3D space into two interpenetrating
  but disconnected labyrinths that weave through each other without ever
  touching.

  That structure is the point of this pattern: the glowing bands you see on
  the egg only make coherent visual sense because each LED knows where it
  sits in (x, y, z). A 2D slice of the gyroid is just wiggly stripes. The
  3D rendering is what shows that the mapper actually works — you're
  looking at a genuinely volumetric mathematical object draped across the
  egg, not a flat projection.

  How this implementation works
  -----------------------------
  - sin/cos are approximated with PixelBlaze's cheap wave() LUT (wave is 0..1,
    so sinw(t) = 2*wave(t) - 1 and cosw(t) = 2*wave(t + 0.25) - 1). This keeps
    the pattern well within budget at 1352 LEDs — six wave() calls per pixel
    and no trig, sqrt, or perlin in render.
  - Each spatial axis gets its own slowly-drifting time phase, so the surface
    appears to flow and reshape through the egg.
  - A breathing density term (cells-per-egg) oscillates over ~100s, so the
    pattern slowly inhales and exhales without ever feeling static.
  - The gyroid scalar field g is in ~[-1.5, +1.5]; we render the narrow band
    around g == 0 as a cubic-gamma glow with width controlled by `thickness`.
  - Hue travels through the field position plus time, so bands flow through
    the palette while the palette itself crossfades (see palette manager
    below, ported from patterns/egg/hc_pat.js).

  Sliders
  -------
  - Speed      — global animation rate (phase drift + breathing).
  - Brightness — final output multiplier.
  - Density    — base number of gyroid cells across the egg (~1.5..4.5).
  - Thickness  — width of the glowing band around the zero surface.
  Trigger: IncrementPalette — jump to the next palette, skipping the fade.
*/

////////////////////////////////
// START PALETTE STUFF
// (ported from patterns/egg/hc_pat.js — small state machine that crossfades
//  between gradient palettes by mutating a single live-palette array in place)
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

//brown-yellow-forest-green
var es_landscape_33_gp = [
    0,   1,  5,  0,
   19,  32, 23,  1,
   38, 161, 55,  1,
   63, 229,144,  1,
   66,  39,142, 74,
  255,   1,  4,  1]
arrayMutate(es_landscape_33_gp,(v, i ,a) => v / 255);

var palettes = [bhw1_05_gp, bhw1_04_gp, Sunset_Real_gp, Analogous_3_gp,
                Analogous_1_gp, black_Blue_Magenta_White_gp, es_landscape_33_gp]

var PALETTE_HOLD_TIME = 12      // seconds holding a palette
var PALETTE_TRANSITION_TIME = 4 // seconds crossfading to the next one

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
var densityBase = 2.5   // base number of gyroid cells across the egg
var thickness = 0.3     // band width around the zero surface

export function sliderSpeed(v)      { speed = 0.1 + v * 1.9 }        // 0.1 .. 2.0
export function sliderBrightness(v) { brightness = v }
export function sliderDensity(v)    { densityBase = 1.5 + v * 3 }    // 1.5 .. 4.5 cells
export function sliderThickness(v)  { thickness = 0.1 + v * 0.5 }    // 0.1 .. 0.6

// Frame-level state
var t1, t2, t3, t4, f, invThickness

export function beforeRender(delta) {
  setupPalette(delta)

  // Per-axis phase drifts at incommensurate rates so the surface never
  // repeats on a simple cycle. Dividing by speed makes higher speed = faster.
  t1 = time(0.23 / speed)
  t2 = time(0.29 / speed)
  t3 = time(0.37 / speed)
  t4 = time(0.51 / speed) // palette-position drift

  // Breathing density: oscillate around densityBase by +/- 25%.
  f = densityBase * (0.75 + 0.5 * wave(time(1.2 / speed)))

  // Precompute 1/thickness so render3D avoids a per-pixel divide.
  invThickness = 1 / thickness
}

export function render3D(index, x, y, z) {
  // Center-based coordinates scaled to "cells across the egg".
  var px = f * (x - 0.5) + t1
  var py = f * (y - 0.5) + t2
  var pz = f * (z - 0.5) + t3

  // Cheap sin/cos via wave(): sinw(t) = 2*wave(t) - 1, cosw(t) = sinw(t + 0.25).
  var sx = 2 * wave(px) - 1
  var sy = 2 * wave(py) - 1
  var sz = 2 * wave(pz) - 1
  var cx = 2 * wave(px + 0.25) - 1
  var cy = 2 * wave(py + 0.25) - 1
  var cz = 2 * wave(pz + 0.25) - 1

  // Gyroid scalar field. Zero on the minimal surface; |g| grows with distance.
  var g = sx * cy + sy * cz + sz * cx

  // Glow band around g == 0, with cubic gamma for perceptual punch.
  var band = 1 - min(abs(g) * invThickness, 1)
  var v = band * band * band

  // Hue: travels along the diagonal of the gyroid field plus a slow global drift.
  var h = (px + py + pz) * 0.05 + t4

  paint(h, v * brightness)
}

// 2D fallback: slice at z == 0. Visibly less interesting than the 3D view —
// which is intentional, it's the contrast that sells the 3D map.
export function render2D(index, x, y) {
  render3D(index, x, y, 0)
}

// 1D fallback: walk a line through the gyroid so strip previews stay alive.
export function render(index) {
  var u = index / pixelCount
  render3D(index, u, 0, 0)
}
