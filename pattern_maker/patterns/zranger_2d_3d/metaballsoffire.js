/*
 Metaballs of Fire 2D/3D

 Blobs of fire that combine and split as they move around the display.
 In 3D the control points bounce through a volume and the field is computed
 with hypot3; same "voronoi-ish" distance threshold is used for coloring.

 Version  Author        Date        Comment
 1.0.0    JEM(ZRanger1) 07/30/2021  MIT License
 2D/3D port
*/

// array of vectors for each point (x, y, z, vx, vy, vz)
var maxPoints = 8;
var Points = array(maxPoints);

export var numPoints = 5;
export var speed = 0.05;
export var splatter = 1.75;

export function sliderNumberOfPoints(v) {
  var n = floor(4 + (v * (maxPoints - 4)));
  if (n != numPoints) {
    numPoints = n;
    splatter = 1.5 + (numPoints - 4) / 7.8;
    initPoints();
  }
}

export function sliderSpeed(v) {
  speed = 0.15 * v;
}

// create control point vectors with random position, direction and speed
function initPoints() {
  for (var i = 0; i < numPoints; i++) {
    var b = Points[i];

    b[0] = random(1);          // x position
    b[1] = random(1);          // y position
    b[2] = random(1);          // z position

    b[3] = -0.5 + random(1);   // x velocity
    b[4] = -0.5 + random(1);   // y velocity
    b[5] = -0.5 + random(1);   // z velocity
  }
}

function createPoints() {
  for (var i = 0; i < maxPoints; i++) {
    Points[i] = array(6);
  }
  initPoints();
}

// move points, bouncing them off the "walls" of the volume
function bounce() {
  for (var i = 0; i < numPoints; i++) {
    var b = Points[i];

    b[0] += b[3] * speed;
    b[1] += b[4] * speed;
    b[2] += b[5] * speed;

    if (b[0] < 0) { b[0] = 0; b[3] = -b[3]; continue; }
    if (b[1] < 0) { b[1] = 0; b[4] = -b[4]; continue; }
    if (b[2] < 0) { b[2] = 0; b[5] = -b[5]; continue; }

    if (b[0] > 1) { b[0] = 1; b[3] = -b[3]; continue; }
    if (b[1] > 1) { b[1] = 1; b[4] = -b[4]; continue; }
    if (b[2] > 1) { b[2] = 1; b[5] = -b[5]; continue; }
  }
}

createPoints();

export function beforeRender(delta) {
  bounce();
}

// 2D path: ignore the z component and keep the original distance behavior.
export function render2D(index, x, y) {
  var minDistance, i, r;

  minDistance = 1;
  for (i = 0; i < numPoints; i++) {
    r = minDistance * hypot(Points[i][0] - x, Points[i][1] - y) * splatter;
    minDistance = min(r, minDistance);
  }

  if (minDistance >= 0.082) {
    rgb(0, 0, 0);
  } else {
    hsv(0.082 - minDistance, 1, 1.2 - (wave(5 * minDistance)));
  }
}

export function render3D(index, x, y, z) {
  var minDistance, i, r;

  minDistance = 1;
  for (i = 0; i < numPoints; i++) {
    r = minDistance * hypot3(Points[i][0] - x, Points[i][1] - y, Points[i][2] - z) * splatter;
    minDistance = min(r, minDistance);
  }

  if (minDistance >= 0.082) {
    rgb(0, 0, 0);
  } else {
    hsv(0.082 - minDistance, 1, 1.2 - (wave(5 * minDistance)));
  }
}
