/*
 Mandelbrot (2D) / surface-wrapped Mandelbrot (3D)

 2D: the classic Mandelbrot iteration z = z^2 + c.

 3D: the same 2D Mandelbrot iteration, sampled on the egg's surface via
 cylindrical coordinates — `theta = atan2(z-0.5, x-0.5)` drives the real
 axis (seamless wrap at the back), `y` drives the imaginary axis. Keeps
 spatial coherence across the egg; a true volumetric Mandelbulb leaves
 only noise on a 2D shell because its interesting detail lives inside a
 3D volume the LEDs can't sample.

 Version  Author        Date
 1.0.0    JEM(ZRanger1) 12/08/2020 (original 2D)
 2D/3D port
*/

export var maxIterations = 15;
export var maxIterations3 = 6;

var cR = -0.94299;
var cI = 0.3162;

var cX, cY;
var t1, t2;

// Per-LED azimuth cache for render3D. Sentinel -999 = not yet cached
// (real thetas ∈ [-PI, PI]).
var thetaCache = array(pixelCount)
for (i = 0; i < pixelCount; i++) thetaCache[i] = -999

export function sliderIterations(v) {
  maxIterations = 5 + floor(v * 12);
  // in 3D, keep it lower for perf (atan2 cache amortises but the
  // iteration loop still dominates per-frame cost)
  maxIterations3 = 3 + floor(v * 9);
}

export function beforeRender(delta) {
  t1 = (triangle(time(0.2)) - 0.5) * 2.4;
  t2 = time(0.05);

  cX = cR + t1;
  cY = cI + (t1 / 2.5);
}

export function render2D(index, x, y) {
  x = x - 0.5; y = y - 0.5;

  for (var iter = 0; iter < maxIterations; iter++) {
    x2 = x * x; y2 = y * y;
    if ((x2 + y2) > 4) break;

    var fX = x2 - y2 + cX;
    var fY = 2 * x * y + cY;
    x = fX; y = fY;
  }
  (iter < maxIterations) ? hsv(t2 + (iter / maxIterations), 1, 1) : rgb(0, 0, 0);
}

export function render3D(index, x, y, z) {
  var theta = thetaCache[index];
  if (theta < -500) {
    theta = atan2(z - 0.5, x - 0.5);
    thetaCache[index] = theta;
  }
  // theta ∈ [-PI, PI] → real axis over ±0.5 (matches the 2D window)
  // y ∈ [0, 1] → imag axis over ±0.5
  var mx = (theta / PI) * 0.5;
  var my = y - 0.5;

  for (var iter = 0; iter < maxIterations3; iter++) {
    var mx2 = mx * mx, my2 = my * my;
    if (mx2 + my2 > 4) break;
    var fX = mx2 - my2 + cX;
    var fY = 2 * mx * my + cY;
    mx = fX; my = fY;
  }
  (iter < maxIterations3) ? hsv(t2 + (iter / maxIterations3), 1, 1) : rgb(0, 0, 0);
}
