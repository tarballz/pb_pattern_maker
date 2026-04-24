/*
  Spinwheel 2D/3D
  Colorful, flowerlike radial spinner.

  In 3D the atan2 still goes off the xy plane (so the colorful radial
  pinwheel reads correctly to an observer looking down the z axis) and
  the radial distance uses hypot3 so the rings pulse through the volume.

  7/09/21 JEM(zranger1) (original 2D)
  2D/3D port
*/

var t1, t2;
var speed = 6;
translate(-0.5, -0.5);

export function beforeRender(delta) {
  t1 = time(.2) * (-PI * wave(time(0.1)));
  t2 = wave(time(.2)) * speed;
}

export function render2D(index, x, y) {
  var arX = (atan2(x, y) + t1 * 30);
  var arY = (hypot(x, y) + t2);

  var phi = floor(arY) / PI2;
  phi += (phi == 0) * 0.618;

  arX = frac(arX);
  arY = frac(arY);

  var h = (.1 / (arX * arX + arY * arY) * .19) * phi;
  hsv(t1 + (x * y) + h, 1 - h, h);
}

export function render3D(index, x, y, z) {
  var cx = x - 0.5;
  var cy = y - 0.5;
  var cz = z - 0.5;

  // angle in the xy plane; radius in the full volume
  var arX = (atan2(cx, cy) + t1 * 30);
  var arY = (hypot3(cx, cy, cz) + t2);

  var phi = floor(arY) / PI2;
  phi += (phi == 0) * 0.618;

  arX = frac(arX);
  arY = frac(arY);

  var h = (.1 / (arX * arX + arY * arY) * .19) * phi;
  hsv(t1 + (cx * cy) + h + cz * 0.3, 1 - h, h);
}
