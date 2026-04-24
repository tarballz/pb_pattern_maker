/*
 Sine Wave Demo 2D/3D

 Shows a moving sine wave. In 2D: a horizontal traveling wave.
 In 3D: a rippling surface — sum of waves along x and z — with a y-axis
 cutoff line and optional fill below.

 09/15/2022 ZRanger1  (original 2D)
 2D/3D port
*/

export var lineWidth = 0.05;
export var fill = 0;
export var speed = 0.04;
export var frequency = 1;

var amplitude;
var tSpeed;

// controls wave movement speed
export function sliderSpeed(v) {
  speed = 0.1 * (1-v);
}

// frequency of sine wave
export function sliderFrequency(v) {
  frequency = 0.5 + (2*v);
}

// line width on display
export function sliderLineWidth(v) {
  lineWidth = 0.02 + (v * 0.3);
}

// fill below waveform, or not
export function sliderFill(v) {
  fill = (v >= 0.5);
}

// slowly modulate amplitude up and down, cache the traveling phase
export function beforeRender(delta) {
  amplitude = wave(time(0.1));
  tSpeed = time(speed);
}

export function render2D(index, x, y) {
  // flip y axis so "base" of wave is at the bottom of the display
  y = 1-y;

  var yWave = 0.5 + amplitude * (-0.5 + wave(frequency*x + tSpeed));

  if (abs(y - yWave) < lineWidth) {
    rgb(1, 1, 1);
  } else if (fill && y < yWave) {
    hsv((yWave - y) * 0.5, 1, 1);
  } else {
    rgb(0, 0, 0);
  }
}

export function render3D(index, x, y, z) {
  // y is vertical; the surface is built from waves along x and z.
  y = 1-y;

  // Average two orthogonal traveling waves to get a 2D ripple surface.
  var wX = wave(frequency*x + tSpeed);
  var wZ = wave(frequency*z + tSpeed * 1.3);
  var yWave = 0.5 + amplitude * (-0.5 + 0.5 * (wX + wZ));

  if (abs(y - yWave) < lineWidth) {
    rgb(1, 1, 1);
  } else if (fill && y < yWave) {
    hsv((yWave - y) * 0.5, 1, 1);
  } else {
    rgb(0, 0, 0);
  }
}
