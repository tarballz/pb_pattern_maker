// Another twinkling star to light your way! - 2D/3D
//
// This one uses a fast geometric distance field (swiftstar).
//
// In 3D the star is evaluated on three orthogonal planes (xy, yz, xz)
// and the three fields are maxed to give a 6-armed 3D star.
//
// MIT License
// 12/14/2023 ZRanger1 (original 2D)
// 2D/3D port

var speed = 1000;
var timebase = 0;
var twinkle;
var rotAngle = 0;
var cosR = 1, sinR = 0;

export function sliderSpeed(v) {
  speed = 2000 * max(0.005, (1 - v));
}

export function beforeRender(delta) {
  timebase = (timebase + delta / speed) % 3600;

  resetTransform();
  translate(-0.5, -0.5);
  scale(2, 2);

  rotAngle = (timebase / 10) % PI;
  rotate(rotAngle);
  cosR = cos(rotAngle); sinR = sin(rotAngle);

  twinkle = 1 - 0.125 * wave(timebase);
}

function swiftstar(x, y, anim) {
  x = abs(x); y = abs(y);
  xpos = min(x / y, anim);
  ypos = min(y / x, anim);
  p = (2. - xpos - ypos);
  return (.75 + p * (p * p - 1.25)) / (x + y);
}

export function render2D(index, x, y) {
  b = clamp(swiftstar(x, y, twinkle), 0, 1);
  b = b * b * b * b;
  hsv(0.56, 1.75 - b, b);
}

export function render3D(index, x, y, z) {
  // Center and apply the 2D scale(2,2) + rotate(rotAngle) manually.
  var cx = (x - 0.5) * 2;
  var cy = (y - 0.5) * 2;
  var cz = (z - 0.5) * 2;

  var rx = cx * cosR - cy * sinR;
  var ry = cx * sinR + cy * cosR;
  var rz = cz;

  // Evaluate star field on three orthogonal planes, take the max
  // (union) so the arms extend along all three axes.
  var sxy = clamp(swiftstar(rx, ry, twinkle), 0, 1);
  var syz = clamp(swiftstar(ry, rz, twinkle), 0, 1);
  var sxz = clamp(swiftstar(rx, rz, twinkle), 0, 1);

  var b = max(sxy, max(syz, sxz));
  b = b * b * b * b;

  hsv(0.56, 1.75 - b, b);
}
