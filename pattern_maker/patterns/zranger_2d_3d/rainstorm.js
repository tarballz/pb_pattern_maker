// Rainstorm + lightning 2D/3D
// Requires a mapped 2D or 3D display.
// In 3D rain falls along -y; each vertical column is keyed by (x, z) so
// the 3D volume looks populated with distinct streaks.
//
// MIT License
// 3/23/2026 ZRanger1 (original 2D)
// 2D/3D port


var timebase = 0;
var theta = 0.4;
var speed = 1.0 / 1000;
var flash = 0;
export var streakWidth = 8;
export var flashGate = 5;
var t1;
var cosTheta = 1, sinTheta = 0;

export function sliderSpeed(v) {
  speed = mix(0.2, 1.5, v) / 1000;
}

export function sliderAngle(v) {
  theta = PI2 * v;
}

export function sliderScale(v) {
  streakWidth = mix(3, 11, 1 - v);
}

export function sliderLightning(v) {
  flashGate = PI2 * (1 - v);
}

export function beforeRender(delta) {
  timebase = (timebase + delta * speed) % 3600;
  t1 = timebase * 10;

  flash = clamp(2 * perlin(timebase * 8, timebase / 2, PI, PI2), 0, 1);
  flash = flash * flash * flash * (timebase % PI2 > flashGate);

  cosTheta = cos(theta);
  sinTheta = sin(theta);

  resetTransform();
  translate(-0.5, -0.5);
  scale(2, -2);
  rotate(theta);
}

export function render2D(index, x, y) {
  r = 1.414 * flash - hypot(x, y);

  l = hypot(x, y + 2.1) * .05 + 1.0;
  x *= l; y *= l;

  prngSeed(floor(x * streakWidth));
  v = 1 - sin(prng(2));

  z = 5 / (4 + v);
  b = clamp(abs(sin(t1 * v + y * z)), 0, 1);
  c = v * b;

  h = 0.6667;
  c = c * c * c * c;
  hsv(h, (1 - flash) - c / 20, c + (flash * r * r * r));
}

export function render3D(index, x, y, z_in) {
  // manually apply the same translate/scale/rotate the 2D path uses
  // translate(-0.5,-0.5) -> subtract 0.5; scale(2,-2) -> (2*cx, -2*cy)
  var cx = (x - 0.5) * 2;
  var cy = (y - 0.5) * -2;
  var cz = (z_in - 0.5) * 2;

  // rotate around the y axis so rain angle is preserved when the map
  // rotates. We spin the xz plane by theta so the streak columns realign.
  var rx = cx * cosTheta - cz * sinTheta;
  var rz = cx * sinTheta + cz * cosTheta;

  // 3D flash radius
  var rad = 1.414 * flash - hypot3(rx, cy, rz);

  // compress y at the edges so streaks shorten at the bottom of the frame
  var l = hypot3(rx, cy + 2.1, rz) * .05 + 1.0;
  rx *= l; cy *= l; rz *= l;

  // each (column_x, column_z) pair gets its own streak phase via prng
  prngSeed(floor(rx * streakWidth) * 131 + floor(rz * streakWidth));
  var vv = 1 - sin(prng(2));

  var zScale = 5 / (4 + vv);
  var bb = clamp(abs(sin(t1 * vv + cy * zScale)), 0, 1);
  var cc = vv * bb;

  var hh = 0.6667;
  cc = cc * cc * cc * cc;
  hsv(hh, (1 - flash) - cc / 20, cc + (flash * rad * rad * rad));
}
