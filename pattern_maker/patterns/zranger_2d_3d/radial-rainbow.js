// Radial Rainbow 2D/3D
// Sound-reactive radial rainbow. In 2D: ring radiates from center.
// In 3D: spherical shells radiate from the volume center. In both cases,
// the angular bucket into frequencyData[] is computed from the xy-plane
// angle so audio mapping feels the same regardless of dimension.
//
// Initial circle/rainbow code by @zranger1
// Modified for sound by @scruffynerf
// 2D/3D port

export var speed = 0.5;
export var direction = 1;
export var size = 100;
export var spin = 1;
export var spincycle = 0;
export var spincyclearray = 0;

export var frequencyData;
export var angle;

// UI sliders

// higher is faster
export function sliderSpeed(v) {
  speed = 1-v;
}

// left = inward, right = outward
export function sliderDirection(v) {
  direction = (v < 0.5) ? 1 : -1;
}

// sizing
export function sliderSize(v) {
  size = 200*v;
}

// spin
export function sliderSpin(v) {
  spin = v;
}

// 2D pythagorean distance from center, normalized 0..1
function getRadius2D(x, y) {
  x -= 0.5; y -= 0.5;
  return sqrt(x*x + y*y) * 2;
}

// 3D distance from volume center, normalized 0..1
function getRadius3D(x, y, z) {
  x -= 0.5; y -= 0.5; z -= 0.5;
  return sqrt(x*x + y*y + z*z) * 2;
}

// Angle bucket in the xy plane (0..31).
function getAngle(x, y) {
  x -= 0.5; y -= 0.5;
  angle = floor(((atan2(y, x) + PI) / 4) * 32) % 32;
  angle = (angle + spincyclearray) % 32;
  return angle;
}

// sawtooth timer for color animation; spin advances the angle bucket offset
export function beforeRender(delta) {
  t1 = direction * time(0.08 * speed);
  spincycle = (spincycle + spin) % 32;
  spincyclearray = floor(spincycle);
}

export function render2D(index, x, y) {
  var radius = getRadius2D(x, y);
  var bri = (radius <= frequencyData[getAngle(x, y)] * size) ? 1 : 0.3;
  hsv(t1 + radius, 1, bri);
}

export function render3D(index, x, y, z) {
  var radius = getRadius3D(x, y, z);
  var bri = (radius <= frequencyData[getAngle(x, y)] * size) ? 1 : 0.3;
  hsv(t1 + radius, 1, bri);
}
