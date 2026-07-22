/*
  Aurora

  Northern-lights curtains: a perlin field warps the phase of a slow wave so
  vertical curtains of teal-green light ripple and fold across the sculpture,
  brightest overhead and fading toward the base, with a fine fast shimmer
  playing over the sheets like charged air.

  Techniques demonstrated:
    - Noise-warped waveform: curtain = wave(t1 + n + x*2) — the perlin field
      displaces the wave's phase, turning a mechanical band into a folding
      sheet ("regular irregularity", motion-design.md#drift-vs-events).
    - Two spatial octaves: the Spread-scale curtain field plus an 8x-frequency
      shimmer detail layer, multiplied in — the two-octave budget, not five
      (composition.md#scale-contrast-two-octaves-not-five).
    - Axial density gradient: smoothstep(0, 0.6, y) grades activity from a
      quiet base to an active crown — the one landmark all viewers share
      (composition.md#focal-interest-without-a-frame).
    - Two timescales: slow curtain drift (t1) vs fast noise scroll
      (noiseTime) (motion-design.md#timescale-layering).
    - One narrow hue family: h = 0.45 + n*0.15 keeps everything in the
      teal/green band with noise-driven variation, avoiding the multi-hue
      balance trap (color-craft.md#hue-relationships-on-leds).
    - Raw hsv() with the doc's stated exception: hue and saturation are both
      live per-pixel noise fields a 1-D palette can't carry
      (color-craft.md#palette-craft, decision guide).
    - Quadratic gamma on v before output (color-craft.md#gamma-as-aesthetics).

  2D strategy: slice at K=0.5 — decision-tree Q1: the curtain field is a
  noise phenomenon (planar cut keeps its statistics), and both structural
  axes — the x-driven curtain phase and the y vertical fade — live in the 2D
  domain, so nothing collapses (2d-parity.md#the-decision-tree).

  Known deviations vs the reference docs (documented per visual-rubric.md;
  code intentionally left as-is — this file predates the docs and is kept
  as a reference implementation):
    - noiseTime = time(speed*50) * 256 builds a raw scroll position from the
      sawtooth: the field snaps every ~131 s at default speed — the exact
      bug class in motion-design.md#wrap-safety. The conformant fix is a
      delta-accumulated scroll wrapped against setPerlinWrap (see
      examples/organic/ember_drift.js).
    - Below the vertical fade and between curtains, v reaches true black —
      treat the dark sky gaps as the intentional-void exception, but a
      tinted floor per color-craft.md#background-is-a-color-decision would
      be the house-default choice.

  Sliders:
    Speed       curtain drift rate
    Brightness  overall intensity
    Spread      band width / noise scale (low = broad sheets, high = ribbons)
*/

var speed = 0.04
var brightness = 1
var spread = 3

export function sliderSpeed(v) { speed = 0.01 + v * 0.1 }
export function sliderBrightness(v) { brightness = v }
export function sliderSpread(v) { spread = 1 + v * 6 }

var t1, noiseTime

export function beforeRender(delta) {
  t1 = time(speed)
  noiseTime = time(speed * 50) * 256
}

export function render3D(index, x, y, z) {
  var n = perlin(x * spread + noiseTime, z * spread, 0, 0)
  var curtain = wave(t1 + n + x * 2)

  var verticalFade = smoothstep(0, 0.6, y)
  var shimmer = perlin(x * 8, y * 4, z * 4 - noiseTime * 0.5, 1) + 0.5

  var h = 0.45 + n * 0.15
  var v = curtain * verticalFade * shimmer
  v = v * v * brightness
  hsv(h, 0.7 + shimmer * 0.3, v)
}

export function render2D(index, x, y) {
  render3D(index, x, y, 0.5)
}
