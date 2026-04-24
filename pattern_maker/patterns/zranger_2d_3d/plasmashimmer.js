// Plasma Shimmer 2D/3D
// Swirly plasma that occasionally explodes into weirdness.
// In 3D the pixel's (x,y,z) feed directly into the shader-style iteration,
// and the scene rotates about the volume's vertical axis.
// Requires Pixelblaze 3 with v3.17 or newer firmware.
// 7/15/21 - ZRanger1 (original 2D)
// 2D/3D port

var chaosLevel = 0.5;
var theta;             // current rotation angle
var cosTheta, sinTheta;

// vectors for calculation
var mx, my, mz;
var pr, pg, pb;
var dotp;

export function beforeRender(delta) {
  t1 = wave(time(.5)) * 40;

  mx = 0.5 + (cos(t1) * 0.3);
  my = 0.5 + (sin(t1) * 0.5);
  mz = 0.5 + (sin(t1 * 1.3) * 0.4);

  theta = PI2 * time(0.25);
  cosTheta = cos(theta);
  sinTheta = sin(theta);

  // The transform only affects the 2D render path.
  resetTransform();
  rotate(theta);
}

export function render2D(index, x, y) {
  pr = x; pg = y; pb = mx;

  // perturb coords with time-based function a few times and use the result as
  // RGB color (common GLSL shader trick). Additive color is trivial, precise
  // control is not — so we don't try. It's pink. And blue.
  for (var i = 0; i < 5; i++) {
    dotp = (pr * pr + pg * pg + pb * pb);
    pr = abs(pr) / dotp - 1;
    pb = abs(pg) / dotp - 1;
    pg = abs(pb) / dotp - my * chaosLevel;
  }

  rgb(pr * pr, pg * pg, pb * pb);
}

export function render3D(index, x, y, z) {
  // manually rotate the xy plane about the volume center (render3D ignores
  // the 2D transform stack)
  var cx = x - 0.5;
  var cy = y - 0.5;
  var rx = cx * cosTheta - cy * sinTheta + 0.5;
  var ry = cx * sinTheta + cy * cosTheta + 0.5;

  // feed the rotated (x,y) and raw z into the iteration; mz modulates the
  // third channel so the chaos isn't identical on every z-slice
  pr = rx; pg = ry; pb = z + mz * 0.2;

  for (var i = 0; i < 5; i++) {
    dotp = (pr * pr + pg * pg + pb * pb);
    pr = abs(pr) / dotp - 1;
    pb = abs(pg) / dotp - 1;
    pg = abs(pb) / dotp - my * chaosLevel;
  }

  rgb(pr * pr, pg * pg, pb * pb);
}
