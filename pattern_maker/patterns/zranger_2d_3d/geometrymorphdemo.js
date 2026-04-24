/* Geometry Morphing Demo 2D/3D

 Smooth transitions between animated geometric shapes.

 In 3D, the shapes become true 3D SDFs (sphere, cube, octahedron,
 torus, 3D cross, icosahedron-ish hex-star) and the morph runs through
 them the same way. The scene rotates in the xy plane and tumbles a
 bit in yz.

 MIT License
 1.0.0    ZRanger1 08/09/2021 (original 2D)
 2D/3D port
*/

export var objectSize = 0.4;
export var lineWidth = 0.05;
var filled = 1;

var numShapes = 6;
var shapeSdf = array(numShapes);
var shapeSdf3 = array(numShapes);
var shapeCompare = array(2);

var shape = 0;
var nextShape = 1;
var morphClock = 0;
var wait = 0;
var lerpPct = 0;
var theta = 0;
var phi = 0;
var cosA = 1, sinA = 0;
var cosB = 1, sinB = 0;
var timeHue = 0;

shapeCompare[0] = (f) => (abs(f) > lineWidth);
shapeCompare[1] = (f) => (f > lineWidth);

shapeSdf[0] = circle;
shapeSdf[1] = cross;
shapeSdf[2] = hexStar;
shapeSdf[3] = square;
shapeSdf[4] = triangle;
shapeSdf[5] = hexagon;

shapeSdf3[0] = sphere3;
shapeSdf3[1] = cross3;
shapeSdf3[2] = octahedron3;
shapeSdf3[3] = box3;
shapeSdf3[4] = torus3;
shapeSdf3[5] = hexPrism3;

function signum(a) {
  return (a > 0) - (a < 0);
}

// 2D SDFs (unchanged)
function circle(x, y, r) { return hypot(x, y) - r; }
function square(x, y, size) {
  dx = abs(x) - size; d1 = max(dx, 0);
  dy = abs(y) - size; d2 = max(dy, 0);
  return min(max(dx, dy), 0.0) + hypot(d1, d2);
}
function triangle(x, y, r) {
  return max((abs(x) * 0.866025) - (y * 0.5), y) - r / 2;
}
function hexagon(x, y, r) {
  x = abs(x); y = abs(y);
  return max((x * 0.5 + y * 0.866025), x) - r;
}
function hexStar(x, y, r) {
  x = abs(x * 1.73205); y = abs(y * 1.73205);
  dot = 2 * min(-0.5 * x + 0.866025 * y, 0);
  x -= dot * -0.5; y -= dot * 0.866025;
  dot = 2 * min(0.866025 * x + -0.5 * y, 0);
  x -= dot * 0.866025; y -= dot * -0.5;
  x -= clamp(x, r * 0.57735, r * 1.73205);
  y -= r;
  return signum(y) * hypot(x, y) / 1.73205;
}
function cross(x, y, size) {
  x = abs(x); y = abs(y);
  if (y > x) { tmp = x; x = y; y = tmp; }
  qx = x - size; qy = y - size / 5;
  k = max(qy, qx);
  if (k > 0) {
    wx = max(qx, 0); wy = max(qy, 0);
    return hypot(wx, wy);
  } else {
    wx = max(size - x, 0); wy = max(-k, 0);
    return -hypot(wx, wy);
  }
}

// 3D SDFs — signed distances for true volumetric shapes
function sphere3(x, y, z, r) {
  return hypot3(x, y, z) - r;
}
function box3(x, y, z, s) {
  var dx = abs(x) - s;
  var dy = abs(y) - s;
  var dz = abs(z) - s;
  var inside = min(max(dx, max(dy, dz)), 0.0);
  var ox = max(dx, 0); var oy = max(dy, 0); var oz = max(dz, 0);
  return inside + hypot3(ox, oy, oz);
}
function octahedron3(x, y, z, s) {
  return (abs(x) + abs(y) + abs(z) - s) * 0.57735;
}
function torus3(x, y, z, s) {
  // donut with major radius = s, minor radius = s/3
  var q = hypot(x, z) - s;
  return hypot(q, y) - s / 3;
}
function hexPrism3(x, y, z, s) {
  // hexagonal prism extruded along z
  var ax = abs(x); var ay = abs(y); var az = abs(z);
  var d2d = max(ax * 0.5 + ay * 0.866025, ax) - s;
  var dz = az - s * 0.6;
  var inside = min(max(d2d, dz), 0.0);
  var o1 = max(d2d, 0); var o2 = max(dz, 0);
  return inside + hypot(o1, o2);
}
function cross3(x, y, z, s) {
  // 3D plus/cross: union of three boxes along each axis
  var thick = s / 4;
  // box along x axis: long on x, thin on y,z
  var dax = max(abs(y) - thick, abs(z) - thick);
  var dbx = abs(x) - s;
  var armX = max(dax, dbx);
  var day = max(abs(x) - thick, abs(z) - thick);
  var dby = abs(y) - s;
  var armY = max(day, dby);
  var daz = max(abs(x) - thick, abs(y) - thick);
  var dbz = abs(z) - s;
  var armZ = max(daz, dbz);
  return min(armX, min(armY, armZ));
}

export function sliderSize(v) { objectSize = 0.4 * v; }
export function sliderFilled(v) { filled = (v >= 0.5); }
export function sliderLineWidth(v) { lineWidth = 0.25 * v * v; }

export function beforeRender(delta) {
  morphClock += delta;

  if (morphClock > 1000) {
    if (!wait) {
      shape = nextShape;
      nextShape = (nextShape + 1) % numShapes;
    }
    morphClock = 0;
    wait = !wait;
  }

  lerpPct = morphClock / 1000;

  theta = PI2 * time(0.1);
  phi = PI * time(0.17);
  cosA = cos(theta); sinA = sin(theta);
  cosB = cos(phi); sinB = sin(phi);

  timeHue = time(0.1);

  resetTransform();
  translate(-0.5, -0.5);
  rotate(theta);
}

export function render2D(index, x, y) {
  var d;
  var v = 0;
  var h = 0;
  var s = 0;

  if (wait) {
    d = shapeSdf[shape](x, y, objectSize);
  } else {
    d = shapeSdf[shape](x, y, objectSize) * (1 - lerpPct) + shapeSdf[nextShape](x, y, objectSize) * lerpPct;
  }

  if (!shapeCompare[filled](d)) {
    v = 1 - (d / lineWidth);
    s = 1.5 - abs(d) / objectSize;
    h = d + timeHue;
  }

  hsv(h, s, v * v);
}

export function render3D(index, x, y, z) {
  // center and rotate: first around z axis, then around x axis to tumble
  var cx = x - 0.5;
  var cy = y - 0.5;
  var cz = z - 0.5;

  // rotate around z (xy plane) by theta
  var rx = cx * cosA - cy * sinA;
  var ry = cx * sinA + cy * cosA;
  var rz = cz;

  // rotate around x (yz plane) by phi for a slow tumble
  var ry2 = ry * cosB - rz * sinB;
  var rz2 = ry * sinB + rz * cosB;

  var d;
  if (wait) {
    d = shapeSdf3[shape](rx, ry2, rz2, objectSize);
  } else {
    d = shapeSdf3[shape](rx, ry2, rz2, objectSize) * (1 - lerpPct) +
        shapeSdf3[nextShape](rx, ry2, rz2, objectSize) * lerpPct;
  }

  var v = 0;
  var h = 0;
  var s = 0;

  if (!shapeCompare[filled](d)) {
    v = 1 - (d / lineWidth);
    s = 1.5 - abs(d) / objectSize;
    h = d + timeHue;
  }

  hsv(h, s, v * v);
}
