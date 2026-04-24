// Creepy Crawling Spider 2D/3D
// In 3D the spider lives on a thin slab through the middle of the volume
// (along z) so the figure reads as a flat creature crawling on the surface.
//
// MIT License
// 9/24/2023 ZRanger1 (original 2D)
// 2D/3D port

var lineWidth = 0.15;
var baseHue = 0.022;
var abdomenDiameter = 0.112;
var webCrawl = 0;
var crawlAngle = 0;
var cosCrawl = 1, sinCrawl = 0;
var crawlTX = 0, crawlTY = 0;

// leg1, leg2 are original leg segments; l1, l2 are current positions.
var leg1 = [0.55, 0.25, 0.475];
var leg2 = [0.35, 0.85, 0.35];
var l1 = array(3);
var l2 = array(3);

function rotateLeg(inLeg, outLeg, angle) {
  var c1, s1;
  c1 = cos(angle); s1 = sin(angle);

  outLeg[0] = (c1 * inLeg[0]) - (s1 * inLeg[1]);
  outLeg[1] = (s1 * inLeg[0]) + (c1 * inLeg[1]);
  outLeg[2] = inLeg[2];
}

function drawLeg(r, x1, y1, px, py, plen, pcol) {
  if (r > plen) return 0;
  if ((x1 * px + y1 * py) < 0) return 0;

  z = abs(px * (py - y1) - (px - x1) * py) / plen;
  return 1 - (z / lineWidth);
}

var timebase = 0;
var lastPos = 0;
export function beforeRender(delta) {
  timebase = (timebase + delta / 1000) % 3600;
  crawlSpeed = (timebase / 9 % 1);

  legAngle = 0.1 * sin(timebase * 8);
  webCrawl = -3 * crawlSpeed + 1.5;

  if (lastPos < webCrawl) {
    crawlAngle = random(PI2);
  }
  lastPos = webCrawl;

  cosCrawl = cos(crawlAngle);
  sinCrawl = sin(crawlAngle);
  crawlTX = webCrawl;
  crawlTY = legAngle / 4;

  resetTransform();
  translate(-0.5, -0.5);
  rotate(crawlAngle);
  translate(webCrawl, legAngle / 4);

  rotateLeg(leg1, l1, legAngle);
  rotateLeg(leg2, l2, -legAngle * 0.85);
}

export function render2D(index, x, y) {
  r = hypot(x, y) - x / 6;
  r2 = hypot(x + 0.12, y);

  x = abs(x); y = abs(y);

  v = drawLeg(r, x, y, l1[0], l1[1], l1[2]);
  v = max(v, drawLeg(r, x, y, l2[0], l2[1], l2[2]));

  v = max(smoothstep(0.45, .8, v), (abdomenDiameter - r2) / abdomenDiameter);
  h = (r2 < abdomenDiameter) ? baseHue : baseHue + r2 / 2;

  hsv(h, 1, v);
}

export function render3D(index, x, y, z) {
  // manually apply the same 2D transform chain: translate(-0.5,-0.5),
  // rotate(crawlAngle), translate(webCrawl, legAngle/4).
  var cx = x - 0.5;
  var cy = y - 0.5;
  // rotate about z axis
  var rx = cx * cosCrawl - cy * sinCrawl;
  var ry = cx * sinCrawl + cy * cosCrawl;
  // final translate
  rx += crawlTX;
  ry += crawlTY;

  var rr = hypot(rx, ry) - rx / 6;
  var r2 = hypot(rx + 0.12, ry);

  var ax = abs(rx); var ay = abs(ry);

  var v = drawLeg(rr, ax, ay, l1[0], l1[1], l1[2]);
  v = max(v, drawLeg(rr, ax, ay, l2[0], l2[1], l2[2]));

  v = max(smoothstep(0.45, .8, v), (abdomenDiameter - r2) / abdomenDiameter);
  var hh = (r2 < abdomenDiameter) ? baseHue : baseHue + r2 / 2;

  // the spider lives on a slab at z=0.5; fade to black away from that plane
  var zFade = 1 - smoothstep(0.1, 0.4, abs(z - 0.5));
  hsv(hh, 1, v * zFade);
}
