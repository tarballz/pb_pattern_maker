// Solid Color
// Displays a single solid color on all LEDs.
// Use to verify device connectivity and color output.
// Controls: Color (HSV picker), Brightness (slider)

var h = 0, s = 1, v = 1
var brightness = 1

export function hsvPickerColor(_h, _s, _v) { h = _h; s = _s; v = _v }
export function sliderBrightness(_v) { brightness = _v }

export function beforeRender(delta) {}

export function render3D(index, x, y, z) {
  hsv(h, s, v * brightness)
}

export function render2D(index, x, y) {
  render3D(index, x, y, 0)
}

export function render(index) {
  hsv(h, s, v * brightness)
}
