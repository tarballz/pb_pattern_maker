// Spinning Planes
// A glowing plane that rotates through 3D space.
// Dot product of position with a rotating normal vector creates the sweep.
// Controls: Speed (rotation rate), Brightness (intensity), Thickness (plane width)

var speed = 0.04
var brightness = 1
var thickness = 8

export function sliderSpeed(v) { speed = 0.01 + v * 0.1 }
export function sliderBrightness(v) { brightness = v }
export function sliderThickness(v) { thickness = 2 + v * 15 }

var nx, ny, nz

export function beforeRender(delta) {
  var a = time(speed) * PI2
  var b = time(speed * 0.7) * PI2
  nx = sin(a) * cos(b)
  ny = sin(b)
  nz = cos(a) * cos(b)
}

export function render3D(index, x, y, z) {
  var dot = (x - 0.5) * nx + (y - 0.5) * ny + (z - 0.5) * nz
  var v = max(0, 1 - abs(dot) * thickness)
  v = v * v * brightness
  var h = dot + 0.5
  hsv(h, 0.7, v)
}

export function render2D(index, x, y) {
  render3D(index, x, y, 0.5)
}
