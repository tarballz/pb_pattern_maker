/*
  Orbital Cloud — quantum spherical-harmonic morph

  Treats the egg surface as a sphere and renders the squared modulus of a
  real-spherical-harmonic field

      Ψ(θ, φ) = Σᵢ cᵢ · Y_lᵢ^mᵢ(θ, φ)

  The coefficient vector c slowly crossfades between hand-tuned "orbital
  recipes" — s, p_z, p_x, d_z², d_{x²-y²}, f_z³, and hybrids — so the LEDs
  trace lobes that morph between recognizable atomic-orbital shapes via
  unfamiliar in-between superpositions. The whole field also slowly
  precesses around the vertical axis (φ rotation), and a separate Fibonacci
  period drives the trippy 4-palette rotation. Nothing re-syncs.

  Brightness ∝ Ψ²  (quantum probability density — lobes glow, nodes go dark)
  Hue        = sign(Ψ) split + slow drift  (positive vs negative lobes
                                              get opposite halves of the palette,
                                              so nodal surfaces read as color borders)

  2D strategy: RE-PARAMETERIZE (2d-parity.md decision-tree Q3 — azimuthal
  symmetry). The panel is an azimuthal-projection of the sphere: its center
  is the pole (mu=1), its edge is the far pole (mu=-1), and phi is re-derived
  as atan2(y-0.5, x-0.5) around the panel center — never sliced through the
  3D axis, which collapses phi to two values (2d-parity.md failure class 1).

  Sliders:
    Speed       — overall animation rate
    Brightness  — global output scale
    MorphRate   — how fast modes crossfade (low = hold each orbital longer)
    Precession  — how fast the lobes rotate around the vertical axis
*/

// ============================================================
// PALETTES — trippy cosmic set
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
// PALETTE MANAGER (shared with fibonacci_dream)
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
// SLIDERS
// ============================================================

var speed = 1
var brightness = 1
var morphRate = 1
var precessionRate = 1

export function sliderSpeed(v)       { speed = 0.3 + v * 2.4 }
export function sliderBrightness(v)  { brightness = 0.3 + v * 0.7 }
export function sliderMorphRate(v)   { morphRate = 0.5 + v * 2.5 }
export function sliderPrecession(v)  { precessionRate = v * 2 }

// ============================================================
// HARMONIC PRESETS
//
// Each preset is a 9-vector over the basis
//   [Y00, Y10, Y11, Y1-1, Y20, Y22, Y2-2, Y30, Y32]
// (i.e. s, p_z, p_x, p_y, d_z², d_{x²-y²}, d_xy, f_z³, f_xyz-ish)
//
// Stored flat as a 1D array of length NUM_PRESETS * NUM_HARMONICS
// because PB's array() does not nest. Index as [preset*NH + harmonic].
// ============================================================

var NUM_HARMONICS = 9
var NUM_PRESETS = 7
var presets = array(NUM_PRESETS * NUM_HARMONICS)

// Preset 0: pure s (uniform glow — a "breath" of light all over)
presets[0*9 + 0] = 1.0
// Preset 1: p_z (top + bottom lobes, equator nodal)
presets[1*9 + 1] = 1.6
// Preset 2: p_x (equator dipole)
presets[2*9 + 2] = 1.6
// Preset 3: d_z² (axial cigar + equatorial donut)
presets[3*9 + 4] = 1.4
// Preset 4: d_{x²-y²} (4-leaf clover at equator)
presets[4*9 + 5] = 1.5
// Preset 5: f_z³ (3-band axial stack)
presets[5*9 + 7] = 1.6
// Preset 6: hybrid (p_z + d_xy: tilted clover that drifts pole-to-pole)
presets[6*9 + 1] = 0.9
presets[6*9 + 6] = 1.2

// Live coefficient vector (rebuilt every frame as a blend of two presets).
var coeff = array(NUM_HARMONICS)
var curIdx = 0
var nextIdx = 1
var lastMorphT = 0

// ============================================================
// PER-LED SPATIAL CACHE
//
// All purely geometric — atan2/sqrt/sin/cos paid once per LED on first
// sight, never again. Sentinel: phiCache[i] = -999 means "not populated".
// ============================================================

var phiCache    = array(pixelCount)
var cphiCache   = array(pixelCount)
var sphiCache   = array(pixelCount)
var muCache     = array(pixelCount)
var sinThCache  = array(pixelCount)
for (i = 0; i < pixelCount; i++) phiCache[i] = -999

// ============================================================
// FRAME STATE
// ============================================================

var precess = 0
var cosPre = 1
var sinPre = 0
var huePhase = 0
var breath = 1

export function beforeRender(delta) {
  setupPalette(delta)
  var sp = speed

  // Slow lobe precession around the vertical axis (F12 = 144s).
  precess = time(2.197 / (sp * (precessionRate + 0.001))) * PI2
  cosPre = cos(precess)
  sinPre = sin(precess)

  // Mode crossfade phase (F10 = 55s, sped up by morphRate).
  var morphT = time(0.839 / (sp * morphRate))
  // Detect wrap → advance preset pointers.
  if (morphT < lastMorphT) {
    curIdx = nextIdx
    nextIdx = (nextIdx + 1) % NUM_PRESETS
  }
  lastMorphT = morphT

  // Smooth-step the crossfade so we ease in/out of each orbital instead
  // of cutting linearly through superpositions.
  var alpha = morphT * morphT * (3 - 2 * morphT)
  var inv = 1 - alpha
  var ci = curIdx * NUM_HARMONICS
  var ni = nextIdx * NUM_HARMONICS
  for (var k = 0; k < NUM_HARMONICS; k++) {
    coeff[k] = inv * presets[ci + k] + alpha * presets[ni + k]
  }

  // Decoupled palette/hue rotation (F9 = 34s).
  huePhase = time(0.519 / sp)

  // Global breath shimmer (F7 = 13s).
  breath = 0.6 + 0.4 * wave(time(0.198 / sp))
}

// ============================================================
// RENDER
// ============================================================

export function render3D(index, x, y, z) {
  // ── Lazy per-LED cache ────────────────────────────────────
  var phi = phiCache[index]
  var cphi, sphi, mu, sinTh
  if (phi < -500) {
    phi = atan2(z - 0.5, x - 0.5)
    cphi = cos(phi)
    sphi = sin(phi)
    mu = 2 * (y - 0.5)
    if (mu > 1) mu = 1
    if (mu < -1) mu = -1
    var s2_init = 1 - mu * mu
    if (s2_init < 0) s2_init = 0
    sinTh = sqrt(s2_init)
    phiCache[index] = phi
    cphiCache[index] = cphi
    sphiCache[index] = sphi
    muCache[index] = mu
    sinThCache[index] = sinTh
  } else {
    cphi = cphiCache[index]
    sphi = sphiCache[index]
    mu = muCache[index]
    sinTh = sinThCache[index]
  }

  // ── Rotate (cphi, sphi) by precession ─────────────────────
  var cP = cphi * cosPre - sphi * sinPre
  var sP = cphi * sinPre + sphi * cosPre

  // ── Derived terms (no transcendentals) ────────────────────
  var mu2 = mu * mu
  var s2  = sinTh * sinTh           // = 1 - mu²
  var c2P = cP * cP - sP * sP       // cos(2φ)
  var s2P = 2 * cP * sP             // sin(2φ)

  // ── Evaluate Ψ = Σ cᵢ · Yᵢ ───────────────────────────────
  var psi =
      coeff[0]
    + coeff[1] * mu
    + coeff[2] * sinTh * cP
    + coeff[3] * sinTh * sP
    + coeff[4] * (3 * mu2 - 1) * 0.5
    + coeff[5] * s2 * c2P
    + coeff[6] * s2 * s2P
    + coeff[7] * (5 * mu2 - 3) * mu * 0.5
    + coeff[8] * mu * s2 * c2P

  // ── Brightness ∝ Ψ², gamma-shaped, with breath ───────────
  var v = psi * psi * breath * brightness
  if (v > 1) v = 1
  if (v < 0.04) v = 0

  // ── Hue: sign-driven palette split + slow drift ──────────
  // Positive lobes land on one half of the palette ring,
  // negative lobes on the opposite half — nodal surfaces become
  // color borders, not just dark stripes.
  var pos = huePhase + 0.15 * mu
  if (psi < 0) pos = pos + 0.5
  pos = pos - floor(pos)

  paint(pos, v)
}

// 2D — RE-PARAMETERIZED, not sliced (see header): the panel is treated as
// its own polar plane. phi comes from atan2(y-0.5, x-0.5) around the panel
// center, and mu (the pole-to-pole coordinate) comes from radial distance —
// center = pole, edge = far pole — so both azimuthal and polar harmonic
// terms stay live instead of atan2(z-0.5, x-0.5) collapsing phi to 0/PI at
// a fixed-z slice.
export function render2D(index, x, y) {
  var dx = x - 0.5
  var dy = y - 0.5
  var phi = atan2(dy, dx)
  var r = sqrt(dx * dx + dy * dy)
  if (r > 0.5) r = 0.5
  var mu = 1 - 4 * r
  var s2_init = 1 - mu * mu
  if (s2_init < 0) s2_init = 0
  var sinTh = sqrt(s2_init)
  var cphi = cos(phi)
  var sphi = sin(phi)

  // ── Rotate (cphi, sphi) by precession ─────────────────────
  var cP = cphi * cosPre - sphi * sinPre
  var sP = cphi * sinPre + sphi * cosPre

  // ── Derived terms (no transcendentals) ────────────────────
  var mu2 = mu * mu
  var s2  = sinTh * sinTh           // = 1 - mu²
  var c2P = cP * cP - sP * sP       // cos(2φ)
  var s2P = 2 * cP * sP             // sin(2φ)

  // ── Evaluate Ψ = Σ cᵢ · Yᵢ ───────────────────────────────
  var psi =
      coeff[0]
    + coeff[1] * mu
    + coeff[2] * sinTh * cP
    + coeff[3] * sinTh * sP
    + coeff[4] * (3 * mu2 - 1) * 0.5
    + coeff[5] * s2 * c2P
    + coeff[6] * s2 * s2P
    + coeff[7] * (5 * mu2 - 3) * mu * 0.5
    + coeff[8] * mu * s2 * c2P

  // ── Brightness ∝ Ψ², gamma-shaped, with breath ───────────
  var v = psi * psi * breath * brightness
  if (v > 1) v = 1
  if (v < 0.04) v = 0

  // ── Hue: sign-driven palette split + slow drift ──────────
  var pos = huePhase + 0.15 * mu
  if (psi < 0) pos = pos + 0.5
  pos = pos - floor(pos)

  paint(pos, v)
}
