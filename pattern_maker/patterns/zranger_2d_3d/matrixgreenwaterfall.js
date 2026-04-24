/*
  "The Matrix" rain — 2D/3D

  Per-column seeded drops: each column has its own random phase and speed.
  A drop is a bright head with a fading green tail that falls from the top,
  exits the bottom, and leaves the column dark until the next drop. Most
  columns are dark at any given moment — that's what makes the lit streaks
  read as rain instead of a uniform wash.

  Original 2D concept: JEM(zranger1) 7/15/21
  Rewritten for clear falling behaviour.
*/

var hue = 0.3333;     // matrix green
var speedBase = 0.08; // drops per tick; slider scales this
var colScale = 5;     // grid density (columns per unit of x, and z in 3D)
var tailLen = 0.55;   // streak length as fraction of y-extent
var cycleRange = 5.0; // y-traversal per cycle; > tailLen*2 ⇒ long dark gaps

var t, glyphT;

// Per-LED azimuth cache for render3D. atan2(z-0.5, x-0.5) is a fixed geometric
// constant per LED; computing ~1352 atan2 calls per frame is avoidable.
// Sentinel -999 means "not yet cached" (real thetas ∈ [-PI, PI]).
var thetaCache = array(pixelCount)
for (i = 0; i < pixelCount; i++) thetaCache[i] = -999

export function sliderSpeed(v) {
  // v=0 nearly frozen, v=1 brisk
  speedBase = 0.02 + v * 0.3;
}

export function sliderDensity(v) {
  // 2 to 48 columns per axis
  colScale = 2 + floor(v * 46);
}

export function sliderStrandLength(v) {
  // base streak length 0.15..0.9 of y-extent; per-column lenMul (0.4..2.0×)
  // still scales around this, so extremes span ~0.06 blips to full-egg ribbons
  tailLen = 0.15 + v * 0.75;
}

export function beforeRender(delta) {
  t = time(1.0) * 30;
  glyphT = time(0.02) * 31; // fast phase for per-pixel glyph flicker
}

// head position + distance-to-head, keyed on a stable per-column seed
function dropBrightness(y, seed) {
  prngSeed(seed);
  var offset = prng(1);
  var speedMul = 0.5 + prng(1);    // 0.5–1.5×
  var lenMul = 0.4 + prng(1.6);    // 0.4–2.0× tail length — short blips vs long streaks
  var localTail = tailLen * lenMul;

  var phase = mod(t * speedBase * speedMul + offset, 1);
  // PB normalizes map y so y=1 is the top; head enters above y=1 and falls
  // toward y=0 with the fading tail trailing above it.
  var headY = 1 + localTail - phase * cycleRange;

  var dy = y - headY; // 0 at head, positive above head (tail), negative below
  if (dy < 0 || dy > localTail) return 0;
  var b = 1 - dy / localTail;
  // per-pixel shimmer stands in for glyphs swapping within the streak
  var flicker = 0.55 + 0.45 * triangle(mod(glyphT + y * 11.3 + seed * 0.037, 1));
  return b * b * b * flicker;
}

function paintRain(b) {
  if (b <= 0) {
    hsv(0, 0, 0);
  } else if (b > 0.75) {
    // head stays pale green (sat floor 0.35) — never white
    hsv(hue, max(0.35, (1 - b) * 4), 1);
  } else {
    hsv(hue, 1, b);
  }
}

export function render2D(index, x, y) {
  var col = floor(x * colScale);
  // four independent drop streams per column — keeps per-column dark windows
  // rare so the whole display doesn't occasionally go blank
  var b1 = dropBrightness(y, col);
  var b2 = dropBrightness(y, col + 9973);
  var b3 = dropBrightness(y, col + 19441);
  var b4 = dropBrightness(y, col + 29303);
  paintRain(max(max(b1, b2), max(b3, b4)));
}

export function render3D(index, x, y, z) {
  // Cylindrical columns around the egg's vertical axis — drops wrap the
  // surface instead of following a cartesian lattice that leaves bins empty
  // at odd angles. theta ∈ [-PI, PI] → bin 0..colScale-1 around circumference.
  var theta = thetaCache[index];
  if (theta < -500) {
    theta = atan2(z - 0.5, x - 0.5);
    thetaCache[index] = theta;
  }
  var col = floor((theta / PI2 + 0.5) * colScale);
  // four independent drop streams per column — keeps per-column dark windows
  // rare so the whole display doesn't occasionally go blank
  var b1 = dropBrightness(y, col);
  var b2 = dropBrightness(y, col + 9973);
  var b3 = dropBrightness(y, col + 19441);
  var b4 = dropBrightness(y, col + 29303);
  paintRain(max(max(b1, b2), max(b3, b4)));
}
