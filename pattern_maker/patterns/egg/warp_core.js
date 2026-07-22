/*
  Warp Core — tumbling wormhole for the egg

  Render-audit note: true-black pixels (~39% 3D / 31% 2D on the real egg
  map) are the dark space between rings, not a missing ambient floor —
  reviewed against color-craft.md's "Background is a color decision" rule
  and kept as the documented, intentional exception it allows (Rule 7).
  No behavior changed.

  A tunnel of concentric rings rushing past a moving axis direction. The
  axis itself tumbles slowly through 3D, so "forward" drifts — you dive
  toward the top pole for a while, then pivot to a side, then to the
  bottom. Fractal sub-rings run inside the main rings at a different
  scroll rate. A spiral twist makes the tunnel feel like it's drilling.
  Color sweeps along depth so palette positions wash past as you travel.

  Colors come from a 4-palette psychedelic set (bhw3_52,
  BlacK_Red_Magenta_Yellow, Cyan_Magenta_Blue, BlacK_Green_Cyan) that
  auto-rotates with crossfades — dark-base, high-saturation, limited-hue
  acid palettes (no full rainbows, no whites, no pastels).

  2D strategy: RE-PARAMETERIZE (2d-parity.md strategy c). The old render2D
  sliced at z=0.5 borrowing the 3D tumble axis for depth — but whenever that
  axis pointed near ±z (ax,ay → 0) the depth term went near-constant and the
  rings flattened across the whole panel. render2D now derives depth from a
  2D-native rotating direction with its own time tap, so the tunnel always
  keeps ring structure; the ring/twist/tunnel math is otherwise identical.
  1D render() walks the long (y) axis through the center.

  Sliders:
    Speed        — overall warp rate
    RingDensity  — main ring frequency 3..12
    Twist        — spiral drill strength (0 = straight rings, high = corkscrew)
    TunnelWidth  — bright-core radius (low = tight pinhole, high = fills egg)
    HueOffset    — manual rotation of the palette ring (0..1)
    Tumble       — axis drift rate (low = barely tumbles, high = 2x)
    Brightness   — global output scale
*/

// ============================================================
// PALETTES — psychedelic neon set
// ============================================================

//https://phillips.shef.ac.uk/pub/cpt-city/bhw/bhw3/bhw3_52
//purple-magenta-orange-red-black — petrol fire
var bhw3_52_gp = [
    0, 114, 22,105,
   46, 118, 22, 85,
   99, 201, 45, 67,
  133, 238,187, 70,
  176, 232, 85, 34,
  201, 232, 56, 59,
  255,   5,  0,  4]
arrayMutate(bhw3_52_gp,(v, i ,a) => v / 255);

//https://phillips.shef.ac.uk/pub/cpt-city/nd/basic/BlacK_Red_Magenta_Yellow
//black-red-magenta-hot pink-yellow — acid valentine
var BlacK_Red_Magenta_Yellow_gp = [
    0,   0,  0,  0,
   43, 128,  0,  0,
   85, 255,  0,  0,
  127, 255,  0,128,
  170, 255,  0,255,
  212, 255,128,128,
  255, 255,255,  0]
arrayMutate(BlacK_Red_Magenta_Yellow_gp,(v, i ,a) => v / 255);

//https://phillips.shef.ac.uk/pub/cpt-city/nd/basic/Cyan_Magenta_Blue
//cyan-magenta-purple-blue — vaporwave neon
var Cyan_Magenta_Blue_gp = [
    0,   0,255,255,
   64, 128,128,255,
  127, 255,  0,255,
  191, 128,  0,255,
  255,   0,  0,255]
arrayMutate(Cyan_Magenta_Blue_gp,(v, i ,a) => v / 255);

//https://phillips.shef.ac.uk/pub/cpt-city/nd/basic/BlacK_Green_Cyan
//black-toxic green-cyan — radioactive
var BlacK_Green_Cyan_gp = [
    0,   0,  0,  0,
   64,   0,128,  0,
  127,   0,255,  0,
  191,   0,255,128,
  255,   0,255,255]
arrayMutate(BlacK_Green_Cyan_gp,(v, i ,a) => v / 255);

var palettes = [bhw3_52_gp, BlacK_Red_Magenta_Yellow_gp, Cyan_Magenta_Blue_gp, BlacK_Green_Cyan_gp]

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
var ringDensity = 6
var twist = 0.08
var tunnelWidth = 0.18
var hueOffset = 0
var tumbleRate = 1
var brightness = 1

export function sliderSpeed(v) {
  speed = 0.1 + v * 0.6
}
export function sliderRingDensity(v) {
  ringDensity = 3 + floor(v * 9 + 0.0001)
  if (ringDensity > 12) ringDensity = 12
}
export function sliderTwist(v) {
  twist = v * 0.5
}
export function sliderTunnelWidth(v) {
  tunnelWidth = 0.05 + v * 0.45
}
export function sliderHueOffset(v) {
  hueOffset = v
}
export function sliderTumble(v) {
  tumbleRate = 0.3 + v * 1.7
}
export function sliderBrightness(v) {
  brightness = 0.3 + v * 0.7
}

// Per-LED geometric caches. dsq is centered squared-distance + epsilon
// (epsilon keeps dsq truthy so the "not yet cached" check works, and
// avoids division-by-zero style traps at the exact center).
// spiralAngle is atan2 in the XZ plane — a fixed per-LED azimuth used
// only as a phase offset for the ring twist (doesn't need to track the
// moving axis; the effect still reads as a drilling swirl).
var dsqCache = array(pixelCount)
var angleCache = array(pixelCount)

// Per-LED caches for the 2D-native renderer (same lazy-cache trick as the
// 3D arrays above; kept separate so toggling 2D/3D never mixes stale values).
var dsq2dCache = array(pixelCount)
var angle2dCache = array(pixelCount)

// Per-frame state
var ax = 0, ay = 1, az = 0   // current unit axis direction ("forward")
var c2d = 1, s2d = 0         // 2D-native tunnel direction (always unit-length)
var warpPhase = 0            // 0..1 sawtooth driving ring scroll
var hueDrift = 0             // 0..1 sawtooth driving overall palette cycle

export function beforeRender(delta) {
  setupPalette(delta)

  // Tumbling axis via spherical coords. Two incommensurate periods so
  // "forward" never repeats cleanly — the direction keeps drifting.
  // tumbleRate is an independent multiplier on axis motion so you can
  // dial tumble up/down without affecting warp speed.
  var tumbleScale = speed * tumbleRate
  var a = time(0.45 / tumbleScale) * PI2
  var b = time(0.60 / tumbleScale) * PI2
  var sb = sin(b)
  ax = sb * cos(a)
  ay = cos(b)
  az = sb * sin(a)

  warpPhase = time(0.04 / speed)   // ring-scroll period
  hueDrift  = time(0.7  / speed)   // overall palette cycle

  // 2D-native tunnel direction for render2D (audit fix: re-parameterize —
  // strategy c). Its own independent tap, paced like the axis tumble, and
  // always unit-length in the panel plane so the rings never flatten.
  var t2d = time(0.5 / tumbleScale) * PI2
  c2d = cos(t2d)
  s2d = sin(t2d)
}

export function render3D(index, x, y, z) {
  // Fetch cached per-LED geometric constants.
  var dsq = dsqCache[index]
  var spiralAngle
  if (!dsq) {
    var dxi = x - 0.5, dyi = y - 0.5, dzi = z - 0.5
    dsq = dxi * dxi + dyi * dyi + dzi * dzi + 0.0001
    spiralAngle = atan2(dzi, dxi)
    dsqCache[index] = dsq
    angleCache[index] = spiralAngle
  } else {
    spiralAngle = angleCache[index]
  }

  // Signed depth along the current forward axis (projection of the
  // centered position vector onto the axis unit vector).
  var depth = (x - 0.5) * ax + (y - 0.5) * ay + (z - 0.5) * az

  // Perpendicular distance from the axis, squared. Saves the sqrt —
  // we only compare it against thresholds in smoothstep, so we compare
  // against squared thresholds below.
  var rperpSq = dsq - depth * depth
  if (rperpSq < 0) rperpSq = 0

  // Main tunnel rings. Scroll term and depth term share a factor so
  // rings travel at a clean speed along the axis. Spiral-angle phase
  // offset (scaled by twist slider) makes the rings drill / corkscrew
  // as they rush past.
  var ring1 = wave(depth * ringDensity - warpPhase * ringDensity + spiralAngle * twist)

  // Fractal sub-rings — 3x the frequency, 2.5x the scroll rate. The
  // mismatch is what creates the "rings inside rings inside rings"
  // infinite-regress perception.
  var ring2 = wave(depth * ringDensity * 3 - warpPhase * ringDensity * 2.5)

  // Tunnel-wall falloff. On-axis (rperpSq ≈ 0) is brightest, walls
  // (rperpSq large) fade out. This is the depth cue that sells the
  // "looking down a corridor" feeling. tunnelWidth is the squared outer
  // threshold — small = tight pinhole, large = mask fills the whole egg.
  var tunnelMask = 1 - smoothstep(0.01, tunnelWidth, rperpSq)

  // Compose intensity. Small baseline (0.25) so tunnel walls aren't
  // totally black — gives the egg shape a faint glow at all times.
  var v = (ring1 * 0.7 + ring2 * 0.3) * (0.25 + 0.75 * tunnelMask)

  // Palette position cycles along depth — colors sweep past as you fly.
  // hueDrift slowly rotates the whole palette over time; hueOffset is
  // the user's manual rotation. Wrap into [0,1) for paint().
  var pos = depth * 1.2 + hueDrift + hueOffset
  pos = pos - floor(pos)

  // Gamma — perceptually linear brightness.
  v = v * v

  // Global brightness slider.
  v = v * brightness

  // Dithering deadband — hard snap to prevent PWM flicker on dark LEDs.
  if (v < 0.04) v = 0

  paint(pos, v)
}

// 2D strategy: re-parameterize (2d-parity.md strategy c). The old
// render3D(index, x, y, 0.5) slice borrowed the 3D tumble axis for depth,
// which went near-constant (rings flattened panel-wide) whenever the axis
// pointed near ±z. Depth now comes from a 2D-native rotating direction
// (c2d, s2d) with its own time tap; ring/twist/tunnel math matches render3D.
export function render2D(index, x, y) {
  // Cached per-LED geometry, mirroring render3D's lazy-cache pattern.
  var dsq = dsq2dCache[index]
  var spiralAngle
  if (!dsq) {
    var dxi = x - 0.5, dyi = y - 0.5
    dsq = dxi * dxi + dyi * dyi + 0.0001
    spiralAngle = atan2(dyi, dxi)
    dsq2dCache[index] = dsq
    angle2dCache[index] = spiralAngle
  } else {
    spiralAngle = angle2dCache[index]
  }

  // Signed depth along the rotating 2D tunnel direction, and squared
  // perpendicular distance from that line — same roles as in render3D.
  var depth = (x - 0.5) * c2d + (y - 0.5) * s2d
  var rperpSq = dsq - depth * depth
  if (rperpSq < 0) rperpSq = 0

  var ring1 = wave(depth * ringDensity - warpPhase * ringDensity + spiralAngle * twist)
  var ring2 = wave(depth * ringDensity * 3 - warpPhase * ringDensity * 2.5)
  var tunnelMask = 1 - smoothstep(0.01, tunnelWidth, rperpSq)
  var v = (ring1 * 0.7 + ring2 * 0.3) * (0.25 + 0.75 * tunnelMask)

  var pos = depth * 1.2 + hueDrift + hueOffset
  pos = pos - floor(pos)

  v = v * v * brightness
  if (v < 0.04) v = 0

  paint(pos, v)
}

// 1D fallback: walk the strip along the long (y) axis through the center.
export function render(index) {
  render3D(index, 0.5, index / pixelCount, 0.5)
}
