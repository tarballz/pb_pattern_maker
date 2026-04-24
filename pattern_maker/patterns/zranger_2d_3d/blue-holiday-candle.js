// Candle flame using distorted circles - 2D/3D
// Yet another way to make fire!
//
// In 3D the flame becomes a vertical column: the candle base sits at
// the bottom, the blue inner and orange outer "rings" become
// cylindrical shells around the vertical axis, and the flicker
// modulates around the azimuth.
//
// MIT License
// 1/25/2023 ZRanger1 (original 2D)
// 2D/3D port

var numTwinklers = 3;
var twinkleSpeed = 0.01;
export var tIndex = array(numTwinklers);
export var tPos = 0;
export var twinklers = array(numTwinklers);
var twinkleState = array(numTwinklers);
var twinkleIncrement = array(numTwinklers);
var timebase;
var t1, t2;

translate(-0.5, -0.5);
scale(1, -1);

function sortIndex(v1, v2) {
  return (twinklers[v1] < twinklers[v2]) ? -1 : 0;
}

export function beforeRender(delta) {
  timebase = (timebase + delta / 1000) % 3600;

  t1 = -0.875 + (wave(time(0.06)) + wave(time(0.03)) / 2 + wave(time(0.015)) / 4);
  t2 = timebase * 2;

  for (i = 0; i < numTwinklers; i++) {
    if (twinkleState[i] <= 0) {
      twinklers[i] = floor(random(pixelCount));
      twinkleIncrement[i] = 0.0075 + twinkleSpeed * random(1);
      twinkleState[i] = 1;
    } else {
      twinkleState[i] -= twinkleIncrement[i];
    }
    tIndex[i] = i;
  }

  arraySortBy(tIndex, sortIndex);
  ak = tPos;
  tPos = 0;
}

export function render2D(index, x, y) {
  f = max(0, (-(abs(x) - 0.425)) * (y < -0.4));

  x *= 1.75;
  x += (-0.5 + wave(6 * y * t1)) * (y + 0.5) * 0.175;

  d = (hypot(x, y) - 0.1) + (y / 3);
  s = 1 - clamp(d / 0.15, 0, 1);
  s += s * (-0.5 + 0.5 * triangle(t2 + x * 5 + y * 11));

  d = abs(hypot(x, y) - 0.33);
  h = 1 - smoothstep(0, 0.15, d);

  r = s * 0.2 + h * 0.9;
  g = s * 0.3 + (h * 0.4 * (1 - 2 * y));
  b = s + f;

  if ((r + g + b) > 0.05) {
    rgb(r, g, b);
  } else {
    if (tPos < numTwinklers && index == twinklers[tIndex[tPos]]) {
      hsv(0.025, 0.15, 0.75 * wave(-.25 + twinkleState[tIndex[tPos]]));
      tPos++;
      return;
    }
    hsv(0.75, 1, 0.02);
  }
}

export function render3D(index, x, y, z) {
  // PB normalizes map y so y=1 is the top of the fixture; keep uy aligned
  // with it so the candle base sits at y=0 and the flame rises to y=1.
  // Column radius is distance in the xz plane.
  var cx = x - 0.5;
  var cz = z - 0.5;
  var uy = y - 0.5; // -0.5 at bottom (y=0), +0.5 at top (y=1)

  var rxz = hypot(cx, cz);
  var az = atan2(cz, cx); // azimuth for flicker distortion

  // candle body: short cylinder at the bottom
  var f = max(0, (-(rxz - 0.14)) * (uy < -0.4));

  // distort radius a little with vertical-phase sine so flame is
  // organic rather than a perfect cylinder
  var distort = (-0.5 + wave(6 * uy * t1 + az)) * (uy + 0.5) * 0.12;
  var reff = rxz + distort;

  // inner (blue) cylindrical shell
  var d = (reff - 0.08) + (uy / 3);
  var sBlue = 1 - clamp(d / 0.15, 0, 1);
  sBlue += sBlue * (-0.5 + 0.5 * triangle(t2 + reff * 5 + uy * 11 + az * 3));

  // outer (orange) cylindrical shell
  d = abs(reff - 0.26);
  var hOrange = 1 - smoothstep(0, 0.13, d);

  var rr = sBlue * 0.2 + hOrange * 0.9;
  var gg = sBlue * 0.3 + (hOrange * 0.4 * (1 - 2 * uy));
  var bb = sBlue + f;

  if ((rr + gg + bb) > 0.05) {
    rgb(rr, gg, bb);
  } else {
    if (tPos < numTwinklers && index == twinklers[tIndex[tPos]]) {
      hsv(0.025, 0.15, 0.75 * wave(-.25 + twinkleState[tIndex[tPos]]));
      tPos++;
      return;
    }
    hsv(0.75, 1, 0.02);
  }
}
