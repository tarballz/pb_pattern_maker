// Wave Interference
// Multiple wave sources at fixed positions, amplitudes summed.
// Creates interference patterns (constructive/destructive) like ripples in a pond.
// Controls: Speed (wave rate), Brightness (intensity), Sources (number of wave origins)

var speed = 0.04
var brightness = 1
var sourceCount = 3

export function sliderSpeed(v) { speed = 0.01 + v * 0.1 }
export function sliderBrightness(v) { brightness = v }
export function sliderSources(v) { sourceCount = max(2, floor(2 + v * 4)) }

var maxSources = 6
var sx = array(maxSources)
var sy = array(maxSources)
var sz = array(maxSources)

sx[0] = 0.2; sy[0] = 0.5; sz[0] = 0.5
sx[1] = 0.8; sy[1] = 0.5; sz[1] = 0.5
sx[2] = 0.5; sy[2] = 0.2; sz[2] = 0.5
sx[3] = 0.5; sy[3] = 0.8; sz[3] = 0.5
sx[4] = 0.5; sy[4] = 0.5; sz[4] = 0.2
sx[5] = 0.5; sy[5] = 0.5; sz[5] = 0.8

var t1

export function beforeRender(delta) {
  t1 = time(speed)
}

export function render3D(index, x, y, z) {
  var sum = 0
  for (var i = 0; i < sourceCount; i++) {
    var d = hypot3(x - sx[i], y - sy[i], z - sz[i])
    sum += wave(d * 8 - t1)
  }
  sum = sum / sourceCount
  var h = sum * 0.5 + t1
  var v = sum * sum * brightness
  hsv(h, 0.8, v)
}

export function render2D(index, x, y) {
  render3D(index, x, y, 0.5)
}
