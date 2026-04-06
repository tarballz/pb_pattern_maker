// Helix Spiral
// Rotating helix bands wrapping around the vertical axis.
// Uses atan2 angle + z-offset to create spiral geometry.
// 3D only — requires vertical axis and radial symmetry.
// Controls: Speed (rotation rate), Brightness (intensity), Twist (helix tightness)

var speed = 0.05
var brightness = 1
var twist = 3

export function sliderSpeed(v) { speed = 0.01 + v * 0.1 }
export function sliderBrightness(v) { brightness = v }
export function sliderTwist(v) { twist = 1 + v * 8 }

var t1

export function beforeRender(delta) {
  t1 = time(speed)
}

export function render3D(index, x, y, z) {
  var angle = atan2(z - 0.5, x - 0.5) / PI2 + 0.5
  var spiral = (angle + y * twist + t1) % 1
  var band = wave(spiral)
  band = smoothstep(0.3, 0.6, band)
  var radius = hypot(x - 0.5, z - 0.5)
  var h = y + t1 * 0.5
  var v = band * brightness * smoothstep(0.05, 0.2, radius)
  v = v * v
  hsv(h, 0.9, v)
}
