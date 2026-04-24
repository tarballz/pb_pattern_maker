// Line Dancer 2D/3D
// Twisting line effect with twist control and kaleidoscopic mirroring.
// In 3D the angular kaleidoscope is applied in the xy plane and the radius
// uses hypot3 so the twist propagates through the volume.
//
// 10/26/2021 - ZRanger1 (original 2D)
// 2D/3D port

var timebase = 0;
var t1;
var zoom;
export var speed = 4.6;
export var twist = 1.75;
export var nSides = 1;
var slice = PI / nSides;
var outx, outy;

translate(-0.5, -0.5);

export function sliderSpeed(v) {
  speed = 1 + (9 * v);
}

export function sliderTwist(v) {
  twist = 1.25 + (0.75 * v);
}

export function sliderReflections(v) {
  nSides = 1 + floor(6 * v);
  slice = PI / nSides;
}

function kal(x, y) {
  var angle = atan2(y, x);
  angle = mod(angle, 2.0 * slice);
  angle += PI * timebase;

  var d = hypot(x, y);
  outx = d * cos(angle);  outy = d * sin(angle);
}

export function beforeRender(delta) {
  timebase = (timebase + delta / 1000) % 1000;
  t1 = timebase * speed;
  zoom = wave(time(0.075));
}

export function render2D(index, x, y) {
  var h, b, radius, theta;

  if (nSides > 1) { kal(x, y); x = outx; y = outy; }

  radius = twist - hypot(x, y) * 2.4;
  theta = radius * radius * sin(radius + t1);
  x = (cos(theta) * x) - (sin(theta) * y);

  b = 1 - wave(x * 4.6 * zoom);
  h = (x * zoom) + zoom + theta / PI2;
  hsv(h, 1, b * b);
}

export function render3D(index, x, y, z) {
  var h, b, radius, theta;
  var cx = x - 0.5;
  var cy = y - 0.5;
  var cz = z - 0.5;

  // fold the xy plane through the kaleidoscope; preserve cz for the radial twist
  if (nSides > 1) { kal(cx, cy); cx = outx; cy = outy; }

  // include z in the radius so the twist really does ripple through depth
  radius = twist - hypot3(cx, cy, cz) * 2.4;
  theta = radius * radius * sin(radius + t1);

  // rotate the xy plane by theta; the depth axis rotates with a phase offset
  var xr = (cos(theta) * cx) - (sin(theta) * cy);

  b = 1 - wave(xr * 4.6 * zoom);
  h = (xr * zoom) + zoom + theta / PI2;
  hsv(h, 1, b * b);
}
