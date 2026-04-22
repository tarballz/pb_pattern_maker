/*
  Warp Core — tumbling wormhole for the egg

  A tunnel of concentric rings rushing past a moving axis direction. The
  axis itself tumbles slowly through 3D, so "forward" drifts — you dive
  toward the top pole for a while, then pivot to a side, then to the
  bottom. Fractal sub-rings run inside the main rings at a different
  scroll rate. A spiral twist makes the tunnel feel like it's drilling.
  Hue bands sweep along depth so colors wash past as you travel.

  Sliders:
    Speed        — overall warp rate
    RingDensity  — main ring frequency 3..12
    Twist        — spiral drill strength (0 = straight rings, high = corkscrew)
    TunnelWidth  — bright-core radius (low = tight pinhole, high = fills egg)
    HueOffset    — rotate the whole palette through the hue wheel
    Tumble       — axis drift rate (low = barely tumbles, high = 2x)
    Brightness   — global output scale
*/

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

// Per-frame state
var ax = 0, ay = 1, az = 0   // current unit axis direction ("forward")
var warpPhase = 0            // 0..1 sawtooth driving ring scroll
var hueDrift = 0             // 0..1 sawtooth driving overall hue cycle

export function beforeRender(delta) {
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
  hueDrift  = time(0.7  / speed)   // overall hue cycle
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

  // Hue cycles through electric palette as a function of depth.
  // Depth push shifts toward blue one way and magenta the other;
  // hueDrift slowly rotates the whole palette over time; hueOffset is
  // the user's manual rotation of the base palette. hsv() wraps hue
  // naturally so any offset value is valid.
  var h = depth * 1.2 + hueDrift + 0.5 + hueOffset

  var s = 0.9

  // Gamma — perceptually linear brightness.
  v = v * v

  // Global brightness slider.
  v = v * brightness

  // Dithering deadband — hard snap to prevent PWM flicker on dark LEDs.
  if (v < 0.04) v = 0

  hsv(h, s, v)
}

export function render2D(index, x, y) {
  render3D(index, x, y, 0.5)
}
