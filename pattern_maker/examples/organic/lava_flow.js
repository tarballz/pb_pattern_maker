// Lava Flow
// Organic flowing color using dual Perlin noise layers.
// One noise layer controls hue, another controls brightness.
// Animated by drifting coordinates through noise space on independent axes.
// Controls: Speed (animation rate), Brightness (overall intensity), Scale (noise detail)

var speed = 0.05
var brightness = 1
var noiseScale = 3

export function sliderSpeed(v) { speed = 0.02 + v * 0.15 }
export function sliderBrightness(v) { brightness = v }
export function sliderScale(v) { noiseScale = 1 + v * 6 }

var noiseTime

export function beforeRender(delta) {
  noiseTime = time(speed * 100) * 256
}

export function render3D(index, x, y, z) {
  var sx = x * noiseScale
  var sy = y * noiseScale
  var sz = z * noiseScale

  var h = perlin(sx - noiseTime, sy, sz, 0)
  var v = perlin(sx, sy, sz - noiseTime, 1)

  h = h + 0.5
  v = (v + 0.5)
  v = v * v * v * brightness
  hsv(h, 1, v)
}

export function render2D(index, x, y) {
  render3D(index, x, y, 0.5)
}
