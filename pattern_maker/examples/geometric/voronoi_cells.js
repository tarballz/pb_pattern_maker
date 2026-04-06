// Voronoi Cells
// N seed points bouncing in the bounding box, nearest-distance coloring.
// Each pixel is colored by its nearest seed point.
// Controls: Speed (bounce rate), Brightness (intensity), Cells (number of seeds)

var speed = 0.04
var brightness = 1
var cellCount = 4

export function sliderSpeed(v) { speed = 0.01 + v * 0.1 }
export function sliderBrightness(v) { brightness = v }
export function sliderCells(v) { cellCount = max(2, floor(2 + v * 4)) }

var maxCells = 6
var cx = array(maxCells)
var cy = array(maxCells)
var cz = array(maxCells)
var vx = array(maxCells)
var vy = array(maxCells)
var vz = array(maxCells)
var ch = array(maxCells)

// Initialize velocities and hues with fixed values
vx[0] = 0.3;  vy[0] = 0.2;  vz[0] = 0.15; ch[0] = 0.0
vx[1] = -0.2; vy[1] = 0.3;  vz[1] = -0.2; ch[1] = 0.17
vx[2] = 0.15; vy[2] = -0.25; vz[2] = 0.3; ch[2] = 0.33
vx[3] = -0.3; vy[3] = -0.15; vz[3] = 0.2; ch[3] = 0.5
vx[4] = 0.25; vy[4] = 0.1;  vz[4] = -0.3; ch[4] = 0.67
vx[5] = -0.1; vy[5] = -0.3; vz[5] = -0.15; ch[5] = 0.83

// Initialize positions
cx[0] = 0.3; cy[0] = 0.4; cz[0] = 0.5
cx[1] = 0.7; cy[1] = 0.6; cz[1] = 0.5
cx[2] = 0.5; cy[2] = 0.3; cz[2] = 0.3
cx[3] = 0.4; cy[3] = 0.7; cz[3] = 0.7
cx[4] = 0.6; cy[4] = 0.5; cz[4] = 0.4
cx[5] = 0.5; cy[5] = 0.5; cz[5] = 0.6

export function beforeRender(delta) {
  var dt = delta * speed * 0.05
  for (var i = 0; i < maxCells; i++) {
    cx[i] += vx[i] * dt
    cy[i] += vy[i] * dt
    cz[i] += vz[i] * dt
    if (cx[i] < 0 || cx[i] > 1) vx[i] = -vx[i]
    if (cy[i] < 0 || cy[i] > 1) vy[i] = -vy[i]
    if (cz[i] < 0 || cz[i] > 1) vz[i] = -vz[i]
    cx[i] = clamp(cx[i], 0, 1)
    cy[i] = clamp(cy[i], 0, 1)
    cz[i] = clamp(cz[i], 0, 1)
  }
}

export function render3D(index, x, y, z) {
  var minD = 10
  var minI = 0
  var secondD = 10
  for (var i = 0; i < cellCount; i++) {
    var d = hypot3(x - cx[i], y - cy[i], z - cz[i])
    if (d < minD) {
      secondD = minD
      minD = d
      minI = i
    } else if (d < secondD) {
      secondD = d
    }
  }
  var edge = smoothstep(0, 0.04, secondD - minD)
  var v = edge * brightness
  v = v * v
  hsv(ch[minI], 0.8, v)
}

export function render2D(index, x, y) {
  render3D(index, x, y, 0.5)
}
