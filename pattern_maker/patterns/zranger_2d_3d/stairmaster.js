/*
  Stairmaster 2D/3D - a ball bouncing on an escalator

  2D: ball bounces across square matrix against a moving stair pattern.
  3D: the stairs become 3D stacked planes extending along z, and the ball is
  a true sphere; visually you get a column of stair-steps you can look
  through.

  MIT License
  2022 ZRanger1 (original 2D)
  2D/3D port
*/

var numSteps = 4;
var ballRadius = 0.125;
var masterClock = 0.08;
var stairTimer, ballTimer;

translate(0, -0.25);

export function beforeRender(delta) {
  stairTimer = time(masterClock);
  ballTimer = -0.1 + wave(time(masterClock / numSteps)) * 0.32;
}

export function render2D(index, x, y) {
  var stairs = (y + stairTimer) - floor((stairTimer + x) * numSteps) / numSteps;
  var ball = 1 - (hypot(x - 0.5, y - ballTimer) / ballRadius);
  b = max(stairs, ball);
  hsv(x, 1.25 - y, b);
}

export function render3D(index, x, y, z) {
  // stairs quantize along y using both x and z as the diagonal walking axis,
  // so the steps extend into depth instead of collapsing onto a line
  var diag = (x + z) * 0.5;
  var stairs = (y + stairTimer) - floor((stairTimer + diag) * numSteps) / numSteps;

  // true 3D ball: centered at (0.5, ballTimer, 0.5)
  var ball = 1 - (hypot3(x - 0.5, y - ballTimer, z - 0.5) / ballRadius);

  var b = max(stairs, ball);
  hsv(diag, 1.25 - y, b);
}
