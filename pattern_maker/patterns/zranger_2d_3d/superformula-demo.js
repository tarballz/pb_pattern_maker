// From https://www.shadertoy.com/view/llsyz8
// Superformula / supershape implementation.
// cycles through the examples given in the wikipedia article.
// Ref: https://en.wikipedia.org/wiki/Superformula
//
// In 3D we use the 3D supershape: two angle params (theta in xy plane,
// phi in elevation) each feeding the superformula to get a volumetric
// shape you can fly around. (Ref: Gielis, 2003.)
//
// Pixelblaze port 2021 ZRanger1 (original 2D)
// 2D/3D port

var shape = array(24);
shape[0] = vec4(3, 5, 18, 18);
shape[1] = vec4(6, 20, 7, 18);
shape[2] = vec4(4, 2, 4, 13);
shape[3] = vec4(7, 3, 4, 17);

shape[4] = vec4(7, 3, 6, 6);
shape[5] = vec4(3, 3, 14, 2);
shape[6] = vec4(19, 9, 14, 11);
shape[7] = vec4(12, 15, 20, 3);

shape[8] = vec4(8, 1, 1, 8);
shape[9] = vec4(8, 1, 5, 8);
shape[10] = vec4(8, 3, 4, 3);
shape[11] = vec4(12, 15, 20, 3);

shape[12] = vec4(5, 2, 6, 6);
shape[13] = vec4(6, 1, 1, 6);
shape[14] = vec4(6, 1, 7, 8);
shape[15] = vec4(7, 2, 8, 4);

shape[16] = vec4(3, 2, 8, 3);
shape[17] = vec4(3, 6, 6, 6);
shape[18] = vec4(4, 1, 7, 8);
shape[19] = vec4(7, 2, 8, 4);

shape[20] = vec4(2, 2, 2, 2);
shape[21] = vec4(2, 1, 1, 1);
shape[22] = vec4(2, 1, 4, 8);
shape[23] = vec4(3, 2, 5, 7);

translate(-0.5, -0.5);
scale(0.5, 0.5);

var timebase = 0;
var i, i2, stepVal;
var sx, sy, sz, sw;

function vec4(x, y, z, w) {
  var v = array(4);
  v[0] = x; v[1] = y; v[2] = z; v[3] = w;
  return v;
}

function mix(start, end, val) {
  return start * (1 - val) + end * val;
}

function smoothstep(l, h, v) {
  var t = clamp((v - l) / (h - l), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

function superformula(phi, a, b, m, n1, n2, n3) {
  var tmp = m * phi / 4;
  var vx = abs(cos(tmp) / a); var vy = abs(sin(tmp) / b);
  return pow(pow(vx, n2) + pow(vy, n3), -1 / n1);
}

export function beforeRender(delta) {
  timebase = (timebase + delta / 1000) % 1000;

  i = floor(mod(timebase, 24));
  i2 = (i + 1) % 24;

  stepVal = smoothstep(0.2, 0.8, frac(timebase));

  sx = mix(shape[i][0], shape[i2][0], stepVal);
  sy = mix(shape[i][1], shape[i2][1], stepVal);
  sz = mix(shape[i][2], shape[i2][2], stepVal);
  sw = mix(shape[i][3], shape[i2][3], stepVal);
}

export function render2D(index, x, y) {
  var r = superformula(atan2(y, x), 1, 1, sx, sy, sz, sw);
  r = smoothstep(0, 1, r * 0.2 - hypot(x, y));
  hsv(timebase + r, 1, r);
}

export function render3D(index, x, y, z) {
  // Two-angle supershape (Gielis 3D extension):
  //   r1 = superformula(theta) - azimuth in xy plane
  //   r2 = superformula(phi)   - elevation
  //   surface radius(theta, phi) = r1 * r2
  // We compute the radius at this pixel's direction and compare to the
  // distance to origin.
  var cx = x - 0.5;
  var cy = y - 0.5;
  var cz = z - 0.5;

  var rho = hypot3(cx, cy, cz);
  // guard against origin
  if (rho < 1e-5) rho = 1e-5;

  var theta = atan2(cy, cx);
  // elevation angle from xy plane
  var phi = atan2(cz, hypot(cx, cy));

  var r1 = superformula(theta, 1, 1, sx, sy, sz, sw);
  var r2 = superformula(phi, 1, 1, sx, sy, sz, sw);
  var surface = r1 * r2 * 0.2;

  var r = smoothstep(0, 1, surface - rho);
  hsv(timebase + r + cz * 0.15, 1, r);
}
