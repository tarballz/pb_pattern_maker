/* DOOM Fire — 2D/3D

 In 3D the fire becomes volumetric: a small 3D grid is updated each
 frame so that every cell cools and "rises" from the cell beneath it,
 with random lateral jitter in both x and z. The effect is a column
 of flame visible through the full volume.

 Reduced grid size (12 * 10 * 12 = 1440 cells) to keep memory use low.

 MIT License
 v2.3    JEM(ZRanger1) 6/2024 - Improved sampling (original 2D)
 2D/3D port
*/

// --- 2D state (unchanged) ---
var width = 48;
var height = 16;

var arrayWidth = width + 2;
var arrayHeight = height + 1;
var lastRow = arrayHeight - 1;
var lastCol = width + 1;

var buffer1 = array(arrayWidth);
var buffer2 = array(arrayWidth);
var pb1, pb2;

// --- 3D state ---
// Grid: gw x gh x gd. Index: x + z*gw + y*gw*gd
var gw = 12;
var gd = 12;
var gh = 10;
var gLast = gh - 1;
var total3 = gw * gh * gd;
var fire1 = array(total3);
var fire2 = array(total3);
var fp1, fp2;

var baseHue = 0;
var baseBri = 0.6;
var maxCooling = 0.275;
var dragonMode = 0;
var breathTimer;
var wind = 0.50;
var windDirection = 0;
var windDirectionZ = 0;
var frameTimer = 9999;
var simulationSpeed = 60;
var perturb = perturbNormal;
var desat = 1.3;

export function hsvPickerHue(h, s, v) {
  baseHue = h;
  baseBri = v;
}

export function sliderFlameHeight(v) {
  v = (1 - v); v = v * v;
  maxCooling = max(4 * v, 0.1);
}

export function sliderWind(v) {
  wind = (v * v) / 2;
  if (wind == 0) { windDirection = 0; windDirectionZ = 0; }
}

var lastDragonMode = dragonMode;
export function sliderDragonMode(v) {
  dragonMode = (v > 0.5);
  if (dragonMode == lastDragonMode) return;
  lastDragonMode = dragonMode;

  if (dragonMode) {
    perturb = perturbDragonBreath;
  } else {
    initBuffers();
    perturb = perturbNormal;
  }
}

export function sliderWhiteHeat(v) {
  desat = 1.25 + (1 - v);
}

function allocateFrameBuffers() {
  for (var i = 0; i < arrayWidth; i++) {
    buffer1[i] = array(arrayHeight);
    buffer2[i] = array(arrayHeight);
  }
  pb1 = buffer1;
  pb2 = buffer2;
}

function initBuffers() {
  for (var i = 0; i < arrayWidth; i++) {
    pb1[i][lastRow] = 1;
    pb2[i][lastRow] = 1;
  }
  // 3D: set bottom layer (y = gLast) to 1
  fp1 = fire1;
  fp2 = fire2;
  for (var x = 0; x < gw; x++) {
    for (var z = 0; z < gd; z++) {
      var idx = x + z * gw + gLast * gw * gd;
      fp1[idx] = 1;
      fp2[idx] = 1;
    }
  }
}

function perturbDragonBreath() {
  for (var i = 0; i < arrayWidth; i++) {
    pb2[i][lastRow] = breathTimer + wave(-.21 + (i / arrayWidth));
  }
}

function perturbNormal() {
  for (var i = 0; i < arrayWidth; i++) {
    pb2[i][lastRow] = 0.9 + wave(triangle(time(0.3)) + (i / arrayWidth)) / 3;
  }
}

function perturb3() {
  // Write to bottom layer (y = gLast) of pb2 based on mode
  var tBase = triangle(time(0.3));
  for (var x = 0; x < gw; x++) {
    for (var z = 0; z < gd; z++) {
      var idx = x + z * gw + gLast * gw * gd;
      if (dragonMode) {
        fp2[idx] = breathTimer + wave(-0.21 + (x / gw) + (z / gd) * 0.5);
      } else {
        fp2[idx] = 0.9 + wave(tBase + (x / gw) + (z / gd) * 0.5) / 3;
      }
    }
  }
}

function swapBuffers() {
  var tmp = pb1; pb1 = pb2; pb2 = tmp;
}

function swapBuffers3() {
  var tmp = fp1; fp1 = fp2; fp2 = tmp;
}

function doFire() {
  swapBuffers();
  windDirection = w2;

  for (var x = 1; x < lastCol; x++) {
    for (var y = 0; y < lastRow; y++) {
      var r = random(maxCooling) * (y / lastRow);
      var windFx = (abs((lastRow / 2) - y) / lastRow);
      windFx = x + (random(1) < 0.5 - windFx) * windDirection;
      pb2[x][y] = max(0, pb1[windFx][y + 1] - r);
    }
  }
}

function doFire3() {
  swapBuffers3();
  windDirection = w2;
  windDirectionZ = w2z;

  for (var x = 0; x < gw; x++) {
    for (var z = 0; z < gd; z++) {
      for (var y = 0; y < gLast; y++) {
        var r = random(maxCooling) * (y / gLast);
        // chance of lateral drift in x and z for each cell
        var jx = floor(random(3)) - 1 + windDirection;
        var jz = floor(random(3)) - 1 + windDirectionZ;
        var sx = x + jx;
        var sz = z + jz;
        if (sx < 0) sx = 0; else if (sx >= gw) sx = gw - 1;
        if (sz < 0) sz = 0; else if (sz >= gd) sz = gd - 1;
        var srcIdx = sx + sz * gw + (y + 1) * gw * gd;
        var dstIdx = x + z * gw + y * gw * gd;
        fp2[dstIdx] = max(0, fp1[srcIdx] - r);
      }
    }
  }
}

allocateFrameBuffers();
initBuffers();

export var w2;
export var w2z;
export function beforeRender(delta) {
  frameTimer += delta;

  if (frameTimer > simulationSpeed) {
    breathTimer = wave(time(0.1));
    w2 = sin(PI2 * time(0.1));
    w2 = (w2 < 0) ? -1 : 1;
    // independent wind in z
    w2z = sin(PI2 * time(0.13) + 1.7);
    w2z = (w2z < 0) ? -1 : 1;

    doFire();
    perturb();

    doFire3();
    perturb3();

    frameTimer = 0;
  }
}

export function render2D(index, x, y) {
  bri = pb2[1 + (x * width)][y * height];
  bri = bri * bri * bri;
  hsv(baseHue + ((0.05 * bri)), desat - bri / 4, baseBri * bri);
}

export function render3D(index, x, y, z) {
  // Map xyz in [0,1] to grid cell. y is up — flame rises along y, so
  // bottom of grid (y=gLast) is at x-axis floor = y=0 in world coords.
  var gx = floor(x * gw);
  var gy = floor((1 - y) * gh); // invert so flame rises upward in world y
  var gz = floor(z * gd);
  if (gx < 0) gx = 0; else if (gx >= gw) gx = gw - 1;
  if (gy < 0) gy = 0; else if (gy >= gh) gy = gh - 1;
  if (gz < 0) gz = 0; else if (gz >= gd) gz = gd - 1;
  var bri = fp2[gx + gz * gw + gy * gw * gd];
  bri = bri * bri * bri;
  hsv(baseHue + ((0.05 * bri)), desat - bri / 4, baseBri * bri);
}
