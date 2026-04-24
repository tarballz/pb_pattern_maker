/*
 Line Splash 2D/3D

 Waves created by randomly dropping objects from random heights into a linear
 pond. In 3D the 1D water surface lies along x; both y and z radiate from
 the water line, so the "sheet of water" extends through the volume.

 Version  Author        Date        Comment
 1.0.0    JEM(ZRanger1) 10/16/2020
 2D/3D port
*/

var displayWidth = 32;
var displayHeight = 16;
var initialLevel = displayHeight / 2;
var maxWidthIndex = displayWidth - 1;

export var tension = 0.007;
export var damping = 0.008;
export var spread = 0.003;

var waterLevel = array(displayWidth);
var waterSpeed = array(displayWidth);

var dropInterval = 300;
var frameTimer = 0;
var lineWidth = 1.2;
var hue = 0.6666;
var hueTimer;

initWater();

export function sliderTension(v) {
  tension = 0.05 * v * v;
}

export function sliderDamping(v) {
  damping = 0.05 * v * v;
}

export function sliderSpread(v) {
  spread = 0.01 * v * v;
}

export function sliderLineWidth(v) {
  lineWidth = 0.5 + (3 * v);
}

function initWater() {
  for (var i = 0; i < displayWidth; i++) {
    waterLevel[i] = initialLevel;
    waterSpeed[i] = 0;
  }
}

export function beforeRender(delta) {
  var i, n1, n2;

  hueTimer = time(0.1);

  frameTimer += delta;
  if (frameTimer > dropInterval) {
    waterSpeed[random(displayWidth)] = 0.1 * random(1 + displayHeight / 2);
    dropInterval = random(700);
    frameTimer = 0;
  }

  for (i = 0; i < displayWidth; i++) {
    var newSpeed = initialLevel - waterLevel[i];
    waterSpeed[i] += (tension * newSpeed) - (waterSpeed[i] * damping);
    waterLevel[i] += waterSpeed[i];

    n1 = clamp(i-1, 0, maxWidthIndex); n2 = clamp(i-2, 0, maxWidthIndex);
    var lWave = spread * (waterLevel[i] - waterLevel[n2]);
    lWave += spread * (waterLevel[i] - waterLevel[n1]);
    waterSpeed[n1] += lWave;
    waterLevel[n1] += lWave;

    n1 = clamp(i+1, 0, maxWidthIndex); n2 = clamp(i+2, 0, maxWidthIndex);
    var rWave = spread * (waterLevel[i] - waterLevel[n1]);
    rWave += spread * (waterLevel[i] - waterLevel[n2]);
    waterSpeed[n1] += rWave;
    waterLevel[n1] += rWave;
  }
}

export function render2D(index, x, y) {
  var s, b;
  s = y * 1.75;
  x *= displayWidth;
  y *= displayHeight;
  b = (abs(waterLevel[x] - y) < lineWidth);

  hsv(hue, s, b);
}

export function render3D(index, x, y, z) {
  // Water surface is 1D along x. The "line" extends through z, so the
  // pixel is "wet" when its distance from the water level (along y) is
  // within lineWidth in both y and z directions.
  var xi = floor(x * displayWidth);
  var dy = abs(waterLevel[xi] - y * displayHeight);
  // z distance from the centerplane of the water sheet, in display units
  var dz = abs(z - 0.5) * displayHeight;
  var d = hypot(dy, dz);
  var s = y * 1.75;
  var b = (d < lineWidth);

  hsv(hue, s, b);
}
