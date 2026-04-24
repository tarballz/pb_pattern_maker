/* Time Flies 2D/3D

 "Time flies like an arrow.  Fruit flies like a banana..."

 In 3D the flies swim through the full volume: each fly has a 3D
 position and two angles (heading in xy, pitch in xz) that shift with
 the same wave-noise function.

 MIT License

 Version  Author        Date
 1.0.0    JEM(ZRanger1) 06/26/2021 (original 2D)
 2D/3D port
*/

var FLY_VECTOR_SIZE = 10;
var _x = 0;
var _y = 1;
var _z = 2;
var _heading = 3;   // yaw angle
var _pitch = 4;     // pitch angle (elevation)
var _speed = 5;
var _noiseT = 6;
var _hue = 7;
var _size = 8;

var t1, t2;
var frameTime = 9999;
var moveTime = 9999;
var numFlies = 7;
var maxTurn = 0.25;
var maxSpeed = 0.12;
var minSpeed = 0.002;

var flies = array(numFlies);

function initFlies() {
  for (var i = 0; i < numFlies; i++) {
    flies[i] = array(FLY_VECTOR_SIZE);
    flies[i][_x] = random(1);
    flies[i][_y] = random(1);
    flies[i][_z] = random(1);
    flies[i][_heading] = random(1);
    flies[i][_pitch] = random(1);
    flies[i][_speed] = 0;
    flies[i][_noiseT] = random(1);
    flies[i][_hue] = i / numFlies;
  }
}

function moveFlies(headingChange) {
  for (var i = 0; i < numFlies; i++) {
    flies[i][_noiseT] = (t1 + flies[i][_noiseT]) % 1;
    flies[i][_speed] = clamp(flies[i][_speed] + waveNoise1(flies[i][_noiseT]), minSpeed, maxSpeed);

    var sp = flies[i][_speed];
    var heading = flies[i][_heading] * PI2;
    var pitch = flies[i][_pitch] * PI2;
    var cosP = cos(pitch);

    flies[i][_x] = clamp(flies[i][_x] - (cos(heading) * cosP * sp), 0, 1);
    flies[i][_y] = clamp(flies[i][_y] - (sin(heading) * cosP * sp), 0, 1);
    flies[i][_z] = clamp(flies[i][_z] - (sin(pitch) * sp), 0, 1);
    flies[i][_size] = 0.055 + t2;

    if (headingChange) {
      var dx = flies[i][_x] - 0.5;
      var dy = flies[i][_y] - 0.5;
      var dz = flies[i][_z] - 0.5;
      var t = hypot3(dx, dy, dz);
      t = maxTurn * (6 * t);
      flies[i][_heading] = frac(flies[i][_heading] + waveNoise1(flies[i][_noiseT]) * t);
      flies[i][_pitch] = frac(flies[i][_pitch] + waveNoise1(flies[i][_noiseT] + 0.31) * t);
    }
  }
}

var frequency = 4;
function waveNoise1(x) {
  var y = triangle(x * frequency);
  y += wave(x * frequency * 2.1) * 4.5;
  y += wave(x * frequency * 2.221 + 0.437) * 5.0;
  y += wave(x * frequency * 5.296 + 4.269) * 2.5;
  y = (y * 0.19) - 1.25;
  return y;
}

initFlies();

export function beforeRender(delta) {
  t1 = time(15 / 65.535);
  t2 = 0.033 * time(0.004);

  frameTime += delta;
  moveTime += delta;

  if (moveTime > 60) {
    var headingChange = frameTime > 200;
    moveFlies(headingChange);
    moveTime = 0;
    if (headingChange) frameTime = 0;
  }
}

export function render(index) { ; }

export function render2D(index, x, y) {
  v = 0; h = 1;
  for (var i = 0; i < numFlies; i++) {
    dx = x - flies[i][_x]; dy = y - flies[i][_y];
    if (abs(dx + dy) > flies[i][_size]) continue;
    h = hypot(dx, dy);
    if (h < flies[i][_size]) {
      v = 1 - (h << 3); v = v * v * v;
      h = flies[i][_hue];
      break;
    }
  }
  hsv(h, 1, v);
}

export function render3D(index, x, y, z) {
  var v = 0; var h = 1;
  for (var i = 0; i < numFlies; i++) {
    var dx = x - flies[i][_x];
    var dy = y - flies[i][_y];
    var dz = z - flies[i][_z];
    // manhattan bbox pre-check
    if (abs(dx) + abs(dy) + abs(dz) > flies[i][_size]) continue;
    var d = hypot3(dx, dy, dz);
    if (d < flies[i][_size]) {
      v = 1 - (d << 3); v = v * v * v;
      h = flies[i][_hue];
      break;
    }
  }
  hsv(h, 1, v);
}
