/* Ice Floes 2D/3D

 A river filled with floating ice. Uses Voronoi distance to simulate
 blocks drifting in the current.

 In 3D the floes become ice blocks moving through a 3D volume. Their
 positions, velocities, and distance calculations are all volumetric,
 and "cracks" between floes appear as dark-blue lines in 3D.

 Version  Author     Date        Comment
 1.0.1    ZRanger1   7/30/2021   (original 2D)
 2D/3D port
*/

var frameTimer = 9999;
var simulationSpeed = 60;

var numPoints = 4;
var Points = array(numPoints);
export var speed = .575;

export function sliderSpeed(v) {
  speed = 2 * v;
}

function initPoints() {
  for (var i = 0; i < numPoints; i++) {
    var b = Points[i];
    b[0] = random(1);                    // x
    b[1] = random(1);                    // y
    b[2] = random(1);                    // z
    b[3] = random(0.02) - 0.05;          // vx — river current
    b[4] = 0.015 * (random(1) - 0.5);    // vy — vertical drift
    b[5] = 0.02 * (random(1) - 0.5);     // vz — depth drift
  }
}

function createPoints() {
  for (var i = 0; i < numPoints; i++) {
    Points[i] = array(6);
  }
  initPoints();
}

function doRiver(delta) {
  for (var i = 0; i < numPoints; i++) {
    var b = Points[i];

    b[0] = frac(b[0] + (b[3] * speed));
    b[1] = frac(b[1] + b[4]);
    b[2] = frac(b[2] + b[5]);

    if (b[0] < 0) b[0] = 0.9998;

    // bounce off banks (y) and depth (z)
    if (b[1] < 0) { b[1] = 0; b[4] = -b[4]; continue; }
    if (b[1] > 1) { b[1] = 1; b[4] = -b[4]; continue; }
    if (b[2] < 0) { b[2] = 0; b[5] = -b[5]; continue; }
    if (b[2] > 1) { b[2] = 1; b[5] = -b[5]; continue; }
  }
}

function wrappedEuclid(dx, dy) {
  if (dx > 0.5) dx = 1 - dx;
  if (dy > 0.5) dy = 1 - dy;
  return hypot(dx, dy);
}

function wrappedEuclid3(dx, dy, dz) {
  if (dx > 0.5) dx = 1 - dx;
  if (dy > 0.5) dy = 1 - dy;
  if (dz > 0.5) dz = 1 - dz;
  return hypot3(dx, dy, dz);
}

createPoints();

export function beforeRender(delta) {
  frameTimer += delta;
  if (frameTimer > simulationSpeed) {
    doRiver(frameTimer);
    frameTimer = 0;
  }
}

export function render2D(index, x, y) {
  var minDistance = 1;
  var h = 0.6;
  for (var i = 0; i < numPoints; i++) {
    var r = wrappedEuclid(abs(Points[i][0] - x), abs(Points[i][1] - y));
    if (r <= minDistance) {
      h = (abs(r - minDistance) < 0.12) ? 0.6667 : 0.55 + (r * .15);
      minDistance = r;
    }
  }
  var bri = 1 - minDistance; bri = bri * bri * bri;
  hsv(h, (h == 0.6667) ? 1 : 1.21 - bri, bri);
}

export function render3D(index, x, y, z) {
  var minDistance = 1;
  var h = 0.6;
  for (var i = 0; i < numPoints; i++) {
    var r = wrappedEuclid3(
      abs(Points[i][0] - x),
      abs(Points[i][1] - y),
      abs(Points[i][2] - z)
    );
    if (r <= minDistance) {
      h = (abs(r - minDistance) < 0.12) ? 0.6667 : 0.55 + (r * .15);
      minDistance = r;
    }
  }
  var bri = 1 - minDistance; bri = bri * bri * bri;
  hsv(h, (h == 0.6667) ? 1 : 1.21 - bri, bri);
}
