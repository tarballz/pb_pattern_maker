// Hyperdrive 3D - psychedelic braided interference
// Three traveling waves on three axes multiplied together produce sparse,
// bright filaments that twist through the egg's volume. Hue spirals up the
// z-axis. Cycles through 4 high-saturation palettes with smooth blends.
// Sliders: Speed (animation rate), Brightness (overall intensity)

////////////////////////////////
// START PALETTE STUFF
// (palette manager copied from hc_pat.js / ZRanger1's blending demo)
////////////////////////////////

//https://phillips.shef.ac.uk/pub/cpt-city/pj/5/harryrainbow
//orange-pink-magenta-blue-cyan-gray-yellow-orange
var harryrainbow_gp = [
    0, 255,156, 45,
   26, 254, 68,128,
   43, 244, 21,189,
   61, 208,  0,235,
   79, 130, 27,254,
   97,  63, 83,255,
  112,  17,147,255,
  125,   0,201,251,
  133,   1,220,246,
  145,  21,244,225,
  166,  67,254,179,
  178, 151,255, 96,
  191, 168,255, 79,
  201, 194,255, 53,
  217, 247,242,  1,
  232, 254,217,  5,
  245, 255,155, 46,
  255, 255,155, 46]

arrayMutate(harryrainbow_gp,(v, i ,a) => v / 255);

//https://phillips.shef.ac.uk/pub/cpt-city/neo10/fx/hueshift
//red-magenta-blue-cyan-lime-yellow-orange
var hueshift_gp = [
    0, 255,  0, 78,
   26, 255,  0, 78,
   26, 255,  0,230,
   51, 255,  0,230,
   51, 127,  0,255,
   76, 127,  0,255,
   76,   0, 26,255,
  102,   0, 26,255,
  102,   0,179,255,
  127,   0,179,255,
  127,   0,255,178,
  153,   0,255,178,
  153,   0,255, 25,
  178,   0,255, 25,
  178, 128,255,  0,
  204, 128,255,  0,
  204, 255,229,  0,
  229, 255,229,  0,
  229, 255, 77,  0,
  255, 255, 77,  0]

arrayMutate(hueshift_gp,(v, i ,a) => v / 255);

//https://phillips.shef.ac.uk/pub/cpt-city/pj/4/luxoorb
//purple-orange-yellow-gray-pink-purple
var luxoorb_gp = [
    0, 165, 25, 85,
    5, 165, 25, 85,
   41, 217,167, 69,
   74, 207,215, 69,
  112,  79,195,171,
  153,  69,153,217,
  189, 101, 75,217,
  217, 167, 69,215,
  250, 163, 23, 85,
  255, 163, 23, 85]

arrayMutate(luxoorb_gp,(v, i ,a) => v / 255);

//https://phillips.shef.ac.uk/pub/cpt-city/nd/strips/Spectrum
//red-yellow-lime-cyan-blue-magenta
var Spectrum_gp = [
    0, 255,  0,  0,
   21, 255,  0,  0,
   43, 255,  0,  0,
   43, 255,255,  0,
   64, 255,255,  0,
   85, 255,255,  0,
   85,   0,255,  0,
  106,   0,255,  0,
  127,   0,255,  0,
  127,   0,255,255,
  149,   0,255,255,
  170,   0,255,255,
  170,   0,  0,255,
  191,   0,  0,255,
  212,   0,  0,255,
  212, 255,  0,255,
  234, 255,  0,255,
  255, 255,  0,255]

arrayMutate(Spectrum_gp,(v, i ,a) => v / 255);

var palettes = [harryrainbow_gp, hueshift_gp, luxoorb_gp, Spectrum_gp]

var PALETTE_HOLD_TIME = 10
var PALETTE_TRANSITION_TIME = 3

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

var speedMult = 1.0
var brightness = 1.0

export function sliderSpeed(v) { speedMult = 0.2 + v * 3 }
export function sliderBrightness(v) { brightness = v }

export function beforeRender(delta) {
  setupPalette(delta)

  // smaller tf = faster animation; speedMult scales it
  tf = 5 / speedMult

  // spatial frequencies on each axis breathe at different rates
  fx = wave(time(tf *  7.1 / 65.536)) * 3 + 2    // 2-5
  fy = wave(time(tf *  9.4 / 65.536)) * 3 + 2    // 2-5
  fz = wave(time(tf * 11.2 / 65.536)) * 3 + 1.5  // 1.5-4.5

  // sawtooth phase drift along each axis (0-1 wraps cleanly into wave())
  t1 = time(tf *  6.6 / 65.536)
  t2 = time(tf *  8.3 / 65.536)
  t3 = time(tf *  4.9 / 65.536)

  huePhase = time(tf * 13.7 / 65.536)
}

export function render3D(index, x, y, z) {
  // three traveling waves, each on a different axis but each tilted by z
  // so the interference visibly braids through the egg's volume
  v1 = wave(x * fx + z * 0.5 - t1)
  v2 = wave(y * fy - z * 0.5 + t2)
  v3 = wave((x + y) * 0.7 + z * fz + t3)

  // multiplicative interference: bright where all three peak together,
  // dark elsewhere -> filaments threading through the volume.
  // The product is already nonlinear (acts as gamma) — no extra v*v needed.
  v = v1 * v2 * v3

  // hue spirals up z with a slight x+y twist; huePhase walks the palette
  h = wave(z * 0.6 + (x + y) * 0.2 + huePhase)

  paint(h, v * brightness)
}

export function render2D(index, x, y) {
  render3D(index, x, y, 0)
}

export function render(index) {
  pct = index / pixelCount
  render3D(index, pct, pct, pct)
}
