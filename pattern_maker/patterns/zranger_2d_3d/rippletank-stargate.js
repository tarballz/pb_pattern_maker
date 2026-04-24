// Ripple Tank / Stargate Pool 2D/3D
// Two animated wave generators rendered inside a user-controlled circle
// (2D) or sphere (3D). In 3D the two sources orbit on different planes so
// their interference creates a genuine 3D wavefront.
//
// MIT License
// 03/05/2022 ZRanger1 (original 2D)
// 2D/3D port

var timebase = 0;
var x1 = y1 = x2 = y2 = 0;
var z1 = 0, z2 = 0;

export var speed = 6;
export var waveScale = 26;
export var attenuation = 0.08;
export var poolRadius = 0.54;
var theta = 0;
var t1, t2;

// UI Sliders
export function sliderSpeed(v) {
  speed = 0.1 + (15 * v);
}

export function sliderWavelength(v) {
  waveScale = 1 + 29 * (1-v);
}

export function sliderAttenuation(v) {
  attenuation = (v * v * v);
}

export function sliderRadius(v) {
  poolRadius = v;
}

// move coordinate origin to center of display for the 2D path.
translate(-0.5, -0.5);

function smoothstepLocal(l, h, v) {
  var t = clamp((v - l) / (h - l), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

export function beforeRender(delta) {
  timebase = (timebase + delta / 1000) % 1000;
  t1 = timebase * speed;

  theta = (theta + speed / 500) % PI2;
  // Source 1 orbits in the xy plane (2D) / the y=0 equator (3D).
  x1 = 0.575 * cos(theta); y1 = 0.575 * sin(theta); z1 = 0.25 * sin(theta * 0.7);
  // Source 2 orbits the opposite way, tilted so it rides a different plane in 3D.
  t2 = PI2 - theta;
  x2 = 0.25 * cos(t2); y2 = 0.25 * cos(t2 * 0.9); z2 = 0.4 * sin(t2);
}

export var pr;
export function render2D(index, x, y) {
  var nx, ny, nz;

  // early out for pixels outside our radius (coords already shifted)
  pr = poolRadius - hypot(x, y);
  if (pr < 0) {
    rgb(0, 0, 0);
    return;
  }

  nx = ny = 0;

  // wave source 1
  qx = (x - x1) * waveScale; qy = (y - y1) * waveScale;
  r = hypot(qx, qy);
  tmp = (sin(r - t1) * .02 - cos(r - t1)) * exp(-r * attenuation) / r;
  nx += qx * tmp; ny += qy * tmp;

  // wave source 2
  qx = (x - x2) * waveScale; qy = (y - y2) * waveScale;
  r = hypot(qx, qy);
  tmp = (sin(r - t1) * .02 - cos(r - t1)) * exp(-r * attenuation) / r;
  nx += qx * tmp; ny += qy * tmp;

  // normalize the (height-field) gradient and dot with a fixed light direction
  tmp = hypot3(nx, ny, 1);
  nx /= tmp; ny /= tmp; nz = 1 / tmp;
  s = clamp(nx * -0.1826 + ny * 0.3651 + nz * 0.90218, 0, 1);

  hsv(0.6667 - (0.02 * s), 1.9 - s, smoothstepLocal(0, 1, pr / poolRadius) * s * s * s * s);
}

export function render3D(index, x, y, z) {
  var cx = x - 0.5;
  var cy = y - 0.5;
  var cz = z - 0.5;

  // early out for pixels outside the sphere
  pr = poolRadius - hypot3(cx, cy, cz);
  if (pr < 0) {
    rgb(0, 0, 0);
    return;
  }

  var nx = 0, ny = 0, nz = 0;
  var qx, qy, qz, r, tmp;

  // wave source 1
  qx = (cx - x1) * waveScale;
  qy = (cy - y1) * waveScale;
  qz = (cz - z1) * waveScale;
  r = hypot3(qx, qy, qz);
  tmp = (sin(r - t1) * .02 - cos(r - t1)) * exp(-r * attenuation) / r;
  nx += qx * tmp; ny += qy * tmp; nz += qz * tmp;

  // wave source 2
  qx = (cx - x2) * waveScale;
  qy = (cy - y2) * waveScale;
  qz = (cz - z2) * waveScale;
  r = hypot3(qx, qy, qz);
  tmp = (sin(r - t1) * .02 - cos(r - t1)) * exp(-r * attenuation) / r;
  nx += qx * tmp; ny += qy * tmp; nz += qz * tmp;

  // normalize 3D gradient, dot with the same fixed light direction
  tmp = hypot3(nx, ny, nz);
  if (tmp < 0.0001) tmp = 0.0001;
  nx /= tmp; ny /= tmp; nz /= tmp;
  var s = clamp(nx * -0.1826 + ny * 0.3651 + nz * 0.90218, 0, 1);

  hsv(0.6667 - (0.02 * s), 1.9 - s, smoothstepLocal(0, 1, pr / poolRadius) * s * s * s * s);
}
