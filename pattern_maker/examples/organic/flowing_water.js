// Flowing Water
// Layered sine waves at different frequencies with noise perturbation.
// Creates a liquid, shimmering water surface effect.
// Controls: Speed (flow rate), Brightness (overall intensity), Turbulence (noise amount)

var speed = 0.04
var brightness = 1
var turbulence = 0.3

export function sliderSpeed(v) { speed = 0.01 + v * 0.1 }
export function sliderBrightness(v) { brightness = v }
export function sliderTurbulence(v) { turbulence = v * 0.8 }

var t1, t2, t3

export function beforeRender(delta) {
  t1 = time(speed)
  t2 = time(speed * 1.3)
  t3 = time(speed * 0.7)
}

export function render3D(index, x, y, z) {
  var n = perlin(x * 4, z * 4, t1 * 256, 0) * turbulence

  var w1 = wave(t1 + x * 3 + n)
  var w2 = wave(t2 + z * 2.5 + n * 0.7)
  var w3 = wave(t3 + (x + z) * 2 + n * 0.5)

  var v = (w1 + w2 * 0.6 + w3 * 0.3) / 1.9
  var h = 0.55 + v * 0.1

  var depthFade = smoothstep(0, 0.7, 1 - y)
  v = v * depthFade
  v = v * v * brightness
  hsv(h, 0.6 + v * 0.4, v)
}

export function render2D(index, x, y) {
  render3D(index, x, y, 0.5)
}
