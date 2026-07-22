# PixelBlaze Safety Rules

## Will Crash or Hang the Device

### Array allocation in render functions
```javascript
// BAD — leaks memory, will eventually crash
export function render3D(index, x, y, z) {
  var colors = array(3)  // NEVER do this
  var list = [1, 2, 3]   // NEVER do this
}

// GOOD — allocate at module scope
var colors = array(3)
export function render3D(index, x, y, z) {
  colors[0] = x  // Fine — reusing existing array
}
```

### Infinite loops
Any `while` or `for` loop that doesn't terminate will hang the device. Always ensure loops have a clear exit condition. There is no watchdog timer.

### Dynamic array creation per frame
```javascript
// BAD — creates a new array every frame (60+ times/second)
export function beforeRender(delta) {
  var temp = array(pixelCount)  // Memory leak
}

// GOOD — create once at module scope
var temp = array(100)  // Allocated once, reused forever
```

## Will Cause Bugs

### No closures
Nested functions cannot access parent scope variables:
```javascript
// BAD — inner function can't see 'scale'
function outer(scale) {
  function inner(x) {
    return x * scale  // scale is undefined here
  }
}

// GOOD — use globals or pass as parameters
var scale = 1
function inner(x) {
  return x * scale  // globals are accessible
}
```

### No switch statements
Use if/else chains instead.

### No destructuring or spread
```javascript
// BAD
var [a, b] = someArray
var newArr = [...oldArr]

// GOOD
var a = someArray[0]
var b = someArray[1]
```

### Array callback scope
Array methods (forEach, map, reduce) cannot access variables from outside the callback function. Pass data through globals.

## Performance Budget

`render3D` is called `pixelCount` times per frame. At 1400 LEDs, that's 1400 calls. Budget accordingly.

### Cheap (fine in render):
- Arithmetic: `+`, `-`, `*`, `/`, `%`
- `abs()`, `min()`, `max()`, `clamp()`, `mod()`
- `hypot()`, `hypot3()` — optimized distance
- `mix()`, `smoothstep()`
- `wave()`, `triangle()`, `square()` — lookup-based
- Array access: `arr[i]`
- `hsv()`, `rgb()`

### Expensive (cache in beforeRender when possible):
- `sin()`, `cos()`, `tan()` — trig is costly
- `atan2()` — especially costly
- `sqrt()`, `log()`, `exp()`, `pow()`
- `perlin()`, `perlinFbm()` — noise generation
- `random()` — PRNG

### Very expensive (avoid in render):
- Nested loops
- Multiple perlin/perlinFbm calls per pixel
- Complex branching (many if/else)

### Practical limits by LED count:
- 100 LEDs: anything goes
- 500 LEDs: moderate complexity per pixel
- 1000+ LEDs: keep render minimal, cache everything possible
- For Voronoi patterns: max ~4-6 seed points at 1000+ LEDs

These thresholds are rules of thumb. To actually measure, run
`pb.py perf <pattern> --map <your map>` — it reports estimated FPS on a V3
for your real pixel count, and whether the pattern is compute-bound (optimize
the render function) or output-bound (the LED wiring is the ceiling, so
optimizing the pattern won't help).

## Fixed-Point Gotchas

### Overflow
```javascript
// BAD — intermediate result overflows 16.16 range
var result = a * b * c * d  // If any intermediate > 32768, wraps around

// GOOD — break up or scale down
var ab = a * b
var cd = c * d
var result = ab * cd  // Still risky but more controlled
```

### Precision loss
```javascript
// Values smaller than 1/65536 ≈ 0.0000153 round to zero
var tiny = 0.00001  // This is zero in PB
```

### Accumulation errors
Iterative algorithms (Game of Life, physics) accumulate fixed-point rounding errors over time. Plan for periodic resets or accept drift.
