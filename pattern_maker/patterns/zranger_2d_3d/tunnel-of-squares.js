// Endless tunnel of spiraling squares 2D/3D
// In 3D the tunnel runs along the z axis; the radial math (atan2, log, sin)
// is computed in the xy plane and z advances the spiral phase, so the
// viewer "moves through" the tunnel as z increases.
//
// MIT License
// 8/25/2021 ZRanger1 (original 2D)
// 2D/3D port

var t2;
export var speed = 5;
export var nSquares = 4;
var cosT = cos(0.1), sinT = sin(0.1);
var t1;
var timebase;

function signum(a) {
  return (a > 0) - (a < 0);
}

export function sliderSpeed(v) {
  speed = 1 + 9 * v;
}

export function sliderSquarocity(v) {
  nSquares = 1 + floor(6 * v);
}

translate(-0.5, -0.5);

export function beforeRender(delta) {
  timebase = (timebase + delta / 1000) % 3600;
  t2 = time(0.08);
  t1 = speed * timebase;
}

export function render2D(index, x, y) {
  x1 = signum(x); y1 = signum(y);
  sx = x1 * cosT + y1 * sinT;
  sy = y1 * cosT - x1 * sinT;

  dx = abs(sin(nSquares * log(x * sx + y * sy) + atan2(y, x) - t1));

  hsv(t2 + x * sx + y * sy, 1, dx * dx * dx);
}

export function render3D(index, x, y, z) {
  var cx = x - 0.5;
  var cy = y - 0.5;
  var cz = z - 0.5;

  // radial geometry lives in the xy plane; z advances the phase so the
  // tunnel extends into depth.
  var sxi = signum(cx);
  var syi = signum(cy);
  var sxr = sxi * cosT + syi * sinT;
  var syr = syi * cosT - sxi * sinT;

  var rr = cx * sxr + cy * syr;
  // guard log against negative values when the pixel is near the origin
  rr = max(rr, 1e-6);

  var dx = abs(sin(nSquares * log(rr) + atan2(cy, cx) - t1 + cz * PI2 * 2));

  hsv(t2 + cx * sxr + cy * syr + cz * 0.3, 1, dx * dx * dx);
}
