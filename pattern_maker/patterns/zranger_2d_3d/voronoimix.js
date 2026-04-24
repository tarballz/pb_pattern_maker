/*
 Animated Voronoi diagram — 2D/3D
 Moves several points around the display, coloring each pixel
 according to the nearest point using a user-selectable distance
 method.

 *** Yet Another Very Computationally Expensive Pattern! ***

 In 3D the points carry full xyz position + xyz velocity and the
 distance functions take three arguments. The volume is sparser than
 a plane, so draw-mode 1 (gamma brightness) reads best on volumetric
 mappings.

 Version  Author        Date        Comment
 1.0.0    JEM(ZRanger1) 12/31/2020  MIT License (original 2D)
 2D/3D port
*/

var numModes = 7;
var distance = array(numModes);
var distance3 = array(numModes);

distance[0] = euclidean;
distance[1] = wavedistance;
distance[2] = deviation;
distance[3] = chebyshev;
distance[4] = eggcrate;
distance[5] = manhattan;
distance[6] = squarewaves;

distance3[0] = euclidean3;
distance3[1] = wavedistance3;
distance3[2] = deviation3;
distance3[3] = chebyshev3;
distance3[4] = eggcrate3;
distance3[5] = manhattan3;
distance3[6] = squarewaves3;

var numRenderers = 6;
var gamma = array(numRenderers);

gamma[0] = original;
gamma[1] = originalG;
gamma[2] = crispyC;
gamma[3] = crispyCI;
gamma[4] = crispyCG;
gamma[5] = crispyCIG;

var maxPoints = 8;
var Points = array(maxPoints);

export var numPoints = 5;
export var speed = 0.035;
export var drawMode = 0;
export var distMethod = 0;

export function sliderNumberOfPoints(v) {
  var n = floor(1 + (v * (maxPoints - 1)));
  if (n != numPoints) {
    numPoints = n;
    initPoints();
  }
}

export function sliderDistanceMethod(v) {
  distMethod = floor((numModes - 1) * v);
}

export function sliderDrawingMode(v) {
  drawMode = floor((numRenderers - 1) * v);
}

export function sliderSpeed(v) {
  speed = 0.15 * v;
}

function initPoints() {
  var h = 0;
  for (var i = 0; i < numPoints; i++) {
    var b = Points[i];
    b[0] = random(1);        // x
    b[1] = random(1);        // y
    b[2] = random(1);        // z
    b[3] = random(1) - 0.5;  // vx
    b[4] = random(1) - 0.5;  // vy
    b[5] = random(1) - 0.5;  // vz
    b[6] = h + i / numPoints;
  }
}

function createPoints() {
  for (var i = 0; i < maxPoints; i++) {
    Points[i] = array(7);
  }
  initPoints();
}

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

// 2D distance functions
function euclidean(x, y) { return sqrt((x * x) + (y * y)); }
function wavedistance(x, y) { return wave((x * x) + (y * y)); }
function chebyshev(x, y) { return max(abs(x), abs(y)); }
function deviation(x, y) { return abs(sqrt((x * x) + (y * y)) - 0.52038); }
function manhattan(x, y) { return abs(x) + abs(y); }
function eggcrate(x, y) { return 1 - (0.1 * (cos(x * PI2) + sin(y * PI2))); }
function squarewaves(x, y) { return square(manhattan(x, y), .75); }

// 3D distance functions
function euclidean3(x, y, z) { return hypot3(x, y, z); }
function wavedistance3(x, y, z) { return wave((x * x) + (y * y) + (z * z)); }
function chebyshev3(x, y, z) { return max(abs(x), max(abs(y), abs(z))); }
function deviation3(x, y, z) { return abs(hypot3(x, y, z) - 0.6204); }
function manhattan3(x, y, z) { return abs(x) + abs(y) + abs(z); }
function eggcrate3(x, y, z) { return 1 - (0.07 * (cos(x * PI2) + sin(y * PI2) + cos(z * PI2))); }
function squarewaves3(x, y, z) { return square(manhattan3(x, y, z), .75); }

function original(d, hue) { hsv(hue, 1, 1); }
function originalG(d, hue) { var bri = 1 - d; bri = bri * bri * bri; hsv(hue, 1, bri); }
function crispyC(d, hue) { hsv(hue + d, 1, d); }
function crispyCI(d, hue) { hsv(hue + d, 1, 1 - d); }
function crispyCIG(d, hue) { var bri = 1 - d; bri = bri * bri * bri; hsv(hue + d, 1, bri); }
function crispyCG(d, hue) { var bri = d * d * d * d; hsv(hue + d, 1, bri); }

createPoints();

export function beforeRender(delta) {
  bounce();
}

export function render2D(index, x, y) {
  var minDistance = 32765;
  var h = 0;
  for (var i = 0; i < numPoints; i++) {
    var r = distance[distMethod](Points[i][0] - x, Points[i][1] - y);
    if (r < minDistance) {
      h = Points[i][6];
      minDistance = r;
    }
  }
  gamma[drawMode](minDistance, h);
}

export function render3D(index, x, y, z) {
  var minDistance = 32765;
  var h = 0;
  for (var i = 0; i < numPoints; i++) {
    var r = distance3[distMethod](Points[i][0] - x, Points[i][1] - y, Points[i][2] - z);
    if (r < minDistance) {
      h = Points[i][6];
      minDistance = r;
    }
  }
  gamma[drawMode](minDistance, h);
}
