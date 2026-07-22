/*
  Beacon Sweep  (composition + 2D-parity showcase)

  A lighthouse on the egg. A warm gold beam sweeps around the vertical axis
  every ~9 s, riding at a height that wanders slowly up and down the
  sculpture, so the bright "front" visits every azimuth and every latitude
  in turn. Behind it, dim indigo bands counter-rotate at a fifth of the
  speed — the harbor night the beam cuts through. Where the beam head
  passes, small warm-white glints ignite and fade, like windows catching
  the light.

  Techniques demonstrated:
    - The three-layer stack with per-layer brightness ceilings: background
      bands 0.10-0.30, beam capped at 0.8, glints the only layer allowed
      v = 1.0; accents are spawned at the beam head, so the layers feed each
      other instead of running three screensavers
      (composition.md#the-layer-stack).
    - Correct compositing math: bg and beam combine with screen()
      (a + b - a*b, never clips); glints use conditional overwrite —
      the two ops chosen from the table for exactly these jobs
      (composition.md#compositing-math-in-0-1).
    - Wandering focal hotspot: the beam-head locus (azimuth x wandering
      height) modulates brightness (0.6 + 0.4*focus) and receives the accent
      spawns, so every viewing angle periodically gets the "front"
      (composition.md#focal-interest-without-a-frame).
    - Depth via differential rotation: background bands counter-rotate
      against the beam sweep — the 3D-parallax device, opposing senses
      (composition.md#depth-on-a-real-3d-sculpture).
    - Sparse events with fast-attack/slow-decay envelopes (expImpulse k=10)
      over a continuous sweep baseline (motion-design.md#drift-vs-events,
      #asymmetric-easing).
    - Two-hue-family palette (indigo night / gold beam) with a designed
      value shape: dark blue half for the background layer, warm bright
      half for the subject (color-craft.md#palette-craft,
      #hue-relationships-on-leds).

  2D strategy: RE-PARAMETERIZE (decision-tree Q3). Walking the tree:
    Q1 — not a noise/field phenomenon: the subject is a structured azimuthal
         lobe, a slice does not share its statistics. No.
    Q2 — level sets are not spheres/planes/shells: the beam's level sets are
         half-planes hinged on the vertical axis. No.
    Q3 — the whole concept is azimuthal (atan2 around the y axis): YES.
    A z=0.5 slice would be the classic azimuth collapse
    (2d-parity.md#known-failure-classes, class 1): atan2(z-0.5, x-0.5)
    becomes atan2(0, x-0.5), a two-valued step — the sweep degenerates into
    the left/right half-panel blinking on and off once per revolution.
    Instead render2D re-derives the angle around the panel's own center
    (atan2(y-0.5, x-0.5)): the beam becomes a radial spoke sweeping like a
    radar arm, the height axis maps to radius (bands become rings, the focal
    height becomes a focal ring), and glints are re-anchored into the 2D
    domain from their spawn azimuth/height (2d-parity.md workflow item 5) —
    precomputed in beforeRender, nothing pops silently.

  Rubric self-check (visual-rubric.md): strongest on deliberate 2D strategy,
  layer restraint (fill well under ~25%, glints far under 5%), and focal
  rhythm. Deliberate deviations, geometric register: no breathing layer —
  the sweep plus the glint event/decay layer carry the idle instead; and the
  beam crossing (~9 s revolution) sits at the fast edge of meditative, as a
  lighthouse should. Timescales: sweep ~9.2 s, counter-rotation ~52 s
  (5.7x apart), height wander ~34 s (positional pacing, not a speed layer),
  glint events ~1 s — all wrap-safe: the sweep sawtooth maps to a circular
  azimuth (wrap 1->0 is the same angle), the rest pass through wave()/sin().

  Sliders:
    Speed       sweep tempo — low end a drowsy harbor, high end a radar sweep
    Brightness  overall intensity
    Width       beam aperture — low end a knife-edge blade, high end a soft
                wide lobe
*/

var speed = 1
var brightness = 1
var beamW = 0.075

export function sliderSpeed(v) { speed = 0.3 + v * 2.2 }
export function sliderBrightness(v) { brightness = v }
export function sliderWidth(v) { beamW = 0.03 + v * 0.15 }

// Night-harbor palette: indigo half (background bands live in 0-0.45),
// amber/gold half (beam, 0.68-1.0), warm-white glint crest at the top.
var harbor = [
  0.00, 0.010, 0.012, 0.060,
  0.22, 0.015, 0.040, 0.120,
  0.45, 0.030, 0.100, 0.180,
  0.68, 0.550, 0.380, 0.080,
  0.86, 0.950, 0.700, 0.180,
  1.00, 1.000, 0.930, 0.600,
]
setPalette(harbor)

// Glint slots — allocated once, reused. g2x/g2y are the same glints
// re-anchored into the 2D domain (angle kept, height -> radius).
var NUM_GLINT = 4
var gx = array(NUM_GLINT)
var gy = array(NUM_GLINT)
var gz = array(NUM_GLINT)
var g2x = array(NUM_GLINT)
var g2y = array(NUM_GLINT)
var gAge = array(NUM_GLINT)
var gEnv = array(NUM_GLINT)

var i
for (i = 0; i < NUM_GLINT; i++) gAge[i] = 30000

// iq's expImpulse: fast attack, slow decay, peaks at t = 1/k.
function expImpulse(t, k) { var hh = k * t; return hh * exp(1 - hh) }

// Screen composite: add-like, asymptotic to 1, never clips.
function screen(a, b) { return a + b - a * b }

var beamPos = 0, bgPhase = 0, focH = 0.5
var glintMs = 900

export function beforeRender(delta) {
  // Sweep: the sawtooth IS the azimuth — angle space is circular, so the
  // 1 -> 0 wrap lands on the same angle. Wrap-safe by construction.
  beamPos = time(0.1397 / speed)
  // Counter-rotating background, ~5.7x slower than the sweep.
  bgPhase = time(0.79 / speed)
  // Focal height wanders the whole sculpture over ~34 s (wrap-safe via sin).
  focH = 0.5 + 0.27 * sin(time(0.5225) * PI2)

  // Glint spawner: Poisson-ish, positions clustered at the beam head so the
  // accent layer is fed by the subject layer.
  if (random(1) < delta / glintMs) {
    var s = 0
    if (gEnv[1] < gEnv[s]) s = 1
    if (gEnv[2] < gEnv[s]) s = 2
    if (gEnv[3] < gEnv[s]) s = 3
    var az = beamPos + random(0.14) - 0.07
    var ca = cos(az * PI2)
    var sa = sin(az * PI2)
    var gh = clamp(focH + random(0.3) - 0.15, 0.06, 0.94)
    gx[s] = 0.5 + 0.36 * ca   // on the shell, near the beam azimuth
    gy[s] = gh
    gz[s] = 0.5 + 0.36 * sa
    g2x[s] = 0.5 + gh * 0.6 * ca   // 2D re-anchor: same angle, height -> radius
    g2y[s] = 0.5 + gh * 0.6 * sa
    gAge[s] = 0
  }
  for (i = 0; i < NUM_GLINT; i++) {
    if (gAge[i] < 25000) gAge[i] = gAge[i] + delta  // cap: no ms overflow
    gEnv[i] = expImpulse(gAge[i] * 0.001, 10)
  }
}

export function render3D(index, x, y, z) {
  var cx = x - 0.5
  var cz = z - 0.5
  var a = atan2(cz, cx) / PI2 + 0.5   // azimuth around the vertical axis
  var axisR = hypot(cx, cz)

  // L1 — background bands, 0.10..0.30. Integer azimuth frequency (2) keeps
  // the wave seamless around the sculpture; +bgPhase counter-rotates.
  var bg = 0.10 + 0.20 * wave(a * 2 + y * 1.5 + bgPhase)

  // L2 — the beam: wrap-aware angular distance, soft aperture, tapered
  // toward the wandering focal height. Azimuth is undefined at the poles,
  // so the lobe fades out near the axis.
  var d = abs(a - beamPos)
  if (d > 0.5) d = 1 - d
  var lobe = 1 - smoothstep(beamW * 0.25, beamW, d)
  lobe = lobe * smoothstep(0.02, 0.10, axisR)
  var hProx = 1 - smoothstep(0, 0.55, abs(y - focH))
  var mid = 0.8 * lobe * (0.35 + 0.65 * hProx)

  // Focal hotspot scalar: beam head x focal height.
  var focus = lobe * hProx

  // L3 — glints: tiny finite-support points (no sqrt), envelope-driven.
  var g = 0
  var k, dx, dy, dz, d2, fall
  for (k = 0; k < NUM_GLINT; k++) {
    if (gEnv[k] > 0.01) {
      dx = x - gx[k]
      dy = y - gy[k]
      dz = z - gz[k]
      d2 = dx * dx + dy * dy + dz * dz
      fall = 1 - d2 * 220
      if (fall > 0) g = g + fall * fall * gEnv[k]
    }
  }

  var vv = screen(bg, mid)
  vv = vv * (0.6 + 0.4 * focus)   // hotspot brightness modulation

  if (g > 0.3) {
    // Conditional overwrite: glints replace, they don't blend.
    paint(0.98, min((0.55 + g * 0.45) * brightness, 1))
  } else {
    // Palette position: background value maps into the indigo half, the
    // beam pushes it into the gold half.
    var pos = 0.04 + bg * 1.3
    var m = mid * 1.25
    pos = pos + (0.92 - pos) * m
    var v = 0.03 + vv * vv * 0.97   // gamma last, over a colored floor
    paint(pos, min(v * brightness, 1))
  }
}

// 2D — RE-PARAMETERIZED, not sliced (see header): angle re-derived around
// the panel center, height -> radius, glints read from their 2D anchors.
export function render2D(index, x, y) {
  var cx = x - 0.5
  var cy = y - 0.5
  var a = atan2(cy, cx) / PI2 + 0.5
  var r = hypot(cx, cy)

  // Bands become rings; same counter-rotation.
  var bg = 0.10 + 0.20 * wave(a * 2 + r * 2.2 + bgPhase)

  // Beam becomes a radar spoke; focal height becomes a focal ring.
  var d = abs(a - beamPos)
  if (d > 0.5) d = 1 - d
  var lobe = 1 - smoothstep(beamW * 0.25, beamW, d)
  lobe = lobe * smoothstep(0.02, 0.10, r)   // angle degenerates at the center
  var focR = focH * 0.6
  var hProx = 1 - smoothstep(0, 0.35, abs(r - focR))
  var mid = 0.8 * lobe * (0.35 + 0.65 * hProx)
  var focus = lobe * hProx

  var g = 0
  var k, dx, dy, d2, fall
  for (k = 0; k < NUM_GLINT; k++) {
    if (gEnv[k] > 0.01) {
      dx = x - g2x[k]
      dy = y - g2y[k]
      d2 = dx * dx + dy * dy
      fall = 1 - d2 * 220
      if (fall > 0) g = g + fall * fall * gEnv[k]
    }
  }

  var vv = screen(bg, mid)
  vv = vv * (0.6 + 0.4 * focus)

  if (g > 0.3) {
    paint(0.98, min((0.55 + g * 0.45) * brightness, 1))
  } else {
    var pos = 0.04 + bg * 1.3
    var m = mid * 1.25
    pos = pos + (0.92 - pos) * m
    var v = 0.03 + vv * vv * 0.97
    paint(pos, min(v * brightness, 1))
  }
}

// 1D: the strip is the azimuth ring itself — beam and bands sweep along it.
// Glints omitted here (their anchors are 2D/3D); documented, not silent.
export function render(index) {
  var p = index / pixelCount
  var bg = 0.10 + 0.20 * wave(p * 2 + bgPhase)
  var d = abs(p - beamPos)
  if (d > 0.5) d = 1 - d
  var lobe = 1 - smoothstep(beamW * 0.25, beamW, d)
  var mid = 0.8 * lobe
  var vv = screen(bg, mid)
  var pos = 0.04 + bg * 1.3
  var m = mid * 1.25
  pos = pos + (0.92 - pos) * m
  var v = 0.03 + vv * vv * 0.97
  paint(pos, min(v * brightness, 1))
}
