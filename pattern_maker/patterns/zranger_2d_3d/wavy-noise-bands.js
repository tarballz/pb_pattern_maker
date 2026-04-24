// Wavy Bands 2D/3D
//
// Requires a correctly configured 2D or 3D map.
//
// MIT License - use this code to make more cool things!
//
// 6/22/2023 ZRanger1 (original 2D)
// 2D/3D port

// number of displayed columns
export var nColumns = 4;

timebase = 0;
export function beforeRender(delta) {
  timebase = (timebase + delta / 1000) % 3600;

  tx = -timebase / 4;  // speed of x axis movement
  ty = timebase / 2;   // speed of y axis movement
  tz = timebase / 3;   // extra drift for z-axis noise
}

export function render2D(index, x, y) {
  // distort y coord with perlin noise to vary width of individual columns
  y -= 0.3 * perlin(x * 2, y * 2, ty, 1.618);

  // distort x coord to create wave patterns
  x += 0.1752 * sin(4 * (tx + y));

  h = floor(x * nColumns);

  v = (x * nColumns - 0.5);
  v = 1 - (2 * abs(v - h));

  hsv(h / nColumns, 0.9, pow(v, 1.25));
}

export function render3D(index, x, y, z) {
  // 3D noise distortion — z plus drift adds another degree of wiggle
  y -= 0.3 * perlin(x * 2, y * 2, z * 2 + ty, 1.618);

  // x distortion also pulls from z so the bands shear along depth
  x += 0.1752 * sin(4 * (tx + y + z));

  h = floor(x * nColumns);

  v = (x * nColumns - 0.5);
  v = 1 - (2 * abs(v - h));

  hsv(h / nColumns, 0.9, pow(v, 1.25));
}
