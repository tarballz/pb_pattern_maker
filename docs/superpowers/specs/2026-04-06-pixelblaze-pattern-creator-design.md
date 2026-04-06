# PixelBlaze Pattern Creator — Design Spec

## Context

We need a knowledge system that makes Claude Code an expert PixelBlaze pattern author. The primary use case is writing 2D and 3D patterns for mapped LED installations (first project: ~1400-1500 LEDs on a 3D egg sculpture). Patterns are written as standalone .js files in PixelBlaze's ES6 subset, then manually pasted into the device's web editor. An MCP server for direct device push may be added later.

The approach is **AGENTS.md + reference library**: curated knowledge files that give Claude deep understanding of the PB language, safety constraints, and pattern idioms. No template engine, no simulator — Claude writes patterns from understanding, not from fill-in-the-blank.

---

## Project Structure

```
~/code/pb/pattern_maker/
├── AGENTS.md                  # System prompt for Claude as PB pattern expert
├── CLAUDE.md                  # Project commands and conventions
├── validate.py                # Static analysis for PB safety rules
├── references/
│   ├── language.md            # Complete PB built-in function reference
│   ├── 3d-techniques.md       # Spatial pattern techniques (2D and 3D)
│   ├── safety-rules.md        # What will crash PB, performance budget
│   └── waveforms.md           # Animation timing reference
├── examples/
│   ├── organic/               # Noise-based, natural patterns
│   │   ├── lava_flow.js
│   │   ├── aurora.js
│   │   ├── fire.js
│   │   ├── breathing_pulse.js
│   │   ├── flowing_water.js
│   │   ├── nebula.js
│   │   └── fireflies.js
│   ├── geometric/             # Mathematical, structured patterns
│   │   ├── helix_spiral.js
│   │   ├── expanding_rings.js
│   │   ├── kaleidoscope.js
│   │   ├── spinning_planes.js
│   │   ├── wave_interference.js
│   │   └── voronoi_cells.js
│   └── utility/               # Testing and debugging
│       ├── solid_color.js
│       ├── coordinate_debug.js
│       └── distance_gradient.js
├── patterns/                  # Per-project output
│   └── egg/
└── maps/                      # Per-project LED coordinate maps
    └── egg_map.json
```

---

## AGENTS.md

### Identity

General-purpose PixelBlaze pattern author for 2D and 3D mapped LED installations. Writes production-ready .js pattern files. Knows the full PB language, its constraints, and performance characteristics.

### Mandatory Rules (priority order)

1. **Never crash the device** — no array allocation in render functions, no dynamic allocation in hot paths, no infinite loops
2. **Code validity** — ES6 subset only: no switch, no closures, no destructuring, no spread operator
3. **Performance** — all frame-level math in beforeRender(delta). render/render2D/render3D is called pixelCount times per frame — minimize work there
4. **Fixed-point awareness** — 16.16 format, range -32768 to +32768, precision 1/65536. Watch for overflow in multiplication chains
5. **Always include UI controls** — at minimum a speed slider and brightness slider
6. **Apply gamma correction** — use v*v or v*v*v for perceptual brightness on value channel

### Pattern Template

Every pattern follows this skeleton:

```javascript
// Pattern Name
// Description of what it does
// Sliders: Speed (animation rate), Brightness (overall intensity)

var speed = 0.05
var brightness = 1

export function sliderSpeed(v) { speed = 0.01 + v * 0.1 }
export function sliderBrightness(v) { brightness = v }

export function beforeRender(delta) {
  t1 = time(speed)
  // frame-level calculations here
}

export function render3D(index, x, y, z) {
  // per-pixel calculations here
  // use x - 0.5, y - 0.5, z - 0.5 for center-based math
  hsv(h, s, v * brightness)
}

// Include render2D when the math naturally supports it
export function render2D(index, x, y) {
  render3D(index, x, y, 0)
}
```

### Reference Pointers

Before writing any pattern, read:
- `references/safety-rules.md` — what will crash the device
- `references/language.md` — built-in functions and their signatures
- `references/3d-techniques.md` — spatial techniques
- `references/waveforms.md` — animation timing

Study examples in `examples/` for idiomatic PB code.

### Output Convention

- Write patterns to `patterns/<project>/<name>.js`
- Include comment header: name, description, slider descriptions
- Descriptive filenames: `lava_flow.js`, `helix_spiral.js`
- Export both render2D and render3D where the math allows
- When asked for a pattern, ask which project subdirectory (or write a generic one)

### Workflow

1. Read the relevant reference files
2. Write the pattern following the template
3. Mentally verify against safety-rules.md before presenting
4. Suggest the user run `uv run python validate.py <file>` before pasting into the device

---

## Reference Files

### references/language.md

Complete built-in function reference organized by category:

- **Math**: abs, floor, ceil, round, min, max, clamp, mod, pow, sqrt, exp, log, log2
- **Trigonometry**: sin, cos, tan, asin, acos, atan, atan2
- **Distance**: hypot(x,y), hypot3(x,y,z)
- **Interpolation**: mix(a,b,t), smoothstep(low,high,v)
- **Noise**: perlin(x,[y,[z,[seed]]]), perlinFbm(x,[y,[z,]]octaves)
- **Waveforms**: time(interval), wave(v), triangle(v), square(v,duty)
- **Color output**: hsv(h,s,v), rgb(r,g,b), paint(value[,brightness])
- **Arrays**: array(size), forEach, map, reduce, sort, mutate
- **Globals**: pixelCount

Each function: signature, parameter ranges, return value, one-line usage example.

Also covers:
- Number system: 16.16 fixed-point, range, precision
- Variable scoping: var (function), let/const (block), implicit globals, export
- Control flow: if/else, for, while, ternary — no switch, no closures
- UI controls: sliderX(v), toggleX(v), hsvPickerX(h,s,v), rgbPickerX(r,g,b), inputNumberX(v), triggerX()

### references/3d-techniques.md

Spatial pattern techniques for 2D and 3D:

- **Center-based math**: why x-0.5, y-0.5, z-0.5 matters, coordinate range shift
- **Distance patterns**: spheres via hypot3, circles via hypot, shells via distance bands, distance falloff (1/d, exp(-d))
- **Traveling waves**: wave(t - radius) for outward propagation, wave(t - z) for planar sweep
- **Rotation**: pre-compute sin/cos in beforeRender, apply as 2D rotation matrix, chain for 3D
- **Polar/spherical coordinates**: atan2(y,x) for angle, hypot for radius, convert to angular patterns
- **Perlin noise in space**: noise at pixel coords for texture, animated by shifting coords through noise field, lava lamp technique (independent axes), multi-octave FBM for detail
- **Gamma correction**: v*v (quadratic) or v*v*v (cubic) for perceptual brightness, why linear looks washed out
- **Multi-layer effects**: combining noise + distance + waves, additive vs multiplicative blending
- **SDF basics**: signed distance to shapes (circle, line), use for outlines and fills

### references/safety-rules.md

What will crash or degrade PixelBlaze:

**Will crash/hang:**
- Array allocation (`array()` or `[...]`) inside render functions — memory leak, eventual crash
- Infinite loops — device hangs, needs hard reset
- Dynamic array creation per frame — memory exhaustion

**Will cause bugs:**
- Closures (nested functions can't access parent scope variables)
- switch statements (not supported)
- Destructuring, spread operator (not supported)
- String operations (numbers only)
- Array bounds overflow (no bounds checking)

**Performance killers (at 1000+ LEDs):**
- Expensive functions in render without beforeRender caching: perlin, perlinFbm, atan2, log, sqrt, sin, cos
- time() called per-pixel instead of once per frame
- Nested loops in render
- More than ~4-6 Voronoi seed points

**Fixed-point gotchas:**
- Range -32768 to +32768 — multiplication chains can overflow
- Precision 1/65536 — very small values round to zero
- Accumulating errors in iterative algorithms

**Memory budget:**
- V2+: 64 arrays, 2048 total elements
- V3: 10240 arrays/elements
- Allocations are permanent (no garbage collection)

### references/waveforms.md

Animation timing reference:

**time(interval):**
- Returns sawtooth 0.0 to 1.0
- Period = interval * 65.536 seconds
- Timing table: 0.01 ≈ 0.65s, 0.015 ≈ 1s, 0.03 ≈ 2s, 0.05 ≈ 3.3s, 0.1 ≈ 6.5s

**wave(v):** sine conversion of sawtooth, output 0-1, period 1.0. More efficient than (1+sin(v*PI2))/2

**triangle(v):** linear ramp up then down, output 0-1, period 1.0

**square(v, duty):** pulse wave, output 0 or 1, duty 0-1 controls width

**Combining waveforms:**
- `wave(time(0.1))` — smooth oscillation
- `wave(time(0.1) - radius)` — traveling wave
- `wave(time(0.1)) * wave(time(0.07))` — amplitude modulation
- `triangle(time(0.05))` — linear back-and-forth for position sweeps

**Frame-rate independence:**
- delta parameter in beforeRender = milliseconds since last frame
- Use for physics: `position += velocity * delta / 1000`
- time() is already frame-rate independent

---

## Example Patterns

### Organic (7 patterns)

| File | Technique | Key Functions | 2D+3D |
|---|---|---|---|
| `lava_flow.js` | Dual Perlin noise layers, independent animation axes, hue from one layer, brightness from another | perlin(), time() | Yes |
| `aurora.js` | Horizontal wave bands with noise-modulated color, vertical fade based on y coordinate | wave(), perlin(), smoothstep() | Yes |
| `fire.js` | Heat diffusion array with upward propagation, cooling by height, random sparks at base | array(), random() | 2D only (needs upward direction) |
| `breathing_pulse.js` | Distance-from-center modulated by slow sine, gamma-corrected, subtle hue shift | hypot3(), wave() | Yes |
| `flowing_water.js` | Layered sine waves at different frequencies with noise perturbation on phase | wave(), perlin(), sin() | Yes |
| `nebula.js` | Multi-octave FBM noise with slow coordinate drift, color mapped from noise value | perlinFbm() | Yes |
| `fireflies.js` | N moving point sources with soft distance falloff, random drift via noise | hypot3(), perlin(), beforeRender physics | Yes |

### Geometric (6 patterns)

| File | Technique | Key Functions | 2D+3D |
|---|---|---|---|
| `helix_spiral.js` | atan2 angle + z-offset creates rotating helix bands around vertical axis | atan2(), time(), mod | 3D only |
| `expanding_rings.js` | Distance shells pulsing outward from center, sharp edges via smoothstep | hypot3(), wave(), smoothstep() | Yes |
| `kaleidoscope.js` | Polar coordinate folding (mod on angle) with noise fill | atan2(), mod, perlin() | Yes |
| `spinning_planes.js` | Dot product of position with rotating normal vector, creates sweeping planes | sin(), cos(), dot product | Yes |
| `wave_interference.js` | Multiple wave sources at fixed positions, summed amplitudes, creates moiré | hypot3(), wave(), sum | Yes |
| `voronoi_cells.js` | N seed points bouncing in bounding box, nearest-distance coloring | hypot3(), min(), beforeRender physics | Yes |

### Utility (3 patterns)

| File | Purpose |
|---|---|
| `solid_color.js` | HSV picker, constant color on all LEDs. Tests device connectivity. |
| `coordinate_debug.js` | R=X, G=Y, B=Z. Verifies map orientation and axis alignment. |
| `distance_gradient.js` | White gradient from center outward. Verifies map centering and scale. |

---

## Pattern Validator (validate.py)

Static analysis tool for PB pattern files. Pure Python, no external dependencies.

### Checks

| Severity | Check | Method |
|---|---|---|
| Error | Array allocation in render function | Find render function bodies, search for `array(` or array literals |
| Error | time() in render function | Search for `time(` in render bodies |
| Error | Missing required exports | Check for beforeRender and at least one render variant |
| Error | Nested function definition in render | Function keyword inside render body |
| Warn | Expensive operation in render | Flag perlin/perlinFbm/atan2/log/sqrt/sin/cos in render body |
| Warn | Potential fixed-point overflow | Multiplication chains (a*b*c*d), large numeric literals |
| Warn | Color output potentially out of range | Obvious cases like `hsv(h, 2, v)` |
| Info | No UI controls exported | Pattern works but not user-tunable |
| Info | Single dimension only | Only render3D or only render2D, not both |

### Implementation

Regex-based parsing. PB's ES6 subset is simple enough:
1. Find exported function bodies by matching `export function renderXXX(` and balanced braces
2. Run checks against each function body separately (render vs beforeRender)
3. Report findings grouped by severity

### Usage

```bash
uv run python validate.py patterns/egg/lava_flow.js     # single file
uv run python validate.py patterns/                       # directory (recursive)
uv run python validate.py examples/                       # validate examples too
```

Exit code 0 if no errors (warnings OK), exit code 1 if any errors found.

---

## CLAUDE.md

```
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

A knowledge system for writing PixelBlaze LED patterns. Claude acts as the pattern
author — see AGENTS.md for the full system prompt.

## Commands

Validate a pattern:
    uv run python validate.py <file_or_directory>

## Conventions

- Patterns go in patterns/<project>/<name>.js
- LED coordinate maps go in maps/<project>_map.json
- Example patterns in examples/ are reference implementations — don't modify without reason
- All patterns must pass validate.py with no errors before delivery
```

---

## What's NOT In Scope

- MCP server for device push (future enhancement)
- Pattern simulator/preview (PB's fixed-point math is hard to replicate)
- Template engine (fights the language)
- Web UI (Claude Code is the interface)
