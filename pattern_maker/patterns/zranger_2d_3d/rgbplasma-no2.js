// Another RGB plasma, made with mostly triangle waves
// This one is smooth, bright and 
// has a liquid feel
// 11/06/2021 - ZRanger1

var timebase = 0;
var t1,t2;
export var speed = .1546;
export var scaleFactor = 0.565;
export var isRadial = 0;
export var isMirror = 0;
translate(-0.5,-0.5);

export function sliderSpeed(v) {
  speed = 0.025+ v * v;
}

export function sliderScale(v) {
  scaleFactor = 0.01 + (v * 2);
}

export function sliderRadial(v) {
  isRadial = (v > 0.5);
}

export function sliderMirror(v) {
  isMirror = (v > 0.5);
}

export function beforeRender(delta) {
  timebase = (timebase + delta/1000) % 1000;
  t1 = timebase * speed
}

var t2;
export function render2D(index,x,y) {
  if (isMirror) {x = -abs(x); y = -abs(y);}
  if (isRadial) {tmp = atan2(y,x); y = hypot(x,y); x = tmp;}

  var y1 = y;
  var x1 = x;

  for (var i = 1; i < 5; i++) {
    x1 += scaleFactor/i*wave(triangle(i*y*.1+t1));
    y1 += scaleFactor/i*wave(triangle(i*x*.3+t1));
    x = x1; y = y1;
  }

  r = triangle(x+t1); g = triangle(y-t1); b = triangle(t1+x*y);
  rgb(r*r,g*g,b*b);
}

export function render3D(index, x, y, z) {
  // Apply translate(-0.5,-0.5) manually to (x,y) and center z as well,
  // then run the same iterative distortion but with z coupling into x,y.
  var cx = x - 0.5;
  var cy = y - 0.5;
  var cz = z - 0.5;

  if (isMirror) { cx = -abs(cx); cy = -abs(cy); cz = -abs(cz); }
  if (isRadial) {
    var tmpR = atan2(cy, cx);
    cy = hypot3(cx, cy, cz);
    cx = tmpR;
    // cz left as-is — now acts like a secondary angle
  }

  var x1 = cx; var y1 = cy; var z1 = cz;

  for (var i = 1; i < 5; i++) {
    x1 += scaleFactor / i * wave(triangle(i * cy * .1 + t1 + cz * 0.2));
    y1 += scaleFactor / i * wave(triangle(i * cx * .3 + t1 + cz * 0.2));
    z1 += scaleFactor / i * wave(triangle(i * cx * .2 + i * cy * .2 + t1));
    cx = x1; cy = y1; cz = z1;
  }

  var rr = triangle(cx + t1);
  var gg = triangle(cy - t1);
  var bb = triangle(t1 + cx * cy + cz);
  rgb(rr * rr, gg * gg, bb * bb);
}