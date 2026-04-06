// Kaleidoscope
// Polar coordinate folding with noise fill.
// Divides the angular space into segments and mirrors them.
// Controls: Speed (rotation rate), Brightness (intensity), Segments (mirror count)

var speed = 0.04
var brightness = 1
var segments = 6

export function sliderSpeed(v) { speed = 0.01 + v * 0.1 }
export function sliderBrightness(v) { brightness = v }
export function sliderSegments(v) { segments = max(2, floor(2 + v * 10)) }

var noiseTime

export function beforeRender(delta) {
  noiseTime = time(speed * 80) * 256
}

export function render3D(index, x, y, z) {
  var cx = x - 0.5
  var cz = z - 0.5
  var angle = atan2(cz, cx) / PI2 + 0.5
  var radius = hypot(cx, cz)

  var segAngle = angle * segments
  segAngle = triangle(segAngle % 1)

  var nx = segAngle * 4
  var ny = radius * 4 + y * 2
  var n = perlin(nx + noiseTime, ny, 0, 0) + 0.5

  var h = n + radius
  var v = n * smoothstep(0.02, 0.15, radius)
  v = v * v * brightness
  hsv(h, 0.85, v)
}

export function render2D(index, x, y) {
  var cx = x - 0.5
  var cy = y - 0.5
  var angle = atan2(cy, cx) / PI2 + 0.5
  var radius = hypot(cx, cy)

  var segAngle = angle * segments
  segAngle = triangle(segAngle % 1)

  var nx = segAngle * 4
  var ny = radius * 4
  var n = perlin(nx + noiseTime, ny, 0, 0) + 0.5

  var h = n + radius
  var v = n * smoothstep(0.02, 0.15, radius)
  v = v * v * brightness
  hsv(h, 0.85, v)
}
