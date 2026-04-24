/*
 Perlin Kaleidoscope 2D/3D

 Uses Pixelblaze's noise functions to generate an "interesting" base
 texture of RGB lines, then generates kaleidoscopic reflections.

 In 3D the kaleidoscope is spherical: azimuthal reflections work in
 the xy plane as before, and elevation (phi) is folded the same way
 so the pattern repeats across both horizontal and vertical slices.
 Base texture is sampled from 3D perlin noise with full volumetric
 input.

 MIT License
 12/29/2022 ZRanger1 (original 2D)
 2D/3D port
*/

export var lineWidth = 0.075;
export var speed = 0.5;
export var nSides = 3;
var slice = PI / nSides;
var outx, outy;
var outz;

export function sliderSpeed(v) {
  speed = 0.25 + 2 * v * v;
}

export function sliderLineWidth(v) {
  lineWidth = 0.02 + (v * 0.3);
}

export function sliderReflections(v) {
  nSides = 1 + floor(6 * v);
  slice = PI2 / nSides;
}

function kal(x, y, r, theta) {
  var angle = abs(theta + mod(atan2(y, x), slice) - slice);
  outx = r * cos(angle); outy = r * sin(angle);
}

// Spherical kaleidoscope: fold both azimuth (xy plane) and elevation.
function kal3(x, y, z, r, theta) {
  // azimuth
  var az = abs(theta + mod(atan2(y, x), slice) - slice);
  // elevation
  var rxy = hypot(x, y);
  var el = abs(theta * 0.5 + mod(atan2(z, rxy), slice) - slice);

  // rebuild point using folded angles, preserving overall radius r
  var newRxy = r * cos(el);
  outz = r * sin(el);
  outx = newRxy * cos(az);
  outy = newRxy * sin(az);
}

var timebase = 0;
var t1, theta;
export function beforeRender(delta) {
  timebase = (timebase + delta / 1000) % 3600;
  t1 = timebase * speed;
  theta = PI * t1;
}

translate(-0.5, -0.5);

export function render2D(index, x, y) {
  r = hypot(x, y);
  if (nSides > 1) {
    kal(x, y, r, theta); x = outx; y = outy;
  }

  lr = perlinFbm(x, y, t1, 1.15, 0.15, 3);
  lg = perlinFbm(y, x, t1, 0.5, 0.1, 3);
  lb = perlinFbm(t1, x, y, 0.25, 0.15, 3);

  r = 2 - abs(y - lr) / lineWidth;
  g = 2 - abs(y - lg) / lineWidth;
  b = 2 - abs(y - lb) / lineWidth;

  rgb(r, g, b);
}

export function render3D(index, x, y, z) {
  var cx = x - 0.5;
  var cy = y - 0.5;
  var cz = z - 0.5;

  var rr = hypot3(cx, cy, cz);

  if (nSides > 1) {
    kal3(cx, cy, cz, rr, theta);
    cx = outx; cy = outy; cz = outz;
  }

  var lr = perlinFbm(cx, cy, cz + t1, 1.15, 0.15, 3);
  var lg = perlinFbm(cy, cx, cz + t1, 0.5, 0.1, 3);
  var lb = perlinFbm(cz + t1, cx, cy, 0.25, 0.15, 3);

  var red = 2 - abs(cy - lr) / lineWidth;
  var grn = 2 - abs(cy - lg) / lineWidth;
  var blu = 2 - abs(cy - lb) / lineWidth;

  rgb(red, grn, blu);
}
