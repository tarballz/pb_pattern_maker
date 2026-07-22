/*
  Voronoi Cells

  Colored crystal cells that tile the whole volume, their dark boundary
  walls gliding as the invisible seed points bounce around the bounding box.
  Each pixel belongs to its nearest seed and wears that seed's fixed hue;
  brightness falls to black along the ridge where two cells meet, so the
  sculpture reads as slowly reshaping stained glass.

  Techniques demonstrated:
    - Delta-based motion: seed positions integrate delta * speed each frame,
      so the bounce runs at the same wall-clock rate on a 40 FPS map or a
      400 FPS strip (motion-design.md#speed-as-register).
    - Edge shading from the nearest/second-nearest distance difference:
      smoothstep(0, 0.04, secondD - minD) is the smoothstep-shell falloff,
      width sized near LED pitch so borders stay crisp without aliasing
      (composition.md#foreground-shapes--falloffs).
    - Per-element variation: each seed carries its own velocity vector and
      hue, so cells never move in lockstep
      (motion-design.md#drift-vs-events, per-element jitter).
    - Voronoi budget: 6 seed slots max with hypot3 per seed per pixel — the
      documented practical ceiling at 1000+ LEDs
      (references/safety-rules.md, performance budget).
    - Quadratic gamma on v before output (color-craft.md#gamma-as-aesthetics).

  2D strategy: slice at K=0.5 — decision-tree Q2: Voronoi level sets are
  separable, and a planar cut of a 3D Voronoi diagram is a true 2D Voronoi
  diagram (the doc's own Q2 example). K=0.5 crosses the action: seeds roam
  the full 0..1 box on every axis, so the slice plane always intersects
  live cells — no pulsars-style dead-plane failure
  (2d-parity.md#the-decision-tree, #known-failure-classes class 2).

  Known deviations vs the reference docs (documented per visual-rubric.md;
  geometric register, code intentionally left as-is):
    - Six evenly spaced rainbow hues instead of one or two hue families —
      a deliberate geometric-register deviation; the cells stay legible
      because they are spatially separated, not overlapped
      (color-craft.md#hue-relationships-on-leds).
    - Cell borders fall to true black: intentional negative space (the
      walls ARE the structure), the documented exception to the colored
      floor rule (color-craft.md#background-is-a-color-decision).
    - Single positional timescale: per-seed velocities differ but occupy
      one speed band, and there is no event or breathing layer — borderline
      against motion-design.md#timescale-layering; a slow global hue or
      brightness drift would be the doc-conformant fix.

  Sliders:
    Speed       bounce rate
    Brightness  overall intensity
    Cells       number of live seeds (2-6; fewer = larger crystals)
*/

var speed = 0.04
var brightness = 1
var cellCount = 4

export function sliderSpeed(v) { speed = 0.01 + v * 0.1 }
export function sliderBrightness(v) { brightness = v }
export function sliderCells(v) { cellCount = max(2, floor(2 + v * 4)) }

var maxCells = 6
var cx = array(maxCells)
var cy = array(maxCells)
var cz = array(maxCells)
var vx = array(maxCells)
var vy = array(maxCells)
var vz = array(maxCells)
var ch = array(maxCells)

// Initialize velocities and hues with fixed values
vx[0] = 0.3;  vy[0] = 0.2;  vz[0] = 0.15; ch[0] = 0.0
vx[1] = -0.2; vy[1] = 0.3;  vz[1] = -0.2; ch[1] = 0.17
vx[2] = 0.15; vy[2] = -0.25; vz[2] = 0.3; ch[2] = 0.33
vx[3] = -0.3; vy[3] = -0.15; vz[3] = 0.2; ch[3] = 0.5
vx[4] = 0.25; vy[4] = 0.1;  vz[4] = -0.3; ch[4] = 0.67
vx[5] = -0.1; vy[5] = -0.3; vz[5] = -0.15; ch[5] = 0.83

// Initialize positions
cx[0] = 0.3; cy[0] = 0.4; cz[0] = 0.5
cx[1] = 0.7; cy[1] = 0.6; cz[1] = 0.5
cx[2] = 0.5; cy[2] = 0.3; cz[2] = 0.3
cx[3] = 0.4; cy[3] = 0.7; cz[3] = 0.7
cx[4] = 0.6; cy[4] = 0.5; cz[4] = 0.4
cx[5] = 0.5; cy[5] = 0.5; cz[5] = 0.6

export function beforeRender(delta) {
  var dt = delta * speed * 0.05
  for (var i = 0; i < maxCells; i++) {
    cx[i] += vx[i] * dt
    cy[i] += vy[i] * dt
    cz[i] += vz[i] * dt
    if (cx[i] < 0 || cx[i] > 1) vx[i] = -vx[i]
    if (cy[i] < 0 || cy[i] > 1) vy[i] = -vy[i]
    if (cz[i] < 0 || cz[i] > 1) vz[i] = -vz[i]
    cx[i] = clamp(cx[i], 0, 1)
    cy[i] = clamp(cy[i], 0, 1)
    cz[i] = clamp(cz[i], 0, 1)
  }
}

export function render3D(index, x, y, z) {
  var minD = 10
  var minI = 0
  var secondD = 10
  for (var i = 0; i < cellCount; i++) {
    var d = hypot3(x - cx[i], y - cy[i], z - cz[i])
    if (d < minD) {
      secondD = minD
      minD = d
      minI = i
    } else if (d < secondD) {
      secondD = d
    }
  }
  var edge = smoothstep(0, 0.04, secondD - minD)
  var v = edge * brightness
  v = v * v
  hsv(ch[minI], 0.8, v)
}

export function render2D(index, x, y) {
  render3D(index, x, y, 0.5)
}
