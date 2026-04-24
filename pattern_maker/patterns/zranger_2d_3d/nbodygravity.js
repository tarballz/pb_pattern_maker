/* 2D/3D n-body gravity simulator

 Particles interact through gravity and wrap around the simulation
 volume.

 In 3D the particle state and gravity calculation are fully
 volumetric. Render uses a per-pixel nearest-particle distance with a
 soft-sphere falloff, avoiding any voxel buffer allocation.

 MIT License

 Version  Author        Date
 1.0.1    JEM(ZRanger1) 04/03/2021 (original 2D)
 2D/3D port
*/

// Particle state indices — now 7 wide (x,y,z,vx,vy,vz,hue)
var _x = 0;
var _y = 1;
var _z = 2;
var _dx = 3;
var _dy = 4;
var _dz = 5;
var _hue = 6;

var MAX_PARTICLES = 12;
export var numParticles = 4;
export var gravity = -0.002;
export var speed = 25;
var C = 0.012;            // local speed of light in normalized units per frame
var pRadius = 0.08;       // soft-sphere render radius
var pRadius2 = pRadius * pRadius;

var frameTimer = 9999;

export function sliderGravity(v) {
  gravity = -0.004 * (0.02 + v);
}

export function sliderSpeed(v) {
  speed = 120 * (1 - v);
}

var last_n = numParticles;
export function sliderParticles(v) {
  numParticles = 2 + floor(v * (MAX_PARTICLES - 2));
  if (last_n != numParticles) {
    initParticles();
    frameTimer = 9999;
    last_n = numParticles;
  }
}

var pb1 = array(MAX_PARTICLES);
var pb2 = array(MAX_PARTICLES);
var particles, work_particles;

function allocateParticleLists() {
  for (var i = 0; i < MAX_PARTICLES; i++) {
    pb1[i] = array(7);
    pb2[i] = array(7);
  }
}

function initParticles() {
  particles = pb1;
  work_particles = pb2;
  var hue = 0.001;
  for (var i = 0; i < MAX_PARTICLES; i++) {
    particles[i][_x] = random(1);
    particles[i][_y] = random(1);
    particles[i][_z] = random(1);
    particles[i][_dx] = 0;
    particles[i][_dy] = 0;
    particles[i][_dz] = 0;
    particles[i][_hue] = hue;
    hue = (hue + 0.27) % 1;
  }
}

function swapParticleBuffers() {
  var tmp = work_particles;
  work_particles = particles;
  particles = tmp;
}

function moveParticles() {
  for (var i = 0; i < numParticles; i++) {
    var accel_x = 0;
    var accel_y = 0;
    var accel_z = 0;
    for (var j = 0; j < numParticles; j++) {
      if (i == j) continue;
      var dx = (particles[i][_x] - particles[j][_x]);
      var dy = (particles[i][_y] - particles[j][_y]);
      var dz = (particles[i][_z] - particles[j][_z]);
      var r = hypot3(dx, dy, dz);
      if (r < 0.02) r = 0.02;
      var f = gravity / (r * r);
      accel_x += f * dx / r;
      accel_y += f * dy / r;
      accel_z += f * dz / r;
    }
    work_particles[i][_dx] = clamp(particles[i][_dx] + accel_x, -C, C);
    work_particles[i][_dy] = clamp(particles[i][_dy] + accel_y, -C, C);
    work_particles[i][_dz] = clamp(particles[i][_dz] + accel_z, -C, C);
    work_particles[i][_hue] = particles[i][_hue];

    var nx = particles[i][_x] + work_particles[i][_dx];
    if (nx < 0) nx += 1; else if (nx >= 1) nx -= 1;
    work_particles[i][_x] = nx;

    var ny = particles[i][_y] + work_particles[i][_dy];
    if (ny < 0) ny += 1; else if (ny >= 1) ny -= 1;
    work_particles[i][_y] = ny;

    var nz = particles[i][_z] + work_particles[i][_dz];
    if (nz < 0) nz += 1; else if (nz >= 1) nz -= 1;
    work_particles[i][_z] = nz;
  }
  swapParticleBuffers();
}

allocateParticleLists();
initParticles();

export function beforeRender(delta) {
  frameTimer += delta;
  if (frameTimer > speed) {
    moveParticles();
    frameTimer = 0;
  }
}

export function render2D(index, x, y) {
  // Find closest particle in xy plane using the z=0.5 slice
  var bestD2 = 10;
  var bestHue = 0;
  for (var i = 0; i < numParticles; i++) {
    var dx = x - particles[i][_x];
    var dy = y - particles[i][_y];
    var d2 = dx * dx + dy * dy;
    if (d2 < bestD2) { bestD2 = d2; bestHue = particles[i][_hue]; }
  }
  var v = 0;
  if (bestD2 < pRadius2) {
    v = 1 - (bestD2 / pRadius2);
    v = v * v;
  }
  hsv(bestHue, 1, v);
}

export function render3D(index, x, y, z) {
  var bestD2 = 10;
  var bestHue = 0;
  for (var i = 0; i < numParticles; i++) {
    var dx = x - particles[i][_x];
    var dy = y - particles[i][_y];
    var dz = z - particles[i][_z];
    var d2 = dx * dx + dy * dy + dz * dz;
    if (d2 < bestD2) { bestD2 = d2; bestHue = particles[i][_hue]; }
  }
  var v = 0;
  if (bestD2 < pRadius2) {
    v = 1 - (bestD2 / pRadius2);
    v = v * v;
  }
  hsv(bestHue, 1, v);
}
