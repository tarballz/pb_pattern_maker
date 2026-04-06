// Aurora
// Horizontal wave bands with noise-modulated color and vertical fade.
// Creates a northern-lights effect with shimmering curtains.
// Controls: Speed (animation rate), Brightness (overall intensity), Spread (band width)

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
