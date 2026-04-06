# PixelBlaze Waveform & Timing Reference

## time(interval)

Returns a sawtooth wave cycling 0.0 to 1.0.

Period = `interval * 65.536` seconds.

### Timing Table

| interval | Period | Use case |
|---|---|---|
| 0.005 | ~0.33s | Fast flicker |
| 0.01 | ~0.65s | Quick pulse |
| 0.015 | ~1.0s | Standard animation |
| 0.03 | ~2.0s | Moderate speed |
| 0.05 | ~3.3s | Slow drift |
| 0.1 | ~6.5s | Very slow |
| 0.5 | ~33s | Glacial |
| 1.0 | ~65s | Ultra slow |

### Usage
```javascript
// Always call in beforeRender, never in render
export function beforeRender(delta) {
  t1 = time(0.1)  // slow sawtooth
}
```

`time()` is synchronized across multiple PixelBlazes on the same network.

## wave(v)

Converts a sawtooth (0–1) to a sine curve (0–1).

Equivalent to `(1 + sin(v * PI2)) / 2` but more efficient.

```javascript
export function beforeRender(delta) {
  t = time(0.05)
  w = wave(t)  // smooth oscillation 0–1
}
```

## triangle(v)

Converts a sawtooth (0–1) to a triangle wave (0–1).
Linear ramp up to 1.0, then linear ramp down to 0.0.

```javascript
export function beforeRender(delta) {
  t = time(0.05)
  w = triangle(t)  // linear back-and-forth
}
```

## square(v, duty)

Converts a sawtooth to a square wave. Output is 0 or 1.
`duty` (0–1) controls pulse width: 0.5 = 50% on, 0.1 = 10% on.

```javascript
export function beforeRender(delta) {
  t = time(0.05)
  w = square(t, 0.5)  // 50% duty cycle
}
```

## Combining Waveforms

### Traveling wave (outward from center)
```javascript
export function beforeRender(delta) {
  t = time(0.03)
}
export function render3D(index, x, y, z) {
  radius = hypot3(x - 0.5, y - 0.5, z - 0.5)
  v = wave(t - radius)  // wave expands outward
  hsv(0, 0, v * v)
}
```

### Amplitude modulation
```javascript
export function beforeRender(delta) {
  carrier = wave(time(0.02))   // fast
  envelope = wave(time(0.1))   // slow
  brightness = carrier * envelope
}
```

### Phase offset (multi-layer)
```javascript
export function beforeRender(delta) {
  t = time(0.05)
}
export function render3D(index, x, y, z) {
  // Three waves at different phases create complex motion
  v1 = wave(t + x)
  v2 = wave(t * 1.3 + y)
  v3 = wave(t * 0.7 + z)
  v = (v1 + v2 + v3) / 3
  hsv(v, 1, v * v)
}
```

### Position sweep
```javascript
export function beforeRender(delta) {
  pos = triangle(time(0.05))  // sweeps 0–1–0
}
export function render3D(index, x, y, z) {
  dist = abs(z - pos)
  v = max(0, 1 - dist * 10)  // bright band at z = pos
  hsv(0.6, 1, v * v)
}
```

## Frame-Rate Independence with delta

`beforeRender(delta)` receives milliseconds since last call. Use for physics:

```javascript
var position = 0
var velocity = 0.001  // units per millisecond

export function beforeRender(delta) {
  position += velocity * delta
  if (position > 1) position = 0
}
```

`time()` is already frame-rate independent — use it for most animations. Use `delta` for physics simulations where you need explicit velocity/acceleration.
