// Gently twinkling star to light your way! - 2D/3D
//
// In 3D the star becomes a 6-pointed 3D star: the original two sets
// of 4-pointed minkowski rays (horizontal/vertical and diagonal) are
// extended to a six-axis version using three orthogonal pairs of
// rays along (x,y,z).
//
// MIT License
// 12/13/2023 ZRanger1 (original 2D)
// 2D/3D port

var speed = 1000;
var timebase = 0;
var t1, t2;
var cosT, sinT;
var outX, outY;
var n;
var rotAngle = 0;
var cosR = 1, sinR = 0;

setRotationAngle(PI / 4);

export function sliderSpeed(v) {
  speed = 2000 * max(0.005, (1 - v));
}

function setRotationAngle(angle) {
  cosT = cos(angle); sinT = sin(angle);
}

function rotate2D(x, y) {
  outX = (cosT * x) - (sinT * y);
  outY = (sinT * x) + (cosT * y);
}

export function beforeRender(delta) {
  timebase = (timebase + delta / speed) % 3600;

  resetTransform();
  translate(-0.5, -0.5);

  rotAngle = (timebase / 8) % PI;
  rotate(rotAngle);
  cosR = cos(rotAngle); sinR = sin(rotAngle);

  n = perlin(timebase, 0.333, 0.666, PI2);
  t1 = 0.25 * n;
  t2 = 0.4 * n;
}

// 2D minkowski distance
function minkowskiDistance(x1, y1, p) {
  return pow(pow(abs(x1), p) + pow(abs(y1), p), 1.0 / p);
}

// 3D minkowski
function minkowskiDistance3(x1, y1, z1, p) {
  return pow(pow(abs(x1), p) + pow(abs(y1), p) + pow(abs(z1), p), 1.0 / p);
}

export function render2D(index, x, y) {
  var b = min(1, (0.4 + t1) / minkowskiDistance(x, y, 0.535));
  b = b * b * b * b * b;

  rotate2D(x, y);

  c = min(1, 0.345 / minkowskiDistance(outX, outY, 0.35 - t2));
  c = c * c * c * c;

  b = (b + c) / 2;

  hsv(0.56, 1.8 - b, b);
}

export function render3D(index, x, y, z) {
  var cx = x - 0.5;
  var cy = y - 0.5;
  var cz = z - 0.5;

  // Apply the same rotate-around-z as render2D
  var rx = cx * cosR - cy * sinR;
  var ry = cx * sinR + cy * cosR;
  var rz = cz;

  // Primary star: 6-point minkowski in 3D (axis-aligned rays)
  var b = min(1, (0.4 + t1) / minkowskiDistance3(rx, ry, rz, 0.535));
  b = b * b * b * b * b;

  // Secondary star: rotate 45deg in xy and 45deg in xz for diagonals
  var dx = cosT * rx - sinT * ry;
  var dy = sinT * rx + cosT * ry;
  var dz = rz;
  // now rotate the (dx,dz) pair by 45deg as well
  var ex = cosT * dx - sinT * dz;
  var ez = sinT * dx + cosT * dz;

  var c = min(1, 0.345 / minkowskiDistance3(ex, dy, ez, 0.35 - t2));
  c = c * c * c * c;

  b = (b + c) / 2;

  hsv(0.56, 1.8 - b, b);
}
