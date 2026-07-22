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
| `frac(x)` | Fractional part: `x - floor(x)` |

**No `cbrt`, `sign`, `trunc`, `Math.*`, `Number.*`, or JS-style casts.** For cube root use `pow(x, 1/3)`.

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
| `perlinFbm(x, y, z, lacunarity, gain, octaves)` | Fractal Brownian Motion (6 args — verified against shipped patterns) | wider than perlin |
| `perlinTurbulence(x, y, z, lacunarity, gain, octaves)` | Abs-value fbm (billowy) | 0+ |
| `perlinRidge(x, y, z, lacunarity, gain, offset, octaves)` | Ridged multifractal | 0+ |
| `setPerlinWrap(xPeriod, yPeriod, zPeriod)` | Make perlin tile with integer periods | — |

To normalize perlin to 0–1: `(perlin(x, y, z, seed) + 0.5)`

All parameters except the last are positional — use fewer for lower dimensions:
- `perlin(x)` — 1D
- `perlin(x, y)` — 2D
- `perlin(x, y, z)` — 3D
- `perlin(x, y, z, seed)` — 3D with seed (different seeds = independent noise)

## Gradient palettes

| Function | Description |
|---|---|
| `setPalette(arr)` | Install a gradient palette from a flat array `[pos,r,g,b, pos,r,g,b, ...]` — positions ascending 0–1, colors 0–1. Call in `beforeRender` (cheap; rebuild/blend arrays there too) |
| `paint(pos, v)` | Emit the palette color at `pos` (0–1) scaled by brightness `v` (`v` optional, defaults 1). Unlike `hsv()`, `v` is **not clamped** — values >1 push channels toward white; clamp first unless deliberate |

Palette arrays must be pre-allocated outside render functions like any other
array. House convention: patterns carry a `palettes` array of named stops
(what `palette_maker`'s `palette.py insert` targets) and blend/install the
active one in `beforeRender` — see `color-craft.md` and `patterns/egg/lava_lamp.js`.

## Seeded PRNG

| Function | Description |
|---|---|
| `prngSeed(seed)` | Set the seed for the deterministic PRNG |
| `prng(max)` | Next pseudo-random value 0–max under the current seed |

Use for per-pixel or per-frame random values that need to be reproducible (e.g. streak phases keyed on column index). Seed, call `prng` as many times as needed, re-seed to get the same sequence again.

## Curves

| Function | Description |
|---|---|
| `bezierCubic(t, p0, p1, p2, p3)` | Cubic Bézier interpolation at t∈[0,1] |

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

### Free-function array ops (alternative to methods)

| Function | Description |
|---|---|
| `arrayMutate(arr, (v, i, a) => newV)` | In-place map; same as `arr.mutate(fn)` |
| `arrayMapTo(src, dst, (v, i, a) => newV)` | Map `src` into pre-allocated `dst` |
| `arraySortBy(arr, indexArr)` | Sort `indexArr` so `arr[indexArr[k]]` is ascending (arr is unchanged) |

## 2D/3D Transforms (V3)

Applied before the next `render*` call. `resetTransform` reverts to identity. Transforms are cumulative within a frame — typically call `resetTransform()` in `beforeRender` before re-applying.

| Function | Description |
|---|---|
| `resetTransform()` | Clear to identity |
| `translate(dx, dy)` / `translate3D(dx, dy, dz)` | Shift origin |
| `scale(sx, sy)` | Uniform or per-axis scale |
| `rotate(theta)` / `rotate2D(theta)` | 2D rotation (radians) |
| `rotateX(theta)` / `rotateY(theta)` / `rotateZ(theta)` | 3D rotations around each axis |

## Clock / Sync

| Function | Description |
|---|---|
| `clockHour()` | Current hour (0–23) from the PB clock |
| `clockMinute()` | Current minute (0–59) |
| `clockSecond()` | Current second (0–59) |
| `requestSync()` | Request clock sync with server/master |
| `syncTime(ms)` | Manually set the clock |
| `resetTime()` | Reset the internal millisecond counter |

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
