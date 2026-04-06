// Expanding Rings
// Concentric shells of light pulsing outward from center.
// Sharp ring edges using smoothstep, multiple simultaneous rings.
// Controls: Speed (expansion rate), Brightness (intensity), Ring Count (simultaneous rings)

var speed = 0.04
var brightness = 1
var ringCount = 3

export function sliderSpeed(v) { speed = 0.01 + v * 0.1 }
export function sliderBrightness(v) { brightness = v }
export function sliderRingCount(v) { ringCount = max(1, floor(1 + v * 6)) }

var t1

export function beforeRender(delta) {
  t1 = time(speed)
}

export function render3D(index, x, y, z) {
  var d = hypot3(x - 0.5, y - 0.5, z - 0.5)
  var ring = wave((d * ringCount - t1) % 1)
  ring = smoothstep(0.3, 0.5, ring)
  var h = d * 2 + t1
  var v = ring * brightness
  v = v * v
  hsv(h, 0.8, v)
}

export function render2D(index, x, y) {
  render3D(index, x, y, 0.5)
}
