// RGB Plasma No 3
// Rainbow arcs of light
//
// 10/26/2021 - ZRanger1

var timebase;
var t1;
export var scale = .8;
export var speed = 1;
var isRadial = 0;
var isMirror = 0;

translate(-0.5,-0.5);

export function sliderScale(v) {
  scale = 0.05+ (2*v);
}

export function sliderSpeed(v) {
  speed = 0.25+(4*v);
}

export function sliderRadial(v) {
  isRadial = (v > 0.5);
}

export function sliderMirror(v) {
  isMirror = (v > 0.5);
}

export function beforeRender(delta) {
  timebase = (timebase + delta/1000) % 1000;
  t1 = timebase * speed;
}

export function render2D(index,x,y) {
  if (isMirror) {x = -abs(x); y = -abs(y);}
  if (isRadial) {tmp = atan2(y,x); y = hypot(x,y); x = tmp;}

  for (var i = 0; i < 4; i++) {
    x1 = x; y1 = y;
    x1 += scale / i * sin(i * y + t1 + 1.3 * i) + 1.7;
    y1 += scale / i * sin(i * x + t1 + 1.3 * (i+10)) - 1.7;
    x = x1; y = y1;
  }
  r = wave(x1);
  g = wave(y1);
  b = wave(x1 + y1);
  rgb(r*r,g*g,b*b);
}

export function render3D(index, x, y, z) {
  // translate(-0.5, -0.5) applied only to x,y in the 2D version;
  // center z ourselves and let it participate as a third wave input.
  var cx = x - 0.5;
  var cy = y - 0.5;
  var cz = z - 0.5;

  if (isMirror) { cx = -abs(cx); cy = -abs(cy); cz = -abs(cz); }
  if (isRadial) {
    var tmpR = atan2(cy, cx);
    cy = hypot3(cx, cy, cz);
    cx = tmpR;
  }

  var x1 = cx; var y1 = cy; var z1 = cz;
  for (var i = 0; i < 4; i++) {
    x1 = cx; y1 = cy; z1 = cz;
    x1 += scale / i * sin(i * cy + t1 + 1.3 * i) + 1.7;
    y1 += scale / i * sin(i * cx + t1 + 1.3 * (i + 10)) - 1.7;
    z1 += scale / i * sin(i * cx + i * cy + t1 + 1.3 * (i + 5));
    cx = x1; cy = y1; cz = z1;
  }
  var rr = wave(x1 + z1 * 0.5);
  var gg = wave(y1 + z1 * 0.5);
  var bb = wave(x1 + y1 + z1);
  rgb(rr * rr, gg * gg, bb * bb);
}