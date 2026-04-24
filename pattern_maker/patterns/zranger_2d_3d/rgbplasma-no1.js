/*
   Multi-octave additive plasma. Bright circular waves
   in primary colors.
   
   MIT License
   Take this code and use it to make cool things!

   3/21/2022  ZRanger1
*/
export var sc = 0.2862;
export var speed = 0.11;
var theta = 0;
var t1,t2;

export function sliderSpeed(v) {
  speed = mix(0.8,0.02,v);
}

export function sliderScale(v) {
  sc = clamp(v * v,0.04,1);
}

var cosTheta = 1, sinTheta = 0;
export function beforeRender(delta) {
  t1 = time(speed);
  t2 = wave(t1);

  theta += (-1+2*t2) * PI2 * delta/2000;
  theta = theta % PI2;

  cosTheta = cos(theta);
  sinTheta = sin(theta);

  resetTransform();
  translate(-0.5,-0.5);
  rotate(theta)
  scale(sc,sc)
}

// linear interpolator
function mix(start,end,val) {
  return start * (1-val) + end * val;
}

export function render2D(index,x,y) {

  // distort incoming coordinates by adding offsets at 3 different scales
  x += triangle(t1+hypot(x,y)) - 0.5;
  y += triangle(t1+hypot(x,y)) - 0.5;
  
  x += 0.5 * (triangle(t1+hypot(x,y)) - 0.5);
  y += 0.5 * (triangle(t1+hypot(x,y)) - 0.5);
  
  x += 0.25 * (triangle(t1+hypot(x,y)) - 0.5);
  y += 0.25 * (triangle(t1+hypot(x,y)) - 0.5);  
  
  
  // convert to RGB color.
  r = wave(t2+x);
  g = wave(t2+y);
  b = wave(t2+x+y);

  rgb(r*r,g*g,b*b)
}

export function render3D(index, x, y, z) {
  // Apply translate(-0.5,-0.5) + rotate(theta) + scale(sc,sc) manually
  // in xy; keep z as an additional plasma input.
  var cx = (x - 0.5);
  var cy = (y - 0.5);
  var rx = (cx * cosTheta - cy * sinTheta) * sc;
  var ry = (cx * sinTheta + cy * cosTheta) * sc;
  var rz = (z - 0.5) * sc;

  // distort coordinates at 3 scales, using 3D radius so depth
  // participates in the distortion
  var r3;
  r3 = hypot3(rx, ry, rz);
  rx += triangle(t1 + r3) - 0.5;
  ry += triangle(t1 + r3) - 0.5;
  rz += triangle(t1 + r3) - 0.5;

  r3 = hypot3(rx, ry, rz);
  rx += 0.5 * (triangle(t1 + r3) - 0.5);
  ry += 0.5 * (triangle(t1 + r3) - 0.5);
  rz += 0.5 * (triangle(t1 + r3) - 0.5);

  r3 = hypot3(rx, ry, rz);
  rx += 0.25 * (triangle(t1 + r3) - 0.5);
  ry += 0.25 * (triangle(t1 + r3) - 0.5);
  rz += 0.25 * (triangle(t1 + r3) - 0.5);

  var rr = wave(t2 + rx + rz);
  var gg = wave(t2 + ry + rz);
  var bb = wave(t2 + rx + ry + rz);

  rgb(rr * rr, gg * gg, bb * bb);
}