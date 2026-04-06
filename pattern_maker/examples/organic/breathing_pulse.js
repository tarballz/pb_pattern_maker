// Breathing Pulse
// Gentle pulsing glow that radiates from center, like a heartbeat.
// Distance from center modulated by a slow sine, gamma-corrected.
// Controls: Speed (animation rate), Brightness (overall intensity), Hue (color)

var speed = 0.05
var brightness = 1
var baseHue = 0.6

export function sliderSpeed(v) { speed = 0.01 + v * 0.1 }
export function sliderBrightness(v) { brightness = v }
export function sliderHue(v) { baseHue = v }

var t1, t2

export function beforeRender(delta) {
  t1 = wave(time(speed))
  t2 = wave(time(speed * 0.7))
}

export function render3D(index, x, y, z) {
  var d = hypot3(x - 0.5, y - 0.5, z - 0.5)
  var pulse = t1 * 0.7 + t2 * 0.3
  var v = max(0, pulse - d * 2)
  v = v * v * v * brightness
  hsv(baseHue + d * 0.1, 0.8, v)
}

export function render2D(index, x, y) {
  render3D(index, x, y, 0.5)
}
