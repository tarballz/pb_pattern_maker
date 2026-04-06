# PixelBlaze Language Reference

## Number System

All numbers are 16.16 fixed-point format.
- Range: -32,768 to +32,768
- Fractional precision: 1/65,536
- No floating-point — all math is fixed-point under the hood

## Variables and Scoping

- `var name = value` — function-scoped variable
- `let name = value` — block-scoped variable
- `const name = value` — read-only block-scoped variable
- `name = value` (no keyword) — creates an implicit global
- `export var name` — exposes variable to the system
- `export function name()` — marks function for PixelBlaze to call

## Control Flow

Supported: `if`/`else`, `for`, `while`, `break`, `continue`, ternary (`? :`)

Not supported: `switch`, closures, destructuring, spread operator, string operations

## Globals

- `pixelCount` — total number of configured LEDs

## Render Pipeline

Called each frame in this order:
1. `beforeRender(delta)` — once per frame, `delta` = ms since last call
2. `render(index)` / `render2D(index, x, y)` / `render3D(index, x, y, z)` — once per pixel

All three render variants can coexist. PB picks the most specific one matching the map.

## Color Output (call in render functions)

| Function | Parameters | Notes |
|---|---|---|
| `hsv(h, s, v)` | All 0.0–1.0 | Hue wraps (values outside 0–1 are fine) |
| `rgb(r, g, b)` | All 0.0–1.0 | Direct RGB mapping |

## Math

| Function | Description |
|---|---|
| `abs(x)` | Absolute value |
| `floor(x)` | Round down |
| `ceil(x)` | Round up |
| `round(x)` | Round to nearest integer |
| `min(a, b)` | Minimum |
| `max(a, b)` | Maximum |
| `clamp(value, low, high)` | Constrain to range |
| `mod(a, b)` | Modulo (like % but always positive) |
| `pow(x, exp)` | Power |
| `sqrt(x)` | Square root |
| `exp(x)` | e^x |
| `log(x)` | Natural logarithm |
| `log2(x)` | Base-2 logarithm |
| `random(max)` | Random value 0 to max |

## Trigonometry

| Function | Description |
|---|---|
| `sin(radians)` | Sine |
| `cos(radians)` | Cosine |
| `tan(radians)` | Tangent |
| `asin(value)` | Arcsine |
| `acos(value)` | Arccosine |
| `atan(value)` | Arctangent |
| `atan2(y, x)` | Two-argument arctangent (angle from origin) |

Constants: `PI` (3.14159...), `PI2` (6.28318...)

## Distance

| Function | Description |
|---|---|
| `hypot(x, y)` | 2D distance: sqrt(x^2 + y^2), numerically stable |
| `hypot3(x, y, z)` | 3D distance: sqrt(x^2 + y^2 + z^2), numerically stable |

## Interpolation

| Function | Description |
|---|---|
| `mix(a, b, t)` | Linear interpolation: a + (b - a) * t |
| `smoothstep(low, high, v)` | Hermite smooth interpolation, returns 0–1 |

## Noise

| Function | Description | Return Range |
|---|---|---|
| `perlin(x, y, z, seed)` | Gradient noise (1D/2D/3D, seed optional) | approx -0.5 to 0.5 |
| `perlinFbm(x, y, z, octaves)` | Fractal Brownian Motion | wider than perlin |

To normalize perlin to 0–1: `(perlin(x, y, z, seed) + 0.5)`

All parameters except the last are positional — use fewer for lower dimensions:
- `perlin(x)` — 1D
- `perlin(x, y)` — 2D
- `perlin(x, y, z)` — 3D
- `perlin(x, y, z, seed)` — 3D with seed (different seeds = independent noise)

## Waveforms

| Function | Input | Output | Description |
|---|---|---|---|
| `time(interval)` | Speed parameter | Sawtooth 0–1 | Period = interval * 65.536 seconds |
| `wave(v)` | Sawtooth 0–1 | Sine 0–1 | More efficient than (1+sin(v*PI2))/2 |
| `triangle(v)` | Sawtooth 0–1 | Triangle 0–1 | Linear up-down |
| `square(v, duty)` | Sawtooth 0–1, duty 0–1 | Square 0 or 1 | Pulse width modulation |

## Arrays

- `array(size)` — create array of given size, initialized to 0
- `[a, b, c]` — array literal (module scope only!)
- `arr[index]` — access element
- `arr.length` — array length
- Methods: `.forEach(fn)`, `.map(fn)`, `.reduce(fn, init)`, `.sort(fn)`, `.mutate(fn)`

Memory limits:
- V2+: 64 arrays, 2,048 total elements
- V3: 10,240 arrays/elements
- No garbage collection — allocations are permanent

## UI Controls

Export specially-named functions to create controls in the PB web UI:

| Control | Signature | Value Range |
|---|---|---|
| Slider | `export function sliderName(v)` | v: 0.0–1.0 |
| Toggle | `export function toggleName(isOn)` | isOn: boolean |
| Number input | `export function inputNumberName(v)` | v: number |
| HSV picker | `export function hsvPickerName(h, s, v)` | All 0.0–1.0 |
| RGB picker | `export function rgbPickerName(r, g, b)` | All 0.0–1.0 |
| Button | `export function triggerName()` | (no value) |

Naming: CamelCase after prefix. `sliderSpeed`, `hsvPickerBaseColor`, `toggleMode`.

Values are saved and restored when the pattern loads. The function is called with the saved value on pattern activation and whenever the user changes the control.
