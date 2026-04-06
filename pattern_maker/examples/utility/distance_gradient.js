// Distance Gradient
// White gradient from center outward. Bright at center, dark at edges.
// Use to verify map centering and scale.
// Controls: Brightness (slider), Falloff (slider)

var brightness = 1
var falloff = 2

export function sliderBrightness(v) { brightness = v }
export function sliderFalloff(v) { falloff = 1 + v * 5 }

export function beforeRender(delta) {}

export function render3D(index, x, y, z) {
  var d = hypot3(x - 0.5, y - 0.5, z - 0.5)
  var v = max(0, 1 - d * falloff)
  v = v * v * brightness
  hsv(0, 0, v)
}

export function render2D(index, x, y) {
  render3D(index, x, y, 0.5)
}
