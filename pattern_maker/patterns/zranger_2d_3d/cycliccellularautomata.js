/* Cyclic Cellular Automata — 2D / 3D

 In 3D we keep a small volumetric grid (10*10*10) and compute the
 CCA / Greenberg-Hastings rules using a 26-neighborhood.

 MIT License

 Version  Author        Date
 1.0.0    JEM(ZRanger1) 05/03/2021 (original 2D)
 2D/3D port
*/

var width = 16;
var height = 16;

var buffer1 = array(height);
var buffer2 = array(height);
var pb1, pb2;

// 3D buffers
var gw = 10;
var gh = 10;
var gd = 10;
var total3 = gw * gh * gd;
var gbuf1 = array(total3);
var gbuf2 = array(total3);
var gp1, gp2;

export var numStates = 24;
export var speed = 60;
export var lifetime = 10000;
export var excited = 0.03;
export var refractory = 0.64;
export var threshold = 1;
var mode = 0;
var calcNextGen = doGenerationGH;
var calcNextGen3 = doGeneration3GH;
var nextVal = 1;
var frameTimer = 9999;
var patternTimer = 9999;
var sum = 0;
var sum3 = 0;

export function sliderSpeed(v) {
  speed = 1000 * v * v;
}

export function sliderLifetime(v) {
  lifetime = v * 30000;
}

export function sliderMode(v) {
  mode = (v > 0.5);
  calcNextGen = mode ? doGenerationCCA : doGenerationGH;
  calcNextGen3 = mode ? doGeneration3CCA : doGeneration3GH;

  if (mode == 0) {
    threshold = 1;
    numStates = 24;
    excited = 0.03;
    refractory = 0.64;
  } else {
    threshold = 3;
    numStates = 3;
  }
}

function seedCA() {
  if (mode) {
    seedCCA();
    seedCCA3();
  } else {
    seedGH(excited, refractory);
    seedGH3(excited, refractory);
  }
}

function seedCCA() {
  pb1 = buffer1;
  pb2 = buffer2;
  for (var y = 0; y < height; y++) {
    for (var x = 0; x < width; x++) {
      pb2[x][y] = floor(random(numStates));
      pb1[x][y] = pb2[x][y];
    }
  }
}

function seedCCA3() {
  gp1 = gbuf1;
  gp2 = gbuf2;
  for (var i = 0; i < total3; i++) {
    gp2[i] = floor(random(numStates));
    gp1[i] = gp2[i];
  }
}

function seedGH(probX, probR) {
  pb1 = buffer1;
  pb2 = buffer2;

  for (var y = 0; y < height; y++) {
    for (var x = 0; x < width; x++) {
      pb1[x][y] = 0;
      pb2[x][y] = 0;
    }
  }

  var nX = floor(pixelCount * probX);
  for (var i = 0; i < nX;) {
    var x = random(width); var y = random(height);
    if (pb2[x][y] == 0) { pb2[x][y] = 1; i++; }
  }

  var nR = floor(pixelCount * probR);
  for (var i = 0; i < nR;) {
    var x = random(width); var y = random(height);
    if (pb2[x][y] == 0) {
      pb2[x][y] = 2 + floor(random(numStates - 2));
      i++;
    }
  }
}

function seedGH3(probX, probR) {
  gp1 = gbuf1;
  gp2 = gbuf2;
  for (var i = 0; i < total3; i++) {
    gp1[i] = 0;
    gp2[i] = 0;
  }
  var nX = floor(total3 * probX);
  for (var i = 0; i < nX;) {
    var j = floor(random(total3));
    if (gp2[j] == 0) { gp2[j] = 1; i++; }
  }
  var nR = floor(total3 * probR);
  for (var i = 0; i < nR;) {
    var j = floor(random(total3));
    if (gp2[j] == 0) { gp2[j] = 2 + floor(random(numStates - 2)); i++; }
  }
}

function allocateFrameBuffers() {
  for (var i = 0; i < height; i++) {
    buffer1[i] = array(width);
    buffer2[i] = array(width);
  }
  pb1 = buffer1;
  pb2 = buffer2;
  gp1 = gbuf1;
  gp2 = gbuf2;
}

function swapBuffers() {
  var tmp = pb1; pb1 = pb2; pb2 = tmp;
}
function swapBuffers3() {
  var tmp = gp1; gp1 = gp2; gp2 = tmp;
}

function idx3(x, y, z) { return x + y * gw + z * gw * gh; }

function sumNeighborhood4(x, y, buffer) {
  return (buffer[x][ym] == nextVal) + (buffer[x][yp] == nextVal) +
    (buffer[xm][y] == nextVal) + (buffer[xp][y] == nextVal);
}

function sumNeighborhood8(x, y, buffer) {
  return (buffer[x][ym] == nextVal) + (buffer[x][yp] == nextVal) + (buffer[xm][y] == nextVal) +
    (buffer[xp][y] == nextVal) + (buffer[xm][ym] == nextVal) + (buffer[xp][ym] == nextVal) +
    (buffer[xm][yp] == nextVal) + (buffer[xp][yp] == nextVal);
}

// 6-neighborhood (axis neighbors) for 3D GH
function sumNeighborhood6(x, y, z, buf) {
  var xm = (x > 0) ? x - 1 : gw - 1;
  var xp = (x + 1) % gw;
  var ym = (y > 0) ? y - 1 : gh - 1;
  var yp = (y + 1) % gh;
  var zm = (z > 0) ? z - 1 : gd - 1;
  var zp = (z + 1) % gd;
  return (buf[idx3(xm, y, z)] == nextVal) + (buf[idx3(xp, y, z)] == nextVal) +
    (buf[idx3(x, ym, z)] == nextVal) + (buf[idx3(x, yp, z)] == nextVal) +
    (buf[idx3(x, y, zm)] == nextVal) + (buf[idx3(x, y, zp)] == nextVal);
}

// 26-neighborhood for 3D CCA
function sumNeighborhood26(x, y, z, buf) {
  var xm = (x > 0) ? x - 1 : gw - 1;
  var xp = (x + 1) % gw;
  var ym = (y > 0) ? y - 1 : gh - 1;
  var yp = (y + 1) % gh;
  var zm = (z > 0) ? z - 1 : gd - 1;
  var zp = (z + 1) % gd;

  var s = 0;
  s += (buf[idx3(xm, ym, zm)] == nextVal) + (buf[idx3(x, ym, zm)] == nextVal) + (buf[idx3(xp, ym, zm)] == nextVal);
  s += (buf[idx3(xm, y, zm)] == nextVal) + (buf[idx3(x, y, zm)] == nextVal) + (buf[idx3(xp, y, zm)] == nextVal);
  s += (buf[idx3(xm, yp, zm)] == nextVal) + (buf[idx3(x, yp, zm)] == nextVal) + (buf[idx3(xp, yp, zm)] == nextVal);
  s += (buf[idx3(xm, ym, z)] == nextVal) + (buf[idx3(x, ym, z)] == nextVal) + (buf[idx3(xp, ym, z)] == nextVal);
  s += (buf[idx3(xm, y, z)] == nextVal) + (buf[idx3(xp, y, z)] == nextVal);
  s += (buf[idx3(xm, yp, z)] == nextVal) + (buf[idx3(x, yp, z)] == nextVal) + (buf[idx3(xp, yp, z)] == nextVal);
  s += (buf[idx3(xm, ym, zp)] == nextVal) + (buf[idx3(x, ym, zp)] == nextVal) + (buf[idx3(xp, ym, zp)] == nextVal);
  s += (buf[idx3(xm, y, zp)] == nextVal) + (buf[idx3(x, y, zp)] == nextVal) + (buf[idx3(xp, y, zp)] == nextVal);
  s += (buf[idx3(xm, yp, zp)] == nextVal) + (buf[idx3(x, yp, zp)] == nextVal) + (buf[idx3(xp, yp, zp)] == nextVal);
  return s;
}

var xm, xp, ym, yp;
function doGenerationGH() {
  swapBuffers();
  nextVal = 1;
  for (var y = 0; y < height; y++) {
    yp = (y + 1) % height;
    ym = (y > 0) ? y - 1 : height - 1;
    for (var x = 0; x < width; x++) {
      xm = (x > 0) ? x - 1 : width - 1;
      xp = (x + 1) % width;
      if (pb1[x][y] == 0) {
        pb2[x][y] = (sumNeighborhood4(x, y, pb1) >= threshold);
      } else {
        pb2[x][y] = (pb1[x][y] + 1) % numStates;
      }
      sum += pb2[x][y];
    }
  }
}

function doGenerationCCA() {
  swapBuffers();
  for (var y = 0; y < height; y++) {
    yp = (y + 1) % height;
    ym = (y > 0) ? y - 1 : height - 1;
    for (var x = 0; x < width; x++) {
      xm = (x > 0) ? x - 1 : width - 1;
      xp = (x + 1) % width;
      nextVal = (pb1[x][y] + 1) % numStates;
      var s = sumNeighborhood8(x, y, pb1);
      pb2[x][y] = (s >= threshold) ? nextVal : pb1[x][y];
      sum += (pb2[x][y] != pb1[x][y]);
    }
  }
}

function doGeneration3GH() {
  swapBuffers3();
  nextVal = 1;
  for (var z = 0; z < gd; z++) {
    for (var y = 0; y < gh; y++) {
      for (var x = 0; x < gw; x++) {
        var i = idx3(x, y, z);
        if (gp1[i] == 0) {
          gp2[i] = (sumNeighborhood6(x, y, z, gp1) >= threshold);
        } else {
          gp2[i] = (gp1[i] + 1) % numStates;
        }
        sum3 += gp2[i];
      }
    }
  }
}

function doGeneration3CCA() {
  swapBuffers3();
  for (var z = 0; z < gd; z++) {
    for (var y = 0; y < gh; y++) {
      for (var x = 0; x < gw; x++) {
        var i = idx3(x, y, z);
        nextVal = (gp1[i] + 1) % numStates;
        var s = sumNeighborhood26(x, y, z, gp1);
        gp2[i] = (s >= threshold) ? nextVal : gp1[i];
        sum3 += (gp2[i] != gp1[i]);
      }
    }
  }
}

allocateFrameBuffers();

export function beforeRender(delta) {
  frameTimer += delta;
  patternTimer += delta;

  if ((sum == 0 && sum3 == 0) || (lifetime && (patternTimer > lifetime))) {
    seedCA();
    patternTimer = 0;
  }

  if (frameTimer > speed) {
    sum = 0;
    sum3 = 0;
    calcNextGen();
    calcNextGen3();
    frameTimer = 0;
  }
}

export function render2D(index, x, y) {
  x = (x * width);
  y = (y * height);
  var cell = pb2[x][y];
  var state = cell / numStates;
  hsv(state, 1, wave(state));
}

export function render3D(index, x, y, z) {
  var gx = floor(x * gw);
  var gy = floor(y * gh);
  var gz = floor(z * gd);
  if (gx < 0) gx = 0; else if (gx >= gw) gx = gw - 1;
  if (gy < 0) gy = 0; else if (gy >= gh) gy = gh - 1;
  if (gz < 0) gz = 0; else if (gz >= gd) gz = gd - 1;
  var cell = gp2[idx3(gx, gy, gz)];
  var state = cell / numStates;
  hsv(state, 1, wave(state));
}
