// Sea Star 2D/3D
//
// 10/27/2021 ZRanger1 (original 2D)
// 2D/3D port

var timebase;
export var complexity = 1.5;
export var nSides = 5;
export var speed = 1.75;
var slice = PI / nSides;
var waveScale = 8;
var contrast = 0.02023;
var t, t2;

translate(-0.5, -0.5);
scale(.5, .5);

export function sliderSpeed(v) {
  speed = (4 * v);
}

export function sliderComplexity(v) {
  complexity = 1 + (1.5 * v);
}

export function sliderReflections(v) {
  nSides = 1 + floor(v * 15);
  slice = PI / nSides;
  waveScale = 8;
}

export function beforeRender(delta) {
  timebase = (timebase + delta / 1000) % 3600;
  t = timebase * speed;
  t2 = t / 2 * complexity;
}

var x1, y1, s, temp;
export function render2D(index, x, y) {
  var r, g, b;

  var angle = atan2(y, x);
  angle = mod(angle, 2.0 * slice);
  angle += t;

  var d = hypot(x, y);
  x1 = 1 - (d * cos(angle) * waveScale + t2);
  y1 = d * sin(angle);

  for (i = 0; i < 3; i++) {
    y1 += sin(x1 * (i * complexity) + (t + i / complexity)) * 0.5;
    b += i * abs(contrast / y1);
  }

  b = clamp(b, 0, 1);
  hsv(0.6667 - (0.075 * b), 1, b);
}

export function render3D(index, x, y, z) {
  // center and mirror to match the 2D `translate/scale(.5,.5)` setup
  var cx = (x - 0.5) * 0.5;
  var cy = (y - 0.5) * 0.5;
  var cz = (z - 0.5) * 0.5;

  // kaleidoscope fold in the xy plane; radius brings z into the mix so the
  // iterated wave shape has a genuine 3D structure
  var angle = atan2(cy, cx);
  angle = mod(angle, 2.0 * slice);
  angle += t;

  var d = hypot3(cx, cy, cz);
  var xx = 1 - (d * cos(angle) * waveScale + t2);
  var yy = d * sin(angle);
  var bb = 0;

  for (i = 0; i < 3; i++) {
    yy += sin(xx * (i * complexity) + (t + i / complexity)) * 0.5;
    bb += i * abs(contrast / yy);
  }

  bb = clamp(bb, 0, 1);
  hsv(0.6667 - (0.075 * bb), 1, bb);
}
