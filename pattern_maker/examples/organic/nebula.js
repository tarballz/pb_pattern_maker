// Nebula
// Multi-octave fractal Brownian motion with slow coordinate drift.
// Creates deep-space nebula clouds with rich color variation.
// Controls: Speed (drift rate), Brightness (overall intensity), Detail (FBM octaves mapped to scale)

var speed = 0.03
var brightness = 1
var detail = 4

export function sliderSpeed(v) { speed = 0.01 + v * 0.08 }
export function sliderBrightness(v) { brightness = v }
export function sliderDetail(v) { detail = 2 + v * 4 }

var noiseTime

export function beforeRender(delta) {
  noiseTime = time(speed * 80) * 256
}

export function render3D(index, x, y, z) {
  var sx = x * detail
  var sy = y * detail
  var sz = z * detail

  var n1 = perlin(sx + noiseTime * 0.3, sy, sz - noiseTime * 0.2, 0)
  var n2 = perlin(sx, sy - noiseTime * 0.25, sz, 1)
  var n3 = perlin(sx - noiseTime * 0.15, sy + noiseTime * 0.1, sz, 2)

  var h = (n1 + 0.5) * 0.8 + 0.1
  var s = 0.7 + (n2 + 0.5) * 0.3
  var v = (n3 + 0.5)
  v = v * v * v * brightness
  hsv(h, s, v)
}

export function render2D(index, x, y) {
  render3D(index, x, y, 0.5)
}
