// Fire
// Classic fire effect using heat diffusion with upward propagation.
// Heat rises from the bottom, cools as it goes up, random sparks.
// 2D only — requires vertical axis for heat propagation.
// Controls: Speed (animation rate), Brightness (intensity), Cooling (how fast heat dissipates)

var speed = 0.05
var brightness = 1
var cooling = 0.6

export function sliderSpeed(v) { speed = 0.02 + v * 0.15 }
export function sliderBrightness(v) { brightness = v }
export function sliderCooling(v) { cooling = 0.2 + v * 1.0 }

var cols = 16
var rows = 16
var heat = array(cols * rows)

function idx(col, row) {
  return clamp(col, 0, cols - 1) + clamp(row, 0, rows - 1) * cols
}

export function beforeRender(delta) {
  var dt = delta / 16

  for (var col = 0; col < cols; col++) {
    heat[idx(col, 0)] = 1

    for (var row = rows - 1; row > 0; row--) {
      var below = (heat[idx(col - 1, row - 1)] + heat[idx(col, row - 1)] + heat[idx(col + 1, row - 1)]) / 3
      heat[idx(col, row)] = max(0, below - cooling / rows * dt - random(0.01))
    }
  }
}

export function render2D(index, x, y) {
  var col = floor(x * cols)
  var row = floor((1 - y) * rows)
  var h = heat[idx(col, row)]
  var hue = h * 0.12
  var sat = 1 - h * 0.4
  hsv(hue, sat, h * h * brightness)
}
