/*
  Spotlights / rotation 3D

  This pattern demonstrates one way to rotationally transform 3D space, which
  results in the impression we're rotating whatever pattern was generated.

  3D example: https://youtu.be/uoAJg5J6F1Q

  This pattern assumes a 3D installation that's been mapped in the Mapper tab,
  but degrades to somewhat less interesting projections in 2D and 1D.
*/


// START PALETTE STUFF

//http://soliton.vm.bytemark.co.uk/pub/cpt-city/es/landscape/tn/es_landscape_33.png.index.html
//brown-yellow-forest-green
var es_landscape_33_gp = [
    0,   1,  5,  0,
   19,  32, 23,  1,
   38, 161, 55,  1,
   63, 229,144,  1,
   66,  39,142, 74,
  255,   1,  4,  1]

arrayMutate(es_landscape_33_gp,(v, i ,a) => v / 255);

//http://soliton.vm.bytemark.co.uk/pub/cpt-city/bhw/bhw1/tn/bhw1_05.png.index.html
//teal to purple
var bhw1_05_gp = [
    0,   1,221, 53,
  255,  73,  3,178]

arrayMutate(bhw1_05_gp,(v, i ,a) => v / 255);


var Adrift_green_gp = [
0, 148,223, 77,   51, 148,223, 77,   51,  86,182, 89,  102,  86,182, 89,  102,  36,131, 72,  153,  36,131, 72,  153,   5, 61, 51,  204,   5, 61, 51,  204,   1, 15, 29,  255,   1, 15, 29
]
arrayMutate(Adrift_green_gp, (v, i, a) => v / 255);

var quagga_gp = [
0,   1,  9, 84,   40,  42, 24, 72,   84,   6, 58,  2,  168,  88,169, 24,  211,  42, 24, 72,  255,   1,  9, 84
]
arrayMutate(quagga_gp, (v, i, a) => v / 255);

//http://soliton.vm.bytemark.co.uk/pub/cpt-city/bhw/bhw1/tn/bhw1_04.png.index.html
//yellow-orange-purple-navy
var bhw1_04_gp = [
    0, 229,227,  1,
   15, 227,101,  3,
  142,  40,  1, 80,
  198,  17,  1, 79,
  255,   0,  0, 45]

arrayMutate(bhw1_04_gp,(v, i ,a) => v / 255);

//http://soliton.vm.bytemark.co.uk/pub/cpt-city/nd/atmospheric/tn/Sunset_Real.png.index.html
//red-orange-pink-purple-blue
var Sunset_Real_gp = [
    0, 120,  0,  0,
   22, 179, 22,  0,
   51, 255,104,  0,
   85, 167, 22, 18,
  135, 100,  0,103,
  198,  16,  0,130,
  255,   0,  0,160]

arrayMutate(Sunset_Real_gp,(v, i ,a) => v / 255);

// http://soliton.vm.bytemark.co.uk/pub/cpt-city/nd/red/tn/Analogous_3.png.index.html
//purple pink red, with more purple than red.
var Analogous_3_gp = [
    0,  67, 55,255,
   63,  74, 25,255,
  127,  83,  7,255,
  191, 153,  1, 45,
  255, 255,  0,  0]

arrayMutate(Analogous_3_gp,(v, i ,a) => v / 255);

// http://soliton.vm.bytemark.co.uk/pub/cpt-city/nd/red/tn/Analogous_1.png.index.html
//blue-purple-red evenly split out.
var Analogous_1_gp = [
    0,   3,  0,255,
   63,  23,  0,255,
  127,  67,  0,255,
  191, 142,  0, 45,
  255, 255,  0,  0]

arrayMutate(Analogous_1_gp,(v, i ,a) => v / 255);


var palettes = [es_landscape_33_gp, bhw1_05_gp, bhw1_04_gp, Sunset_Real_gp, Analogous_3_gp, Analogous_1_gp, Adrift_green_gp, quagga_gp]

// control variables for palette switch timing (these are in seconds)
var PALETTE_HOLD_TIME = 10
var PALETTE_TRANSITION_TIME = 3;

// internal variables used by the palette manager.
// Usually not necessary to change these.
export var currentIndex = 0;
var nextIndex = (currentIndex + 1) % palettes.length;

// primarily useful for testing, go to the next palette in the main array. Skips the blend step.
export function triggerIncrementPalette(){
  currentIndex = (currentIndex + 1) % palettes.length;
}

// arrays to hold rgb interpolation results
var pixel1 = array(3);
var pixel2 = array(3);

// array to hold calculated blended palette
var PALETTE_SIZE = 16;
var currentPalette = array(4 * PALETTE_SIZE)

// timing related variables
var inTransition = 0;
var blendValue = 0;
runTime = 0

// Startup initialization for palette manager
setPalette(currentPalette);
buildBlendedPalette(palettes[currentIndex],palettes[nextIndex],blendValue)

// user space version of Pixelblaze's paint function. Stores
// interpolated rgb color in rgbArray
function paint2(v, rgbArray, pal) {
  var k,u,l;
  var rows = pal.length / 4;

  // find the top bounding palette row
  for (i = 0; i < rows;i++) {
    k = pal[i * 4];
    if (k >= v) break;
  }

  // fast path for special cases
  if ((i == 0) || (i >= rows) || (k == v)) {
    i = 4 * min(rows - 1, i);
    rgbArray[0] = pal[i+1];
    rgbArray[1] = pal[i+2];
    rgbArray[2] = pal[i+3];
  }
  else {
    i = 4 * (i-1);
    l = pal[i]   // lower bound
    u = pal[i+4]; // upper bound

    pct = 1 -(u - v) / (u-l);

    rgbArray[0] = mix(pal[i+1],pal[i+5],pct);
    rgbArray[1] = mix(pal[i+2],pal[i+6],pct);
    rgbArray[2] = mix(pal[i+3],pal[i+7],pct);
  }
}

// utility function:
// interpolate colors within and between two palettes
// and set the LEDs directly with the result.  To be
// used in render() functions
function paletteMix(pal1, pal2, colorPct,palettePct) {
  paint2(colorPct,pixel1,pal1);
  paint2(colorPct,pixel2,pal2);

  rgb(mix(pixel1[0],pixel2[0],palettePct),
      mix(pixel1[1],pixel2[1],palettePct),
      mix(pixel1[2],pixel2[2],palettePct)
   )
}

// construct a new palette in the currentPalette array by blending
// between pal1 and pal2 in proportion specified by blend
function buildBlendedPalette(pal1, pal2, blend) {
  var entry = 0;

  for (var i = 0; i < PALETTE_SIZE;i++) {
    var v = i / PALETTE_SIZE;

    paint2(v,pixel1,pal1);
    paint2(v,pixel2,pal2);

    // build new palette at currrent blend level
    currentPalette[entry++] = v;
    currentPalette[entry++] = mix(pixel1[0],pixel2[0],blend)
    currentPalette[entry++] = mix(pixel1[1],pixel2[1],blend)
    currentPalette[entry++] = mix(pixel1[2],pixel2[2],blend)
  }
}

function setupPalette(delta)
{
  runTime = (runTime + delta / 1000) % 3600;

  // Palette Manager - handle palette switching and blending with a
  // tiny state machine
  if (inTransition) {
    if (runTime >= PALETTE_TRANSITION_TIME) {
      // at the end of a palette transition, switch to the
      // next set of palettes and reset everything for the
      // normal hold period.
      runTime = 0;
      inTransition = 0
      blendValue = 0
      currentIndex = (currentIndex + 1) % palettes.length
      nextIndex = (nextIndex + 1) % palettes.length

    }
    else {
      // evaluate blend level during transition
      blendValue = runTime / PALETTE_TRANSITION_TIME
    }

    // blended palette is only recalculated during transition times. The rest of
    // the time, we run with the current palette at full speed.
    buildBlendedPalette(palettes[currentIndex],palettes[nextIndex],blendValue)
  }
  else if (runTime >= PALETTE_HOLD_TIME) {
    // when hold period ends, switch to palette transition
    runTime = 0
    inTransition = 1
  }
}

// END PALETTE STUFF


scale = 1 / (PI * PI) // How wide the "spotlights" are
speed = 0.3           // How fast they rotate around

export function beforeRender(delta) {
  setupPalette(delta);

  // We could just use sin(time()) to output -1..1, but that's almost too smooth
  t1 = 2 * triangle(time(.03 / speed)) - 1
  t2 = 2 * triangle(time(.04 / speed)) - 1
  t3 = 2 * triangle(time(.05 / speed)) - 1
  t4 = time(.02 / speed)

  // The axis we'll rotate around is a vector (t1, t2, t3) - each -1..1.
  // The angle to rotate about it is a 0..2*PI sawtooth.
  setupRotationMatrix(t1, t2, t3, t4 * PI2)
}

export function render3D(index, _x, _y, _z) {
  // Shift (0, 0, 0) to be the center of the world, not the rear-top-left
  x = _x - 0.5; y = _y - 0.5; z = _z - 0.5

  /*
    In beforeRender(), setupRotationMatrix() calculated a rotation matrix for
    this frame. rotate3D() now applies it to the current pixel's [shifted]
    position. As seen below, this sets rotated global variables rx, ry, and rz.
    You could also return an array of [rx, ry, rz], but that adds one slightly
    slower step to an already computationally-intense pattern.
  */
  rotate3D(x, y, z)

  /*
    `dist` is the distance (in world units) from a cone's surface to this
    pixel. Positive values are inside the cone. If you try a different scale
    for x vs y, you'll see elliptical cones.
  */
  dist = abs(rz) - sqrt(rx * rx / scale + ry * ry / scale)

  dist = clamp(dist, -1, 1) // Try commenting this out.. Whoa!

  // Palette index drifts along the rotated z axis plus a slow time cycle, so
  // the spotlight body has a gradient and the whole thing migrates through
  // the palette as time passes. Cone cores clip past 1.0 toward white.
  h = rz + t4
  paint(h, pow(1 + dist, 4))
}

// A planar slice of this pattern will look like a projection surface that
// someone's waving a flashlight at.
export function render2D(index, x, y) {
  render3D(index, x, y, 0)
}

// In 1D it's a frenetic swooping region
export function render(index) {
  render3D(index, index / pixelCount * 2, 0, 0)
}



/*
  setupRotationMatrix()
  Takes a vector (ux, uy, uz) which will be the axis to rotate around,
    and an angle in radians.
  Computes a 3D rotation matrix and stores it in a global named R

  https://en.wikipedia.org/wiki/Rotation_matrix
*/

var R = array(3); for (i=0; i<3; i++) R[i] = array(3)  // init 3x3, R[r][c]

function setupRotationMatrix(ux, uy, uz, angle) {
  // Rescale ux, uy, uz to make sure it's a unit vector, length = 1
  length = sqrt(ux * ux + uy * uy + uz * uz)
  ux /= length; uy /=length; uz /= length

  // Precompute a few reused values
  cosa = cos(angle); sina = sin(angle)
  ccosa = 1 - cosa
  xyccosa = ux * uy * ccosa
  xzccosa = ux * uz * ccosa
  yzccosa = uy * uz * ccosa
  xsina = ux * sina; ysina = uy * sina; zsina = uz * sina

  R[0][0] = cosa + ux * ux * ccosa
  R[0][1] = xyccosa - zsina
  R[0][2] = xzccosa + ysina
  R[1][0] = xyccosa + zsina
  R[1][1] = cosa + uy * uy * ccosa
  R[1][2] = yzccosa - xsina
  R[2][0] = xzccosa - ysina
  R[2][1] = yzccosa + xsina
  R[2][2] = cosa + uz * uz * ccosa
}

/*
  rotate3D()
  Takes 3 coordinates (x, y, z) and expects R to be a global rotation matrix.
  Sets globals rx, ry, and rz as the rotated point's new coordinates.
  (Globals are used for speed and convenience in the Pixelblaze lang)
*/
var rx, ry, rz
function rotate3D(x, y, z) {
  rx = R[0][0] * x + R[0][1] * y + R[0][2] * z
  ry = R[1][0] * x + R[1][1] * y + R[1][2] * z
  rz = R[2][0] * x + R[2][1] * y + R[2][2] * z
}
