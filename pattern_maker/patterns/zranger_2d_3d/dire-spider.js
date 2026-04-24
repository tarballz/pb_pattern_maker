// Dire Spider 2D/3D (with poisonous web spray)
// In 3D the spider and the poison ridge-noise mist live on a thin slab
// through the middle of the volume (along z), smoothly fading away at
// the front and back.
//
// MIT License
// 10/24/2025 ZRanger1 (original 2D)
// 2D/3D port

export var lineWidth = 0.125;
var baseHue = 0.02;
var backGroundLevel = 0.012;
var abdomenDiameter = 0.125;
var webCrawl = 0;
var crawlAngle = 0;
var cosCrawl = 1, sinCrawl = 0;
var crawlTX = 0, crawlTY = 0;

export function sliderLegWidth(v) {
  lineWidth = mix(0.1, 0.2, v);
}

export function sliderBackgroundLevel(v) {
  backgroundLevel = mix(0, 0.3, v);
}

export var aDensity = 7, rDensity = 1;
setPerlinWrap(aDensity, 255, 255);

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

  morphTime = time(7) * 256;
  rTime = time(3) * 256;

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

function shadeDireSpider(x, y) {
  var rf = clamp(hypot(x, y), 0.0, 1.0);
  var r = rf - x / 6;
  var r2 = hypot(x + 0.12, y);
  var a = (atan2(y, x) + PI) / PI2;

  var f = perlinRidge(a * aDensity, rf * rDensity - rTime, morphTime, 2, .5, 1.1, 3);
  f = f * f * f * f;
  rf = 1 - rf;
  f *= rf;

  var ax = abs(x); var ay = abs(y);

  var v = drawLeg(r, ax, ay, l1[0], l1[1], l1[2]);
  v = max(v, drawLeg(r, ax, ay, l2[0], l2[1], l2[2]));

  v = max(smoothstep(0.45, .8, v), 4 * (abdomenDiameter - r2) / abdomenDiameter);
  var h, s;
  if (f >= v) {
    h = 0.33333 - .1 * f;
    s = 1 - f / 5;
    v = max(backgroundLevel, f);
  } else {
    h = (r2 < abdomenDiameter) ? baseHue : baseHue + r2 / 3;
    s = 1.0;
  }

  // pack h, s, v into a 3-wide scratch array (declared at module scope)
  colorOut[0] = h; colorOut[1] = s; colorOut[2] = v;
}

var colorOut = array(3);

export function render2D(index, x, y) {
  shadeDireSpider(x, y);
  hsv(colorOut[0], colorOut[1], colorOut[2]);
}

export function render3D(index, x, y, z) {
  var cx = x - 0.5;
  var cy = y - 0.5;
  // apply the same rotate(crawlAngle) + translate(webCrawl, legAngle/4)
  var rx = cx * cosCrawl - cy * sinCrawl + crawlTX;
  var ry = cx * sinCrawl + cy * cosCrawl + crawlTY;

  shadeDireSpider(rx, ry);
  var zFade = 1 - smoothstep(0.1, 0.4, abs(z - 0.5));
  hsv(colorOut[0], colorOut[1], colorOut[2] * zFade);
}
