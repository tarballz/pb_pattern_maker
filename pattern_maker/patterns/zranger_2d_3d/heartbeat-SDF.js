// Heartbeat SDF 2D/3D
//
// Anti-aliased beating heart. The 2D path uses the original 2D heart SDF
// from https://github.com/zranger1/SDF-LED. The 3D path uses the classic
// Taubin heart implicit surface (x² + 9y²/4 + z² − 1)³ − x²z³ − 9y²z³/80,
// with LED y mapped to the heart's vertical axis.
//
// Inspired by @geekmomproject's heartbeat pattern:
// https://forum.electromage.com/t/beating-heart-pattern/2418
//
// 12/2022 ZRanger1 (original 2D)
// 2D/3D port

var heartSize;
var t1;
// offsets of the heart center from the volume center
var offX, offY;

// 2D heart SDF: returns 1-r so value peaks at center and drops moving outward.
function heart2(x, y, r) {
  x = x / r * 0.75;
  y = -y / r + 0.5 - sqrt(abs(x));
  r = hypot(x, y);
  return 1 - r;
}

// Taubin 3D heart implicit function. Negative inside, positive outside.
// X,Y,Z expected in the heart's native coordinate frame:
//   X = horizontal, Z = vertical (lobes up, point down), Y = depth.
function heart3(X, Y, Z) {
  var a = X*X + 9 * Y*Y / 4 + Z*Z - 1;
  return a*a*a - X*X * Z*Z*Z - 9 * Y*Y * Z*Z*Z / 80;
}

export function beforeRender(delta) {
  // heart size, beat amplitude and speed
  t1 = time(0.012);
  heartSize = 0.35 - 0.1 * wave(t1);

  // move the heart around the center of the volume in a small circle
  var offset = PI2 * time(0.1);
  offX = 0.2 * sin(offset);
  offY = 0.2 * cos(offset);
}

export function render2D(index, x, y) {
  // shift so the heart is centered at (offX, offY) relative to display center
  var cx = x - 0.5 - offX;
  var cy = y - 0.5 - offY;

  // normalized signed distance (1 at center, drops moving outward)
  var d = heart2(cx, cy, heartSize) / heartSize;

  // pulsing wave moving outward from the center
  d *= 0.15 + triangle(t1 + d / 4);

  // negative brightness clips to black on PB
  hsv(0.9 + 0.1 * d, 1, d);
}

export function render3D(index, x, y, z) {
  // Map LED coords into the heart's native frame.
  // LED y is vertical on the installation -> heart Z (lobes up).
  // LED x -> heart X (width). LED z -> heart Y (depth).
  // Flip sign on vertical so the heart's point is at the bottom of the LED space.
  var inv = 1 / heartSize;
  var hx = (x - 0.5 - offX) * inv;
  var hz = (0.5 + offY - y) * inv;
  var hy = (z - 0.5) * inv;

  // Heart implicit: f < 0 inside, f > 0 outside.
  var f = heart3(hx, hy, hz);

  // Brightness is highest at the surface, tapering off both ways.
  // Map f -> normalized distance-ish signal, then pulse.
  var d = 1 - smoothstep(0, 0.25, abs(f));

  // same pulsing wave as 2D, driven by the heart-space position
  d *= 0.15 + triangle(t1 + hx * 0.25 + hz * 0.25);

  hsv(0.9 + 0.1 * d, 1, d * d);
}
