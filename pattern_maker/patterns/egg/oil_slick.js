/*
  Oil Slick — flowing iridescent thin-film

  A slow, marbled liquid surface. Two perlin noise fields per pixel:

    qx  — a low-frequency "flow" field that warps the lookup coords
          (domain warping → smeared, streaky, fluid look instead of
          isotropic blobs).

    n   — a higher-frequency "thickness" field, sampled at the warped
          coords, that drives palette position. Reads as the optical
          path length through a film of oil — small changes in thickness
          shift the visible interference color across the rainbow.

  Brightness is held high and stable (real oil slicks are luminous, not
  dim) with a gentle gamma + faint dark veining where the thickness
  field crosses zero. The 4 palettes (mystic rainbow, classic full
  rainbow, luxo orb, spring colors) are all smooth wraparound iridescent
  cycles — they look like petrol on wet asphalt.

  Sliders:
    Speed       — overall flow rate
    Brightness  — global output scale
    Flow        — domain-warp amount (low = isotropic blobs, high = streaky drag)
    Bands       — interference-fringe density (low = wide color zones, high = tight rainbow stripes)
*/

// ============================================================
// PALETTES — oil-slick set
// ============================================================

//https://phillips.shef.ac.uk/pub/cpt-city/bhw/bhw3/bhw3_51
//indigo-violet-lavender-pearl-magenta-purple — petrol on dark glass
var bhw3_51_gp = [
    0,   5,  1, 36,
    3,   5,  1, 36,
   36,  34, 22, 94,
   61,  59, 67,191,
   87, 108,104,224,
  127, 254,253,248,
  161, 245,114,246,
  204, 154, 47,237,
  255,  94, 53,171]
arrayMutate(bhw3_51_gp,(v, i ,a) => v / 255);

//https://phillips.shef.ac.uk/pub/cpt-city/bhw/bhw1/bhw1_04
//gold-coral-magenta-deep indigo-navy — oil on a sunset puddle
var bhw1_04_gp = [
    0, 245,242, 31,
   15, 244,168, 48,
  143, 126, 21,161,
  199,  90, 22,160,
  255,   0,  0,128]
arrayMutate(bhw1_04_gp,(v, i ,a) => v / 255);

//https://phillips.shef.ac.uk/pub/cpt-city/bhw/bhw3/bhw3_18
//navy-lavender-blue-teal-mossy green — beetle wing iridescence
var bhw3_18_gp = [
    0,  46, 43, 74,
   31,  80, 61,166,
   48, 148,184,232,
   64,  75,126,183,
   82,  10, 54,151,
  117, 170,154,252,
  145,  21, 65, 68,
  176, 148,188,126,
  196, 114,198, 60,
  235,  52, 98, 70,
  255,   0,  9,  6]
arrayMutate(bhw3_18_gp,(v, i ,a) => v / 255);

//https://phillips.shef.ac.uk/pub/cpt-city/bhw/bhw4/bhw4_062
//violet-magenta-pearl-violet — nacre on dark
var bhw4_062_gp = [
    0,  54, 16, 77,
   15,  74, 31,102,
   36, 110, 74,200,
   64, 237,173,234,
  107, 134, 77,156,
  138, 245,250,255,
  153, 216,180,244,
  178, 166,125,219,
  209,  68, 31,124,
  242,  16,  6, 77,
  255,  16,  6, 77]
arrayMutate(bhw4_062_gp,(v, i ,a) => v / 255);

var palettes = [bhw3_51_gp, bhw1_04_gp, bhw3_18_gp, bhw4_062_gp]

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
var bands = 5      // palette cycles per unit of thickness — interference fringe count

export function sliderSpeed(v)      { speed = 0.05 + v * 0.45 }
export function sliderBrightness(v) { brightness = 0.4 + v * 0.6 }
export function sliderFlow(v)       { flow = 0.4 + v * 1.6 }
export function sliderBands(v)      { bands = 2 + v * 8 }

// ============================================================
// FRAME STATE
//
// All the slow-drift offsets that animate the noise field. Three
// independent offsets on incommensurate periods so the flow never
// repeats. Periods chosen long (60–180s) — oil moves lazy.
// ============================================================

var tWarpX = 0
var tWarpZ = 0
var tThick = 0
var huePhase = 0

export function beforeRender(delta) {
  setupPalette(delta)
  var sp = speed

  // Drift offsets — fed straight into perlin coords. PB's perlin domain
  // is roughly unit-scaled, so multiplying time by 256 gives a slow
  // drift through noise space. Three independent axes keep the field
  // from translating bodily — it churns.
  tWarpX   = time(0.92 / sp) * 256        // ~60s
  tWarpZ   = time(1.49 / sp) * 256        // ~98s
  tThick   = time(2.40 / sp) * 256        // ~157s
  huePhase = time(0.55 / sp)              // ~36s, slow palette-position drift
}

// ============================================================
// RENDER
//
// Two perlin calls per pixel. Per AGENTS.md noise is expensive — at
// 1400 LEDs this is the budget. perlinFbm is multi-octave and would
// double the cost; the domain warp gives us "fake" detail for free.
// ============================================================

export function render3D(index, x, y, z) {
  var fx = x - 0.5
  var fy = y - 0.5
  var fz = z - 0.5

  // Low-freq flow field — drifts slowly, drives both the warp AND the
  // bright/dark "where is there oil" mask. Frequency 1.6 → 1–2 big
  // swirls visible across the egg at any time.
  var warp = perlin(fx * 1.6 + tWarpX, fy * 1.6, fz * 1.6 + tWarpZ, 0)

  // High-freq thickness field — sampled at warp-offset coords.
  // Frequency 4.5 gives ~4 noise blobs across the egg; the *bands*
  // multiplier inside the palette mapping turns each blob's gradient
  // into many tight color fringes (thin-film interference behavior).
  var n = perlin(
    fx * 4.5 + warp * flow * 1.4 + tThick,
    fy * 4.5 + warp * flow * 1.0,
    fz * 4.5 + warp * flow * 1.4,
    1
  )

  // Multi-cycle palette mapping — small change in n sweeps several
  // palette cycles, producing the tightly-banded fringe look that
  // reads as oil-on-water rather than "shifting blob of color".
  var pos = n * bands + huePhase
  pos = pos - floor(pos)

  // Brightness: warp drives a soft mask. Where warp is high, oil film
  // is "thick" → bright iridescent reflection. Where warp is low, dark
  // substrate shows through. smoothstep gives a soft puddle edge.
  // Multiplier on the right adds fine-grained value variation from
  // the thickness field so the bands aren't uniformly bright.
  var mask = smoothstep(-0.2, 0.25, warp)
  var sheen = 0.7 + 0.3 * (n + 0.5)         // 0.7..1.0
  var v = mask * sheen
  v = v * v * brightness                     // gamma — deep blacks
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
