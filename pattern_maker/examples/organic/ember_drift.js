/*
  Ember Drift  (color-craft showcase)

  A bed of coals glows and flickers at the base of the sculpture while sparse
  ember cells detach and rise through a dim, slowly shifting ambient. The
  ambient hue drifts between dusk violet and deep ember red over ~54 s, so the
  "night air" around the fire cools and warms as a mood. Everything on screen
  is driven by one heat scalar per pixel: cold pixels sit on a tinted floor,
  warming pixels dip through a near-black valley, then climb a saturated
  red->orange ramp, and only true peaks desaturate to white-hot.

  Techniques demonstrated:
    - Designed value-shape: tinted ambient (v 0.09) -> near-black valley
      (~0.05 at heat 0.12) -> gamma'd saturated ramp -> bright highlight;
      the luminance curve was designed first, hues second
      (color-craft.md#palette-craft).
    - Colored background floor: the coldest pixel still emits a dim, fully
      saturated mood hue — never true (0,0,0)
      (color-craft.md#background-is-a-color-decision).
    - White-hot triple coupling: one heat scalar drives v (gamma'd, heat*heat),
      s (clamp(2 - 2*heat) — saturated below 0.5, white by 1.0), and a small
      hue lift (0.015 -> 0.085, red toward orange)
      (color-craft.md#white-hot-highlights).
    - Shortest-path hue handling, twice: the ambient mood lerps violet<->red
      across the hue wrap in beforeRender, and each pixel lerps from the
      drifting mood hue into the ember ramp — both rotate the delta into
      [-0.5, 0.5] first so the lerp never sweeps the long way through
      green/cyan (color-craft.md#palette-craft, Fix 1).
    - Raw hsv() with the stated reason the doc requires: hue is itself an
      animated quantity (the drifting mood) and s is an independent per-pixel
      field coupled to heat — a 1-D palette can't carry both
      (color-craft.md#palette-craft, decision guide).
    - Wrap-safe rising noise: delta-accumulated scroll wrapped mod 8 against
      setPerlinWrap(8,8,8), so the field never snaps when the accumulator
      wraps (motion-design.md#wrap-safety).

  Timescales: mood drift ~54 s (independent — palette-cadence register),
  ember rise ~4 s crossing at default speed, bed flicker ~1.2 s, bed breath
  ~7.6 s (motion-design.md#timescale-layering).

  2D strategy: slice at K=0.5 — decision-tree Q1: the ember field is a noise
  phenomenon whose planar cut has the same statistics as the volume, and both
  structural axes (the y-graded coal bed and the y-scrolling rise) live in the
  2D domain, so nothing collapses (2d-parity.md#the-decision-tree).

  Rubric self-check (visual-rubric.md): strongest on "does black mean off"
  (documented floor + valley), palette value-shape, and highlight headroom
  (triple coupling). Two spatial octaves: bed gradient + ember cells sized
  ~0.3 of the sculpture. No deliberate deviations.

  Sliders:
    Speed       rise/flicker rate — low end is a dying overnight fire,
                high end a fresh stoked one
    Brightness  overall intensity
    Heat        fire energy — low end sparse cool embers, high end a
                roaring bed with dense white-hot peaks
*/

var speed = 1
var brightness = 1
var heatGain = 1

export function sliderSpeed(v) { speed = 0.25 + v * 2.25 }
export function sliderBrightness(v) { brightness = v }
export function sliderHeat(v) { heatGain = 0.55 + v * 0.9 }

// Perlin tiles every 8 units, so the rising scroll can wrap mod 8 with no snap.
setPerlinWrap(8, 8, 8)

// Ambient mood anchors: dusk violet <-> deep ember red. Numerically 0.75
// apart, so a naive lerp would sweep through green/cyan — shortest-path
// rotation makes it travel violet -> red-violet -> red instead.
var moodA = 0.78
var moodB = 0.03

var hBg = moodA
var emberScroll = 0
var flickPhase = 0
var breath = 1

export function beforeRender(delta) {
  // Mood drift (~54 s out-and-back): triangle() of the sawtooth is continuous
  // at the wrap. Shortest-path hue lerp, per color-craft.md Fix 1.
  var tMood = triangle(time(0.83))
  var dh = moodB - moodA
  if (dh > 0.5) dh = dh - 1
  if (dh < -0.5) dh = dh + 1
  hBg = moodA + dh * tMood

  // Ember rise: delta-based (frame-rate independent) accumulator, wrapped
  // against the perlin tiling period so the wrap is invisible.
  emberScroll = (emberScroll + delta * 0.0006 * speed) % 8

  // Bed flicker phase (~1.2 s at default speed) — sawtooth used as pure
  // phase into wave(), wrap-safe.
  flickPhase = time(0.0186 / speed)

  // Slow bed breathing, ~7.6 s: the whole coal bed warms and cools slightly.
  breath = 1 + 0.15 * sin(time(0.116) * PI2)
}

export function render3D(index, x, y, z) {
  // Rising ember field: tiled noise scrolled downward in sample space so
  // features move up. 0..1.
  var n = perlin(x * 3, y * 2.5 + 8 - emberScroll, z * 3, 1.7) + 0.5

  // Sparse ember cells; Heat widens/densifies them. Embers cool as they rise.
  var ember = smoothstep(0.68, 0.92, n * (0.7 + 0.45 * heatGain))
  ember = ember * (1 - 0.45 * y)

  // Coal bed: strongest at the base, spatially flickering, breathing.
  var bed = 1 - smoothstep(0, 0.35, y)
  bed = bed * (0.55 + 0.45 * wave(flickPhase + x * 1.7 + z * 1.3))
  bed = bed * breath * heatGain

  var heat = bed + ember
  if (heat > 1) heat = 1

  // Hue: drifting background mood -> ember ramp, shortest path per pixel.
  var hHot = 0.015 + 0.07 * heat
  var dh = hHot - hBg
  if (dh > 0.5) dh = dh - 1
  if (dh < -0.5) dh = dh + 1
  var h = hBg + dh * smoothstep(0.04, 0.4, heat)

  // Triple coupling: s falls only past heat 0.5, hitting white at the peak.
  var s = clamp(2 - 2 * heat, 0, 1)

  // Designed value shape: 0.09 tinted floor, dipping to ~0.03 valley by
  // heat 0.16, then the gamma'd (heat*heat) ramp to full brightness.
  var vFloor = 0.09 - 0.06 * smoothstep(0, 0.16, heat)
  var v = vFloor + heat * heat * 0.97
  hsv(h, s, v * brightness)
}

// 2D strategy: slice K=0.5 (decision-tree Q1 — planar-honest noise field;
// bed and rise both live in (x, y)). See header.
export function render2D(index, x, y) {
  render3D(index, x, y, 0.5)
}

// 1D: a vertical column through the volume — coal bed at the strip's start.
export function render(index) {
  render3D(index, 0.5, index / pixelCount, 0.5)
}
