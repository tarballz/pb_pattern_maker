/* Conway's Life — 2D / 3D

 In 3D we use Bays' 3D Life rule 5766 (B5-7 / S6-7) with a 26-cell
 neighborhood. Grid is kept small (10 * 10 * 10 = 1000 cells * 2
 buffers) to fit memory and stay fast on Pixelblaze.

 MIT License

 Version  Author        Date
 1.0.0    JEM(ZRanger1) 05/02/2021 (original 2D)
 2D/3D port
*/

var width = 16;
var height = 16;

var buffer1 = array(height);
var buffer2 = array(height);
var pb1, pb2;

// 3D grid
var gw = 10;
var gh = 10;
var gd = 10;
var total3 = gw * gh * gd;
var gbuf1 = array(total3);
var gbuf2 = array(total3);
var gp1, gp2;

export var speed = 100;
export var lifetime = 9000;
var frameTimer = 9999;
var patternTimer = 9999;
var t1;

export function sliderSpeed(v) {
  v = 1 - v;
  speed = 1000 * v * v;
}

export function sliderLifetime(v) {
  lifetime = 1000 + (v * 29000);
}

function seedCA(prob) {
  for (var y = 1; y < height; y++) {
    for (var x = 1; x < width; x++) {
      pb2[x][y] = (random(1) < prob);
    }
  }
}

function seedCA3(prob) {
  for (var i = 0; i < total3; i++) {
    gp2[i] = (random(1) < prob);
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

function sumNeighborhood8(x, y, buffer) {
  xm = (x > 0) ? x - 1 : width - 1;
  ym = (y > 0) ? y - 1 : height - 1;
  xp = (x + 1) % width;
  yp = (y + 1) % height;

  return buffer[x][ym] + buffer[x][yp] + buffer[xm][y] + buffer[xp][y] +
    buffer[xm][ym] + buffer[xp][ym] + buffer[xm][yp] + buffer[xp][yp];
}

function idx3(x, y, z) {
  return x + y * gw + z * gw * gh;
}

// 26-cell neighborhood sum with toroidal wrap
function sumNeighborhood26(x, y, z, buf) {
  var xm = (x > 0) ? x - 1 : gw - 1;
  var ym = (y > 0) ? y - 1 : gh - 1;
  var zm = (z > 0) ? z - 1 : gd - 1;
  var xp = (x + 1) % gw;
  var yp = (y + 1) % gh;
  var zp = (z + 1) % gd;

  var s = 0;
  // 9 cells in z-1 plane
  s += buf[idx3(xm, ym, zm)] + buf[idx3(x, ym, zm)] + buf[idx3(xp, ym, zm)];
  s += buf[idx3(xm, y, zm)] + buf[idx3(x, y, zm)] + buf[idx3(xp, y, zm)];
  s += buf[idx3(xm, yp, zm)] + buf[idx3(x, yp, zm)] + buf[idx3(xp, yp, zm)];
  // 8 cells in z plane (skipping center)
  s += buf[idx3(xm, ym, z)] + buf[idx3(x, ym, z)] + buf[idx3(xp, ym, z)];
  s += buf[idx3(xm, y, z)] + buf[idx3(xp, y, z)];
  s += buf[idx3(xm, yp, z)] + buf[idx3(x, yp, z)] + buf[idx3(xp, yp, z)];
  // 9 cells in z+1 plane
  s += buf[idx3(xm, ym, zp)] + buf[idx3(x, ym, zp)] + buf[idx3(xp, ym, zp)];
  s += buf[idx3(xm, y, zp)] + buf[idx3(x, y, zp)] + buf[idx3(xp, y, zp)];
  s += buf[idx3(xm, yp, zp)] + buf[idx3(x, yp, zp)] + buf[idx3(xp, yp, zp)];
  return s;
}

function doGeneration() {
  swapBuffers();
  for (var y = 1; y < height; y++) {
    for (var x = 1; x < width; x++) {
      var sum = sumNeighborhood8(x, y, pb1);
      if (sum < 2 || sum > 3) { pb2[x][y] = 0; }
      else if (sum == 3) { pb2[x][y] = 1; }
      else { pb2[x][y] = pb1[x][y]; }
    }
  }
}

// 3D Life rule (Bays 5766): birth 5-7, survive 6-7
function doGeneration3() {
  swapBuffers3();
  for (var z = 0; z < gd; z++) {
    for (var y = 0; y < gh; y++) {
      for (var x = 0; x < gw; x++) {
        var sum = sumNeighborhood26(x, y, z, gp1);
        var i = idx3(x, y, z);
        var alive = gp1[i];
        if (alive) {
          gp2[i] = (sum >= 6 && sum <= 7) ? 1 : 0;
        } else {
          gp2[i] = (sum >= 5 && sum <= 7) ? 1 : 0;
        }
      }
    }
  }
}

allocateFrameBuffers();

export function beforeRender(delta) {
  frameTimer += delta;
  patternTimer += delta;

  t1 = time(0.08);

  if (patternTimer > lifetime) {
    seedCA(0.3);
    seedCA3(0.35);
    patternTimer = 0;
  }

  if (frameTimer > speed) {
    doGeneration();
    doGeneration3();
    frameTimer = 0;
  }
}

export function render2D(index, x, y) {
  x = floor(x * width);
  y = floor(y * height);
  hsv(t1, 1, (pb2[x][y] > 0) * 0.6);
}

export function render3D(index, x, y, z) {
  var gx = floor(x * gw);
  var gy = floor(y * gh);
  var gz = floor(z * gd);
  if (gx < 0) gx = 0; else if (gx >= gw) gx = gw - 1;
  if (gy < 0) gy = 0; else if (gy >= gh) gy = gh - 1;
  if (gz < 0) gz = 0; else if (gz >= gd) gz = gd - 1;
  hsv(t1, 1, (gp2[idx3(gx, gy, gz)] > 0) * 0.6);
}
