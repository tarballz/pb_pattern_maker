/* Snowflake Nova 2D/3D

 Started life as a snowflake generator, turned into a psychedelic
 snowflake kaleidoscope. Simulates the "fold and cut random holes with
 scissors" snowflake method. In 3D the kaleidoscope image is drawn on a
 slab through the middle of the volume along z, fading smoothly toward
 the front and back so the snowflake reads as a floating disk.

 MIT License
 1.0.0    JEM(ZRanger1) 06/26/2021
 2D/3D port
*/

// Basic shape controls
var ITERATIONS = 3;
export var THICKNESS = 0.21;

// user selectable signed distance functions for "cutouts"
export var distanceMode = 0;
var modes = array(3);
modes[0] = (r) => max((tmpVec[0] * 0.866025) + (tmpVec[1] * 0.5), tmpVec[1]) - THICKNESS; // hex
modes[1] = (r) => max(tmpVec[0] - THICKNESS, tmpVec[1] - THICKNESS);  // box
modes[2] = (r) => hypot(tmpVec[0], tmpVec[1]) - THICKNESS;  // circle

export var SHRINK = 0.9;
export var SCALE = 0.5;
export var NARROW = 0.898;
export var SPREAD = 0.42;
export var DECAY = 0.55;

var COMPLEXITY = 50.0;
var VELOCITY = .2;
var minDelta = 0.5 / ITERATIONS;

// Frame buffer
var height = 16;
var width = 16;

var frame = array(width);
for (var i = 0; i < width; i++) {
  frame[i] = array(height);
}

// Temporary storage for vector functions
var uv = array(2);
var tmpVec = array(2);

// Animation management
var frameTimer = 9999;
export var frameMs = 250;
var frameSeed = random(32761);

// cached per-frame timer so we don't call time() in the render functions
var novaT = 0;

// precalculated sin and cos angles for frequently used angles
var sin30 = sin(0.5236);
var cos30 = cos(0.5236);

export function sliderSpeed(v) {
  frameMs = 100 + (v * 2000);
}

export function sliderDistanceMode(v) {
  distanceMode = floor(0.5 + v * 2);
}

// 16 bit xorshift PRNG
var xs;
function roll() {
  xs ^= xs << 7;
  xs ^= xs >> 9;
  xs ^= xs << 8;
  return frac(abs(xs / 100));
}

function rollSeed(seed) {
  xs = seed;
}

var cosT = 0;  var sinT = 0;
function rotateVector2D(v) {
  var x = v[0];  var y = v[1];
  v[0] = (cosT * x) + (sinT * y);
  v[1] = (-sinT * x) + (cosT * y);
}

function foldRotate(p) {
  var a = floor((0.5236 - atan2(p[0], p[1])) / 1.0472) * 1.0472;
  cosT = cos(a); sinT = sin(a);
  rotateVector2D(p);
}

function signedDistanceHex(p) {
  tmpVec[0] = p[0]; tmpVec[1] = p[1];

  cosT = cos30;  sinT = sin30;
  rotateVector2D(tmpVec);

  tmpVec[0] = abs(tmpVec[0]) * SHRINK;
  tmpVec[1] = abs(tmpVec[1]) * SHRINK;

  return modes[distanceMode]();
}

function doSnowflake() {
  for (var y = 0; y < height; y++) {
    for (var x = 0; x < height; x++) {
      uv[0] = SCALE * ((x / (width-1)) - 0.5); uv[1] = SCALE * ((y / (height-1)) - 0.5);
      rollSeed(frameSeed);
      v = 0;
      for (var i = 0; i < ITERATIONS; i++) {
        foldRotate(uv);

        val = uv[0] *= (NARROW + roll()) - roll();
        uv[1] -= (roll() * SPREAD);

        var dec = DECAY + roll();
        uv[0] *= dec; uv[1] *= dec;

        var dist = signedDistanceHex(uv);
        v += (dist < 0) * (minDelta + floor((sin(dist * COMPLEXITY) * 2.0) + 1.0) * VELOCITY);
      }
      frame[x][y] = (v < 0.01) ? 0 : v;
    }
  }
}

export function beforeRender(delta) {
  frameTimer += delta;
  novaT = time(0.06);

  if (frameTimer > frameMs) {
    frameSeed = random(32761);
    doSnowflake();
    frameTimer = 0;
  }
}

export function render2D(index, x, y) {
  var v = frame[x * width][y * height];
  v = v * v * v;
  var radius = novaT - hypot(x - 0.5, y - 0.5);
  hsv(radius, 1 - v / 3, v);
}

export function render3D(index, x, y, z) {
  var v = frame[x * width][y * height];
  v = v * v * v;
  // hue/ring animation now uses the 3D radius so color shells are spherical
  var radius = novaT - hypot3(x - 0.5, y - 0.5, z - 0.5);
  // slab along z: full brightness at the center, fades smoothly to black
  var zFade = 1 - smoothstep(0.12, 0.45, abs(z - 0.5));
  hsv(radius, 1 - v / 3, v * zFade);
}
