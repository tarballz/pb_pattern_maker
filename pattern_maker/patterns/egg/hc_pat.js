/*
  Honeycomb 2D - with dynamic palettes
  This code takes the Honeycomb 2d code and makes it rotate between different
  palettes. It is based on the original Honeycomb 2D code, merged together and tweaked
  by ZacharyRD with ZRanger1's Gradient Palette Blending Demo code, both
  available in the PixelBlaze Pattern Library.

  This pattern is meant to be displayed on an LED matrix or other 2D surface
  defined in the Mapper tab, but also has 1D and 3D renderers defined.

  Output demo: https://youtu.be/u9z8_XGe684

  The mapper allows us to share patterns that work in 2D or 3D space without the
  pattern code being dependent on how the LEDs were wired or placed in space.
  That means these three installations could all render the same pattern after
  defining their specific LED placements in the mapper:

    1. A 8x8 matrix in a perfect grid, wired the common zigzag way
    2. Individual pixels on a strand mounted in a triangle hexagon grid
    3. Equal length strips wired as vertical columns on separate channels
         of the output expander board

  To get started quickly with matrices, there's an inexpensive 8x8 on the
  Pixelblaze store. Load the default Matrix example in the mapper and you're
  ready to go.

  This pattern builds on the example "pulse 2D". To best understand this one,
  start there.
*/

////////////////////////////////
// START PALETTE STUFF
////////////////////////////////

/* Each palette is created with http://fastled.io/tools/paletteknife/ and
http://soliton.vm.bytemark.co.uk/pub/cpt-city/index.html , then normalized
to 0.0 to 1.0 range.
*/

//http://soliton.vm.bytemark.co.uk/pub/cpt-city/nd/basic/tn/BlacK_Blue_Magenta_White.png.index.html
//black-blue-purple-pink-white
var black_Blue_Magenta_White_gp = [
    0,   0,  0,  0,
   42,   0,  0, 45,
   84,   0,  0,255,
  127,  42,  0,255,
  170, 255,  0,255,
  212, 255, 55,255,
  255, 255,255,255]

arrayMutate(black_Blue_Magenta_White_gp,(v, i ,a) => v / 255);

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


var palettes = [black_Blue_Magenta_White_gp, es_landscape_33_gp, bhw1_05_gp, bhw1_04_gp, Sunset_Real_gp, Analogous_3_gp, Analogous_1_gp]

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

////////////////////////////////
// END PALETTE STUFF
////////////////////////////////

export function beforeRender(delta) {

  setupPalette(delta)

  tf = 5 // Overall animation duration constant. A smaller duration runs faster.

  f  = wave(time(tf * 6.6 / 65.536)) * 5 + 2 // 2 to 7; Frequency (cell density)
  t1 = wave(time(tf * 9.8 / 65.536)) * PI2  // 0 to 2*PI; Oscillates x shift
  t2 = wave(time(tf * 12.5 / 65.536)) * PI2 // 0 to 2*PI; Oscillates y shift
  t3 = wave(time(tf * 9.8 / 65.536)) // Shift h: wavelength of tf * 9.8 s
  t4 = time(tf * 0.66 / 65.536) // Shift v: 0 to 1 every 0.66 sec


}

export function render2D(index, x, y) {
  z = (1 + sin(x * f + t1) + cos(y * f + t2)) * .5

  /*
    As explained in "Matrix 2D Pulse", z is now an egg-carton shaped surface
    in x and y. The number of hills/valles visible (the frequency) is
    proportional to f; f oscillates. The position of the centers in x and y
    oscillate with t1 and t2. z's value ranges from -0.5 to 1.5.

    First, we'll derive the brightness (v) from this field.

    t4 is a 0 to 1 sawtooth, so (z + t4) now is between -0.5 and 2.5 wave(z +
    t4) therefore cycles 0 to 1 three times, ever shifting (by t4) with respect
    to the original egg carton.
  */
  v = wave(z + t4)

  // Typical concave-upward brightness scaling for perceptual aesthetics.
  // v enters and exits as 0-1. 0 -> 0, 1 -> 1, but 0.5 -> 0.125
  v = v * v * v

  /*
    Triangle will essentially double the frequency; t3 will add an
    oscillating offset. With h in 0-1.5, hsv() "wraps" h, and since all
    these functions are continuous, it's just spending extra time on the
    hue wheel in the 0-0.5 range. Tweak this until you like how the final
    colors progress over time, but anything based on z will make colors
    related to the circles seen from above in the egg carton pattern.
  */
  h = triangle(z) / 2 + t3

  // original code does HSV. Using this instead of paint turns off all palettes.
  //hsv(h, 1, v)

  paint(h,v)

}

/*
  When there's no map defined, Pixelblaze will call render() instead of
  render2D() or render3D(), so it's nice to define a graceful degradation for 1D
  strips. For many geometric patterns, you'll want to define a projection down a
  dimension.
*/
export function render(index) {
  pct = index / pixelCount  // Transform index..pixelCount to 0..1
  // render2D(index, pct, pct)  // Render the diagonal of a matrix
  // render2D(index, pct, 0)    // Render the top row of a matrix
  render2D(index, 3 * pct, 0)   // Render 3 top rows worth to make it denser
}

// You can also project up a dimension. Think of this as mixing in the z value
// to x and y in order to compose a stack of matrices.
export function render3D(index, x, y, z) {
  x1 = (x - cos(z / 4 * PI2)) / 2
  y1 = (y - sin(z / 4 * PI2)) / 2
  render2D(index, x1, y1)
}

