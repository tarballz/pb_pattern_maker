# 3D Pattern Techniques

## Center-Based Coordinates

PixelBlaze maps deliver coordinates in 0.0–1.0 range. For most patterns, shift the origin to center:

```javascript
// In render3D:
var cx = x - 0.5  // range becomes -0.5 to 0.5
var cy = y - 0.5
var cz = z - 0.5
```

This makes distance calculations, rotations, and radial effects natural.

## Distance Patterns

### Sphere (3D)
```javascript
export function render3D(index, x, y, z) {
  var d = hypot3(x - 0.5, y - 0.5, z - 0.5)
  hsv(d * 2, 1, 1)  // hue changes with distance
}
```

### Circle (2D, in any plane)
```javascript
// XY plane circle
var d = hypot(x - 0.5, y - 0.5)
// XZ plane circle
var d = hypot(x - 0.5, z - 0.5)
```

### Distance falloff
```javascript
// Soft glow (inverse distance)
var brightness = 0.02 / (d * d + 0.02)

// Sharp edge (smoothstep)
var brightness = 1 - smoothstep(0.2, 0.25, d)

// Shell/ring (narrow band)
var brightness = 1 - smoothstep(0, 0.02, abs(d - 0.3))
```

### Expanding shells
```javascript
export function beforeRender(delta) {
  t = time(0.03)
}
export function render3D(index, x, y, z) {
  var d = hypot3(x - 0.5, y - 0.5, z - 0.5)
  var shell = wave(t - d * 3)  // 3 shells expanding outward
  hsv(d, 1, shell * shell)
}
```

## Rotation

Pre-compute sin/cos in beforeRender, apply as 2D rotation matrix.

### Rotate around Z axis
```javascript
var cosA, sinA

export function beforeRender(delta) {
  var angle = time(0.05) * PI2
  cosA = cos(angle)
  sinA = sin(angle)
}

export function render3D(index, x, y, z) {
  // Rotate XY plane around Z axis
  var cx = x - 0.5
  var cy = y - 0.5
  var rx = cx * cosA - cy * sinA
  var ry = cx * sinA + cy * cosA
  // Use rx, ry, z - 0.5 for the pattern
}
```

### Chain rotations for tumbling
```javascript
var cosA, sinA, cosB, sinB

export function beforeRender(delta) {
  var a = time(0.07) * PI2  // Y rotation
  var b = time(0.05) * PI2  // Z rotation
  cosA = cos(a); sinA = sin(a)
  cosB = cos(b); sinB = sin(b)
}

export function render3D(index, x, y, z) {
  var cx = x - 0.5, cy = y - 0.5, cz = z - 0.5
  // Rotate around Y
  var rx = cx * cosA - cz * sinA
  var rz = cx * sinA + cz * cosA
  // Rotate around Z
  var rx2 = rx * cosB - cy * sinB
  var ry2 = rx * sinB + cy * cosB
  // Use rx2, ry2, rz for the pattern
}
```

## Polar and Spherical Coordinates

### 2D polar (angle + radius)
```javascript
var angle = atan2(y - 0.5, x - 0.5)  // -PI to PI
var radius = hypot(x - 0.5, y - 0.5)
```

Note: `atan2` is expensive — if used per-pixel, accept the cost or limit LED count.

### Spherical (for 3D)
```javascript
var cx = x - 0.5, cy = y - 0.5, cz = z - 0.5
var r = hypot3(cx, cy, cz)          // radius
var theta = atan2(cy, cx)            // azimuth angle (XY plane)
var phi = acos(cz / max(r, 0.001))  // polar angle (from Z axis)
```

Spherical coordinates are expensive per-pixel. Use when the effect requires it (helix, latitude bands).

## Perlin Noise in 3D

### Static texture
```javascript
export function render3D(index, x, y, z) {
  var n = perlin(x * 4, y * 4, z * 4, 0)  // scale up for detail
  n = (n + 0.5)  // normalize to ~0–1
  hsv(n, 1, n * n)
}
```

### Animated flow (lava lamp)
Move coordinates through noise space along different axes:
```javascript
var noiseTime

export function beforeRender(delta) {
  noiseTime = time(7) * 256  // slow drift
}

export function render3D(index, x, y, z) {
  var h = perlin(x * 3 - noiseTime, y * 3, z * 3, 0)
  var v = perlin(x * 3, y * 3, z * 3 - noiseTime, 1)  // seed=1 for independent noise
  h = h + 0.5
  v = (v + 0.5)
  v = v * v * v  // gamma
  hsv(h, 1, v)
}
```

Key insight: different seeds (last parameter) produce independent noise fields. Animate different coordinates for organic, unpredictable motion.

### Multi-octave detail
```javascript
var n = perlinFbm(x * 4, y * 4, z * 4, 3)  // 3 octaves
```
More octaves = more detail but more expensive. 2-3 octaves is usually enough.

## Gamma Correction

LED brightness is perceived non-linearly. Always apply gamma to the value channel:

```javascript
// Quadratic — subtle improvement
hsv(h, s, v * v)

// Cubic — strong contrast, deep blacks
hsv(h, s, v * v * v)
```

Without gamma, patterns look washed out with mushy contrast.

## Multi-Layer Composition

### Additive layers
```javascript
var v1 = wave(t - d1)  // layer 1
var v2 = wave(t * 1.3 - d2) * 0.5  // layer 2 (dimmer)
var v = min(1, v1 + v2)  // add and clamp
```

### Multiplicative (mask)
```javascript
var pattern = wave(t - radius)
var mask = smoothstep(0.1, 0.4, y)  // fade out at top
hsv(h, 1, pattern * mask)
```

### Noise modulation
```javascript
var base = wave(t - d)  // clean wave
var noise = perlin(x * 5, y * 5, z * 5 - noiseTime, 0) + 0.5
var h = base * 0.7 + noise * 0.3  // mix clean + noisy
```

## Signed Distance Fields (SDF)

Basic idea: a function returns the distance from a point to a shape's surface. Negative = inside, positive = outside.

### Sphere SDF
```javascript
function sdfSphere(x, y, z, r) {
  return hypot3(x, y, z) - r
}

// Usage in render3D (coordinates already centered):
var d = sdfSphere(x - 0.5, y - 0.5, z - 0.5, 0.3)
var brightness = 1 - smoothstep(0, 0.02, abs(d))  // thin shell
```

### Plane SDF (useful for slicing)
```javascript
// Distance to horizontal plane at height h
function sdfPlaneY(y, h) {
  return y - h
}
```

SDFs combine naturally: `min(d1, d2)` = union, `max(d1, d2)` = intersection, `max(d1, -d2)` = subtraction.
