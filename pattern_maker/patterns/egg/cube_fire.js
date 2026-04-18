/*
  Cube fire 3D

  3D example: https://youtu.be/iTM-7ILud4M

  This pattern is designed for 3D mapped projects, but degrades gracefully in 2D
  and 1D.

  The base 3D variant is based on multiplying sine waves of x, y, and z
  position. This results in a regular 3D array of spheres. The size of the
  spheres pulses, and their position in 3D space oscillates at different
  frequencies.
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


speed = 0.5  // How fast the spheres travel through 3D space

export function beforeRender(delta) {

  setupPalette(delta);

  t1 = time(.1 / speed)    // x offset
  t2 = time(.13 / speed)   // y offset
  t3 = time(.085 / speed)  // z offset

  // Oscillate the scale coefficient of space between 0.25 and 0.75
  scale = (.5 + wave(time(.1))) / 2
}

export function render3D(index, x, y, z) {
  // Color is 20% dependent on each axis and cycling every 6.5 seconds
  h = x / 5 + y / 5 + z / 5 + t1

  // Since wave() returns a 0..1 sinusoid, and we multiply it by other
  // phase-offset wave()s, the final output will be a series of spheres in space
  // with a value of 0..10
  v = 10 * (wave(x * scale + wave(t1)) *
            wave(y * scale + wave(t2)) *
            wave(z * scale + wave(t3)))

  // The outer surface of the spheres, with the lowest values, will be white. v
  // values between 2 and 10 (the core of the spheres) will be colorful.
  s = v - 1

  /*
    This looks like typical gamma correction here, but really it only serves to
    increase the negative space between nearby spheres; after this the cores
    will all have v > 1 (e.g. center v == 10^3)
  */
  v = v * v * v

  // Ember floor: per-LED, time-varying glow so the egg never goes fully dark
  // when the sphere waves all bottom out together.
  ember = 0.04 + 0.06 * wave(x * 2 + y * 2 + z * 2 + t1 * 3)
  v = max(v, ember)

  // hsv() caps v at 1.0 internally; paint() does not, so unclamped v multiplies
  // every channel of the palette color past 1.0 and clips toward white. Cap to
  // keep saturated palette hues at the bright cores.
  //hsv(h, s, v)
  paint(h, min(v, 1))
}

// As we commonly do with 3D fields, a decent 2D rendering is a slice at z == 0
export function render2D(index, x, y) {
  render3D(index, x, y, 0)
}

/*
  A common approach to creating 1D versions of 3D patterns is to render the line
  in 3D where y & z = 0. To translate pixel indices to x's 0..1 world
  coordinates, divide index by pixelCount to output a 'percent this pixel is into
  the strip', i.e. 0..1. Evaluating this aesthetically in 1D, it seems to look
  best scaled out so we multiply by 8 to plot a longer line from 3D space.
*/
export function render(index) {
  render3D(index, index / pixelCount * 8, 0, 0)
}

