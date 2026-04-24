/* Raindrops Falling on a Pool 2D/3D

 Requires a 2D or 3D LED array and appropriate pixel mapper. The 2D path is
 unchanged. In 3D the pool surface lies in the xz plane at y=0.5; the ripple
 image is sampled there and fades smoothly away as pixels move above/below.

 MIT License
 1.0.0    JEM(ZRanger1) 04/09/2021
 2D/3D port
*/

var width = 16;
var height = 16;

var buffer1 = array(height);
var buffer2 = array(height);
var bgImage = array(height);
var pb1, pb2;
var speed = 765;
var nextDrop = speed;
var damping = 0.85;
var frameTimer = 9999;
var dropTimer = 9999;

export function sliderRaindrops(v) {
  speed = 150 + 1400 * (1-v);
}

function allocateFrameBuffers() {
  for (var i = 0; i < height; i++) {
    buffer1[i] = array(width);
    buffer2[i] = array(width);
    bgImage[i] = array(width);
  }
  pb1 = buffer1;
  pb2 = buffer2;
}

function initBackground() {
  var m1 = random(8) - 4;
  for (var y = 0; y < height; y++) {
    for (var x = 0; x < width; x++) {
      var x1 = x / width; var y1 = y / height;
      var dx = x - 0.5;  var dy = y - 0.5;
      var val = (wave(x1 + y1) + wave(y1 * m1) +
        wave(sqrt(x1 * x1 + y1 * y1)) + wave(sqrt(dx * dx + dy * dy))) / 4;
      bgImage[x][y] = 0.667 + (0.4 * (val - 0.8));
    }
  }
}

function swapBuffers() {
  var tmp = pb1; pb1 = pb2; pb2 = tmp;
}

function doRipples() {
  swapBuffers();

  for (var y = 1; y < height-1; y++) {
    for (var x = 1; x < width-1; x++) {
      var val = ((pb1[x-1][y] + pb1[x+1][y] + pb1[x][y-1] + pb1[x][y+1]) / 4) - pb2[x][y];
      pb2[x][y] = (val * damping);
    }
  }
}

allocateFrameBuffers();
initBackground();

export function beforeRender(delta) {
  frameTimer += delta;
  dropTimer += delta;

  if (dropTimer > nextDrop) {
    var rx = 1 + floor(random(width - 2));
    var ry = 1 + floor(random(height - 2));
    pb1[rx][ry] = 1;

    nextDrop = random(speed);
    dropTimer = 0;
  }

  if (frameTimer > 33) {
    doRipples();
    frameTimer = 0;
  }
}

export function render2D(index, x, y) {
  x = floor(x * width);
  y = floor(y * height);
  bri = 0.3 + pb2[x][y]; bri = bri * bri;
  hsv(bgImage[x][y], 1.3 - bri, bri);
}

export function render3D(index, x, y, z) {
  // pool surface lies in the xz plane; sample the ripple buffer there
  var xi = floor(x * width);
  var zi = floor(z * height);
  var bri = 0.3 + pb2[xi][zi]; bri = bri * bri;
  // thin horizontal slab centered on y=0.5, fades smoothly above/below
  var yFade = 1 - smoothstep(0.12, 0.45, abs(y - 0.5));
  hsv(bgImage[xi][zi], 1.3 - bri, bri * yFade);
}
