/*
  Oil Slick Sunset — flowing iridescent thin-film, sunset palette set

  Same engine as oil_slick.js (low-freq warp drives both a domain-warp
  on a high-freq thickness field AND a bright/dark substrate mask;
  thickness gets multi-cycle palette mapped → tight interference fringes).
  Only the palette set differs: four moody sunset/asphalt gradients
  built from purples, blues, and oranges, no rainbow, no green/teal.
  Reads like petrol on a wet road at dusk.

  Sliders:
    Speed       — overall flow rate
    Brightness  — global output scale
    Flow        — domain-warp amount (low = isotropic blobs, high = streaky drag)
    Bands       — interference-fringe density (low = wide color zones, high = tight stripes)
*/

// ============================================================
// PALETTES — purple/blue/orange sunset set
// ============================================================

//https://phillips.shef.ac.uk/pub/cpt-city/nd/basic/Blue_Magenta_Yellow
//blue-purple-magenta-pink-yellow — fully saturated electric sunset
var Blue_Magenta_Yellow_gp = [
    0,   0,  0,255,
   64, 128,  0,255,
  127, 255,  0,255,
  191, 255,128,128,
  255, 255,255,  0]
arrayMutate(Blue_Magenta_Yellow_gp,(v, i ,a) => v / 255);

//https://phillips.shef.ac.uk/pub/cpt-city/bhw/bhw1/bhw1_04
//gold-coral-magenta-deep indigo-navy — oil on a sunset puddle
var bhw1_04_gp = [
    0, 245,242, 31,
   15, 244,168, 48,
  143, 126, 21,161,
  199,  90, 22,160,
  255,   0,  0,128]
arrayMutate(bhw1_04_gp,(v, i ,a) => v / 255);

//https://phillips.shef.ac.uk/pub/cpt-city/nd/atmospheric/Sunset_Real
//red-orange-magenta-purple-deep blue — full dusk sky
var Sunset_Real_gp = [
    0, 191,  0,  0,
   23, 223, 85,  0,
   52, 255,170,  0,
   85, 217, 85, 89,
  136, 178,  0,178,
  198,  89,  0,195,
  255,   0,  0,212]
arrayMutate(Sunset_Real_gp,(v, i ,a) => v / 255);

//https://phillips.shef.ac.uk/pub/cpt-city/nd/rich/Primary_04
//yellow-orange-red-purple-navy — heavy sunset gradient
var Primary_04_gp = [
    0, 217,217,  0,
   64, 217,108,  0,
  127, 217,  0,  0,
  191, 108, 28, 70,
  255,   0, 56,140]
arrayMutate(Primary_04_gp,(v, i ,a) => v / 255);

var palettes = [Blue_Magenta_Yellow_gp, bhw1_04_gp, Sunset_Real_gp, Primary_04_gp]

// ============================================================
// PALETTE MANAGER
// ============================================================

var PALETTE_HOLD_TIME = 25
var PALETTE_TRANSITION_TIME = 12

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
// SLIDERS
// ============================================================

var speed = 1
var brightness = 1
var flow = 1
var bands = 5

export function sliderSpeed(v)      { speed = 0.05 + v * 0.45 }
export function sliderBrightness(v) { brightness = 0.4 + v * 0.6 }
export function sliderFlow(v)       { flow = 0.4 + v * 1.6 }
export function sliderBands(v)      { bands = 2 + v * 8 }

// ============================================================
// FRAME STATE
// ============================================================

var tWarpX = 0
var tWarpZ = 0
var tThick = 0
var huePhase = 0

export function beforeRender(delta) {
  setupPalette(delta)
  var sp = speed

  tWarpX   = time(0.92 / sp) * 256
  tWarpZ   = time(1.49 / sp) * 256
  tThick   = time(2.40 / sp) * 256
  huePhase = time(0.55 / sp)
}

// ============================================================
// RENDER
// ============================================================

export function render3D(index, x, y, z) {
  var fx = x - 0.5
  var fy = y - 0.5
  var fz = z - 0.5

  var warp = perlin(fx * 1.6 + tWarpX, fy * 1.6, fz * 1.6 + tWarpZ, 0)

  var n = perlin(
    fx * 4.5 + warp * flow * 1.4 + tThick,
    fy * 4.5 + warp * flow * 1.0,
    fz * 4.5 + warp * flow * 1.4,
    1
  )

  var pos = n * bands + huePhase
  pos = pos - floor(pos)

  var mask = smoothstep(-0.2, 0.25, warp)
  var sheen = 0.7 + 0.3 * (n + 0.5)
  var v = mask * sheen
  v = v * v * brightness
  if (v > 1) v = 1
  if (v < 0.02) v = 0

  paint(pos, v)
}

export function render2D(index, x, y) {
  render3D(index, x, y, 0.5)
}

export function render(index) {
  var p = index / pixelCount
  render3D(index, 0.5, p, 0.5)
}
