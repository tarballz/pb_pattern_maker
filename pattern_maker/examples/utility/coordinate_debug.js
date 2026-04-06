// Coordinate Debug
// R = X axis, G = Y axis, B = Z axis.
// Use to verify map orientation and axis alignment.
// Controls: Brightness (slider)

var brightness = 1

export function sliderBrightness(v) { brightness = v }

export function beforeRender(delta) {}

export function render3D(index, x, y, z) {
  rgb(x * brightness, y * brightness, z * brightness)
}

export function render2D(index, x, y) {
  render3D(index, x, y, 0)
}
