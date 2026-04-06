// Fireflies
// N glowing point sources that drift slowly through 3D space via Perlin noise.
// Each firefly has a soft distance falloff and independent pulse.
// Controls: Speed (drift rate), Brightness (glow intensity), Count (number of fireflies)

var speed = 0.04
var brightness = 1
var count = 5

export function sliderSpeed(v) { speed = 0.01 + v * 0.1 }
export function sliderBrightness(v) { brightness = v }
export function sliderCount(v) { count = max(1, floor(1 + v * 7)) }

var maxFlies = 8
var fx = array(maxFlies)
var fy = array(maxFlies)
var fz = array(maxFlies)
var fhue = array(maxFlies)
var fpulse = array(maxFlies)

var t1

export function beforeRender(delta) {
  t1 = time(speed * 60) * 256
  for (var i = 0; i < maxFlies; i++) {
    fx[i] = (perlin(t1 * 0.3, i * 73.1, 0, 0) + 0.5)
    fy[i] = (perlin(0, t1 * 0.25, i * 47.3, 1) + 0.5)
    fz[i] = (perlin(i * 31.7, 0, t1 * 0.2, 2) + 0.5)
    fhue[i] = (perlin(i * 17.3, t1 * 0.1, 0, 3) + 0.5) * 0.3 + 0.15
    fpulse[i] = wave(time(speed * (1 + i * 0.3)))
  }
}

export function render3D(index, x, y, z) {
  var totalV = 0
  var closestH = 0
  var closestD = 10

  for (var i = 0; i < count; i++) {
    var d = hypot3(x - fx[i], y - fy[i], z - fz[i])
    var glow = fpulse[i] * 0.015 / (d * d + 0.015)
    totalV += glow
    if (d < closestD) {
      closestD = d
      closestH = fhue[i]
    }
  }

  totalV = min(1, totalV)
  totalV = totalV * totalV * brightness
  hsv(closestH, 0.8, totalV)
}

export function render2D(index, x, y) {
  render3D(index, x, y, 0.5)
}
