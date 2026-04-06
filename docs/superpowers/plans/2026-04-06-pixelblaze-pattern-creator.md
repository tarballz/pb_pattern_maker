# PixelBlaze Pattern Creator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a knowledge system in `~/code/pb/pattern_maker/` that makes Claude Code an expert PixelBlaze pattern author for 2D and 3D mapped LED installations.

**Architecture:** AGENTS.md system prompt + 4 reference files + 16 curated example patterns + a static validator. No runtime dependencies beyond Python stdlib for the validator. Pattern files are standalone PixelBlaze .js (ES6 subset).

**Tech Stack:** Markdown (knowledge files), JavaScript/ES6 subset (patterns), Python (validator)

**Spec:** `docs/superpowers/specs/2026-04-06-pixelblaze-pattern-creator-design.md`

---

## File Map

```
~/code/pb/pattern_maker/
├── AGENTS.md                          # Task 1
├── CLAUDE.md                          # Task 2
├── validate.py                        # Task 3
├── test_validate.py                   # Task 3
├── references/
│   ├── language.md                    # Task 4
│   ├── safety-rules.md               # Task 5
│   ├── waveforms.md                   # Task 6
│   └── 3d-techniques.md              # Task 7
├── examples/
│   ├── utility/
│   │   ├── solid_color.js             # Task 8
│   │   ├── coordinate_debug.js        # Task 8
│   │   └── distance_gradient.js       # Task 8
│   ├── organic/
│   │   ├── breathing_pulse.js         # Task 9
│   │   ├── lava_flow.js              # Task 10
│   │   ├── aurora.js                  # Task 10
│   │   ├── flowing_water.js           # Task 11
│   │   ├── nebula.js                  # Task 11
│   │   ├── fire.js                    # Task 12
│   │   └── fireflies.js              # Task 12
│   └── geometric/
│       ├── expanding_rings.js         # Task 13
│       ├── helix_spiral.js            # Task 13
│       ├── spinning_planes.js         # Task 14
│       ├── wave_interference.js       # Task 14
│       ├── kaleidoscope.js            # Task 15
│       └── voronoi_cells.js           # Task 15
├── patterns/
│   └── egg/                           # Task 16
└── maps/                              # Task 16
```

---

### Task 1: AGENTS.md

**Files:**
- Create: `~/code/pb/pattern_maker/AGENTS.md`

- [ ] **Step 1: Write AGENTS.md**

```markdown
# PixelBlaze Pattern Author

You are an expert PixelBlaze pattern author for 2D and 3D mapped LED installations. You write production-ready .js pattern files in PixelBlaze's ES6 subset.

## Before Writing Any Pattern

Read these references (they are in this project):
- `references/safety-rules.md` — what will crash the device
- `references/language.md` — built-in functions and signatures
- `references/3d-techniques.md` — spatial pattern techniques
- `references/waveforms.md` — animation timing

Study example patterns in `examples/` for idiomatic PixelBlaze code.

## Mandatory Rules (Priority Order)

1. **Never crash the device**
   - No `array()` or array literals (`[...]`) inside render/render2D/render3D functions
   - No dynamic allocation in any function called per-pixel
   - No infinite loops
   - Pre-allocate all arrays at module scope

2. **ES6 subset only**
   - No `switch` statements
   - No closures (nested functions cannot access parent scope variables)
   - No destructuring or spread operator
   - No string operations — numbers only
   - No objects or classes

3. **Performance: beforeRender is your friend**
   - All frame-level math goes in `beforeRender(delta)` — called once per frame
   - `render3D(index, x, y, z)` is called `pixelCount` times per frame — minimize work
   - Never call `time()` in render functions
   - Cache expensive operations (perlin, atan2, sin, cos, sqrt, log) in beforeRender when possible

4. **Fixed-point awareness**
   - 16.16 format: range -32,768 to +32,768, precision 1/65,536
   - Watch for overflow in multiplication chains (a * b * c * d)
   - Very small values round to zero

5. **Always include UI controls**
   - At minimum: `sliderSpeed(v)` and `sliderBrightness(v)`
   - Use `hsvPickerColor(h, s, v)` when the pattern has a user-selectable color
   - Slider values arrive as 0.0 to 1.0 — scale in the handler

6. **Gamma correction**
   - Apply `v * v` (quadratic) or `v * v * v` (cubic) to the value/brightness channel
   - Linear brightness looks washed out on LEDs — gamma correction makes it perceptually correct

## Pattern Template

Every pattern must follow this structure:

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
  // per-pixel calculations — use x - 0.5, y - 0.5, z - 0.5 for center-based math
  hsv(h, s, v * brightness)
}

// Include render2D when the math naturally supports it
export function render2D(index, x, y) {
  render3D(index, x, y, 0)
}
```

## Output Convention

- Write patterns to `patterns/<project>/<name>.js`
- Include a comment header: name, one-line description, what each slider does
- Use descriptive filenames: `lava_flow.js`, `helix_spiral.js`
- Export both `render2D` and `render3D` where the math naturally supports it
- When asked to write a pattern, ask which project subdirectory if unclear

## Coordinate System

- All coordinates arrive normalized to 0.0–1.0
- For center-based math (most patterns): subtract 0.5 from x, y, z
- `hypot(x, y)` for 2D distance, `hypot3(x, y, z)` for 3D distance
- Patterns automatically work on any mapped LED layout at any scale

## Workflow

1. Read the relevant reference files for the technique you'll use
2. Write the pattern following the template above
3. Verify against safety-rules.md mentally before presenting
4. Tell the user to run `uv run python validate.py <file>` before pasting into the device
```

- [ ] **Step 2: Commit**

```bash
git add AGENTS.md
git commit -m "feat: add AGENTS.md system prompt for PB pattern authoring"
```

---

### Task 2: CLAUDE.md

**Files:**
- Create: `~/code/pb/pattern_maker/CLAUDE.md`

- [ ] **Step 1: Write CLAUDE.md**

```markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

A knowledge system for writing PixelBlaze LED patterns. Claude acts as the pattern
author — see AGENTS.md for the full system prompt and rules.

## Commands

Validate a single pattern:
```bash
uv run python validate.py patterns/egg/lava_flow.js
```

Validate all patterns in a directory:
```bash
uv run python validate.py patterns/
```

Validate examples:
```bash
uv run python validate.py examples/
```

## Conventions

- Patterns go in `patterns/<project>/<name>.js`
- LED coordinate maps go in `maps/<project>_map.json`
- Example patterns in `examples/` are reference implementations — don't modify without reason
- All patterns must pass `validate.py` with no errors before delivery
- Pattern files are standalone PixelBlaze .js (ES6 subset) — no imports, no Node.js
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "feat: add CLAUDE.md with project commands and conventions"
```

---

### Task 3: Pattern Validator

**Files:**
- Create: `~/code/pb/pattern_maker/validate.py`
- Create: `~/code/pb/pattern_maker/test_validate.py`

- [ ] **Step 1: Write test_validate.py**

```python
import pytest
from validate import extract_function_body, validate_pattern, Severity


class TestExtractFunctionBody:
    def test_simple_function(self):
        code = 'export function render3D(index, x, y, z) { hsv(x, 1, 1) }'
        body = extract_function_body(code, "render3D")
        assert body is not None
        assert "hsv" in body

    def test_multiline_function(self):
        code = """export function render3D(index, x, y, z) {
  var d = hypot3(x - 0.5, y - 0.5, z - 0.5)
  hsv(d, 1, 1)
}"""
        body = extract_function_body(code, "render3D")
        assert "hypot3" in body

    def test_nested_braces(self):
        code = """export function render3D(index, x, y, z) {
  if (x > 0.5) {
    hsv(1, 1, 1)
  } else {
    hsv(0, 1, 1)
  }
}"""
        body = extract_function_body(code, "render3D")
        assert "if" in body
        assert "else" in body

    def test_missing_function(self):
        code = 'export function render(index) { hsv(0, 0, 0) }'
        body = extract_function_body(code, "render3D")
        assert body is None

    def test_non_export_ignored(self):
        code = 'function render3D(index, x, y, z) { hsv(0, 0, 0) }'
        body = extract_function_body(code, "render3D")
        assert body is None


class TestValidatePattern:
    def test_valid_pattern(self):
        code = """
export function beforeRender(delta) {
  t1 = time(0.1)
}
export function render3D(index, x, y, z) {
  hsv(x, 1, 1)
}
"""
        findings = validate_pattern(code, "test.js")
        errors = [f for f in findings if f.severity == Severity.ERROR]
        assert len(errors) == 0

    def test_missing_before_render(self):
        code = """
export function render3D(index, x, y, z) {
  hsv(x, 1, 1)
}
"""
        findings = validate_pattern(code, "test.js")
        errors = [f for f in findings if f.severity == Severity.ERROR]
        assert any("beforeRender" in f.message for f in errors)

    def test_missing_render(self):
        code = """
export function beforeRender(delta) {
  t1 = time(0.1)
}
"""
        findings = validate_pattern(code, "test.js")
        errors = [f for f in findings if f.severity == Severity.ERROR]
        assert any("render" in f.message for f in errors)

    def test_array_in_render(self):
        code = """
export function beforeRender(delta) {
  t1 = time(0.1)
}
export function render3D(index, x, y, z) {
  var a = array(10)
  hsv(x, 1, 1)
}
"""
        findings = validate_pattern(code, "test.js")
        errors = [f for f in findings if f.severity == Severity.ERROR]
        assert any("array" in f.message.lower() for f in errors)

    def test_time_in_render(self):
        code = """
export function beforeRender(delta) {
  t1 = time(0.1)
}
export function render3D(index, x, y, z) {
  var t = time(0.1)
  hsv(x, 1, t)
}
"""
        findings = validate_pattern(code, "test.js")
        errors = [f for f in findings if f.severity == Severity.ERROR]
        assert any("time()" in f.message for f in errors)

    def test_nested_function_in_render(self):
        code = """
export function beforeRender(delta) {
  t1 = time(0.1)
}
export function render3D(index, x, y, z) {
  function helper() { return 1 }
  hsv(x, 1, helper())
}
"""
        findings = validate_pattern(code, "test.js")
        errors = [f for f in findings if f.severity == Severity.ERROR]
        assert any("function" in f.message.lower() for f in errors)

    def test_expensive_op_in_render_warns(self):
        code = """
export function beforeRender(delta) {
  t1 = time(0.1)
}
export function render3D(index, x, y, z) {
  var a = atan2(y - 0.5, x - 0.5)
  hsv(a, 1, 1)
}
"""
        findings = validate_pattern(code, "test.js")
        warns = [f for f in findings if f.severity == Severity.WARN]
        assert any("atan2" in f.message for f in warns)

    def test_no_ui_controls_info(self):
        code = """
export function beforeRender(delta) {
  t1 = time(0.1)
}
export function render3D(index, x, y, z) {
  hsv(x, 1, 1)
}
"""
        findings = validate_pattern(code, "test.js")
        infos = [f for f in findings if f.severity == Severity.INFO]
        assert any("UI" in f.message or "slider" in f.message.lower() for f in infos)

    def test_render2d_alone_is_valid(self):
        code = """
export function beforeRender(delta) {
  t1 = time(0.1)
}
export function render2D(index, x, y) {
  hsv(x, 1, 1)
}
"""
        findings = validate_pattern(code, "test.js")
        errors = [f for f in findings if f.severity == Severity.ERROR]
        assert len(errors) == 0

    def test_render_alone_is_valid(self):
        code = """
export function beforeRender(delta) {
  t1 = time(0.1)
}
export function render(index) {
  hsv(index / pixelCount, 1, 1)
}
"""
        findings = validate_pattern(code, "test.js")
        errors = [f for f in findings if f.severity == Severity.ERROR]
        assert len(errors) == 0

    def test_hypot3_in_render_not_warned(self):
        """hypot3 and hypot are expected in render — they're cheap distance functions."""
        code = """
export function beforeRender(delta) {
  t1 = time(0.1)
}
export function render3D(index, x, y, z) {
  var d = hypot3(x - 0.5, y - 0.5, z - 0.5)
  hsv(d, 1, 1)
}
"""
        findings = validate_pattern(code, "test.js")
        warns = [f for f in findings if f.severity == Severity.WARN]
        assert not any("hypot" in f.message for f in warns)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ~/code/pb/pattern_maker && uv run pytest test_validate.py -v
```

Expected: FAIL — `validate` module not found.

- [ ] **Step 3: Write validate.py**

```python
#!/usr/bin/env python3
"""Static analysis for PixelBlaze pattern files."""

import re
import sys
from dataclasses import dataclass
from enum import Enum
from pathlib import Path


class Severity(Enum):
    ERROR = "ERROR"
    WARN = "WARN"
    INFO = "INFO"


@dataclass
class Finding:
    severity: Severity
    message: str
    file: str


def extract_function_body(code: str, func_name: str) -> str | None:
    """Extract the body of an exported function by matching balanced braces."""
    pattern = rf"export\s+function\s+{re.escape(func_name)}\s*\([^)]*\)\s*\{{"
    match = re.search(pattern, code)
    if not match:
        return None

    start = match.end() - 1  # position of opening brace
    depth = 0
    for i in range(start, len(code)):
        if code[i] == "{":
            depth += 1
        elif code[i] == "}":
            depth -= 1
            if depth == 0:
                return code[start + 1 : i]
    return None


RENDER_FUNCS = ["render", "render2D", "render3D"]

# Expensive operations that should ideally be in beforeRender.
# hypot and hypot3 are excluded — they're cheap distance functions expected in render.
EXPENSIVE_OPS = ["perlin", "perlinFbm", "atan2", "log", "log2", "sqrt", "sin", "cos", "tan"]


def validate_pattern(code: str, filename: str) -> list[Finding]:
    findings = []

    # Check required exports
    has_before_render = extract_function_body(code, "beforeRender") is not None
    render_bodies = {}
    for name in RENDER_FUNCS:
        body = extract_function_body(code, name)
        if body is not None:
            render_bodies[name] = body

    if not has_before_render:
        findings.append(Finding(Severity.ERROR, "Missing export function beforeRender(delta)", filename))

    if not render_bodies:
        findings.append(Finding(Severity.ERROR, "Missing export function render/render2D/render3D", filename))

    # Check render function bodies
    for func_name, body in render_bodies.items():
        # Array allocation in render
        if re.search(r"\barray\s*\(", body):
            findings.append(Finding(Severity.ERROR, f"array() allocation in {func_name} — will leak memory", filename))
        if re.search(r"(?<!=)\s*\[(?!\s*\])[^\]]*\]", body):
            # Array literal that isn't empty [] and isn't part of an index access
            # This is a heuristic — may have false positives on index access like arr[i]
            # Only flag if it looks like assignment: var x = [...]
            if re.search(r"(?:var|let|const)\s+\w+\s*=\s*\[", body):
                findings.append(Finding(Severity.ERROR, f"Array literal in {func_name} — will leak memory", filename))

        # time() in render
        if re.search(r"\btime\s*\(", body):
            findings.append(Finding(Severity.ERROR, f"time() called in {func_name} — move to beforeRender", filename))

        # Nested function definition
        if re.search(r"\bfunction\s+\w+\s*\(", body):
            findings.append(Finding(Severity.ERROR, f"Nested function definition in {func_name} — no closures in PB", filename))

        # Expensive operations (warn)
        for op in EXPENSIVE_OPS:
            if re.search(rf"\b{op}\s*\(", body):
                findings.append(Finding(Severity.WARN, f"{op}() in {func_name} — consider caching in beforeRender", filename))

    # Check for UI controls
    has_controls = bool(re.search(r"export\s+function\s+(?:slider|toggle|hsvPicker|rgbPicker|inputNumber|trigger)", code))
    if not has_controls:
        findings.append(Finding(Severity.INFO, "No UI controls (slider/toggle/picker) exported", filename))

    # Check for single dimension
    if render_bodies and not (len(render_bodies) > 1 or "render" in render_bodies):
        if "render3D" in render_bodies and "render2D" not in render_bodies:
            findings.append(Finding(Severity.INFO, "Only render3D exported — no render2D fallback", filename))
        elif "render2D" in render_bodies and "render3D" not in render_bodies:
            findings.append(Finding(Severity.INFO, "Only render2D exported — no render3D", filename))

    return findings


def validate_file(path: Path) -> list[Finding]:
    code = path.read_text()
    return validate_pattern(code, str(path))


def main():
    if len(sys.argv) < 2:
        print("Usage: python validate.py <file_or_directory> [...]")
        sys.exit(1)

    all_findings = []
    for arg in sys.argv[1:]:
        path = Path(arg)
        if path.is_file() and path.suffix == ".js":
            all_findings.extend(validate_file(path))
        elif path.is_dir():
            for js_file in sorted(path.rglob("*.js")):
                all_findings.extend(validate_file(js_file))
        else:
            print(f"Skipping {arg} — not a .js file or directory")

    if not all_findings:
        print("All patterns valid.")
        sys.exit(0)

    has_errors = False
    for finding in all_findings:
        icon = {"ERROR": "x", "WARN": "!", "INFO": "i"}[finding.severity.value]
        print(f"  [{icon}] {finding.file}: {finding.message}")
        if finding.severity == Severity.ERROR:
            has_errors = True

    error_count = sum(1 for f in all_findings if f.severity == Severity.ERROR)
    warn_count = sum(1 for f in all_findings if f.severity == Severity.WARN)
    info_count = sum(1 for f in all_findings if f.severity == Severity.INFO)
    print(f"\n{error_count} errors, {warn_count} warnings, {info_count} info")

    sys.exit(1 if has_errors else 0)


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ~/code/pb/pattern_maker && uv run pytest test_validate.py -v
```

Expected: All 13 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add validate.py test_validate.py
git commit -m "feat: add pattern validator with tests"
```

---

### Task 4: Language Reference

**Files:**
- Create: `~/code/pb/pattern_maker/references/language.md`

- [ ] **Step 1: Write references/language.md**

Complete built-in function reference. Contents:

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
cd ~/code/pb/pattern_maker && git add references/language.md
git commit -m "feat: add complete PB language reference"
```

---

### Task 5: Safety Rules Reference

**Files:**
- Create: `~/code/pb/pattern_maker/references/safety-rules.md`

- [ ] **Step 1: Write references/safety-rules.md**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
cd ~/code/pb/pattern_maker && git add references/safety-rules.md
git commit -m "feat: add PB safety rules reference"
```

---

### Task 6: Waveforms Reference

**Files:**
- Create: `~/code/pb/pattern_maker/references/waveforms.md`

- [ ] **Step 1: Write references/waveforms.md**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
cd ~/code/pb/pattern_maker && git add references/waveforms.md
git commit -m "feat: add waveforms and timing reference"
```

---

### Task 7: 3D Techniques Reference

**Files:**
- Create: `~/code/pb/pattern_maker/references/3d-techniques.md`

- [ ] **Step 1: Write references/3d-techniques.md**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
cd ~/code/pb/pattern_maker && git add references/3d-techniques.md
git commit -m "feat: add 3D pattern techniques reference"
```

---

### Task 8: Utility Example Patterns

**Files:**
- Create: `~/code/pb/pattern_maker/examples/utility/solid_color.js`
- Create: `~/code/pb/pattern_maker/examples/utility/coordinate_debug.js`
- Create: `~/code/pb/pattern_maker/examples/utility/distance_gradient.js`

- [ ] **Step 1: Write solid_color.js**

```javascript
// Solid Color
// Displays a single solid color on all LEDs.
// Use to verify device connectivity and color output.
// Controls: Color (HSV picker), Brightness (slider)

var h = 0, s = 1, v = 1
var brightness = 1

export function hsvPickerColor(_h, _s, _v) { h = _h; s = _s; v = _v }
export function sliderBrightness(_v) { brightness = _v }

export function beforeRender(delta) {}

export function render3D(index, x, y, z) {
  hsv(h, s, v * brightness)
}

export function render2D(index, x, y) {
  render3D(index, x, y, 0)
}

export function render(index) {
  hsv(h, s, v * brightness)
}
```

- [ ] **Step 2: Write coordinate_debug.js**

```javascript
// Coordinate Debug
// R = X axis, G = Y axis, B = Z axis.
// Use to verify map orientation and axis alignment.
// Controls: Brightness (slider)

var brightness = 1

export function sliderBrightness(v) { brightness = v }

export function beforeRender(delta) {}

export function render3D(index, x, y, z) {
  rgb(x * brightness, y * brightness, z * brightness)
}

export function render2D(index, x, y) {
  render3D(index, x, y, 0)
}
```

- [ ] **Step 3: Write distance_gradient.js**

```javascript
// Distance Gradient
// White gradient from center outward. Bright at center, dark at edges.
// Use to verify map centering and scale.
// Controls: Brightness (slider), Falloff (slider)

var brightness = 1
var falloff = 2

export function sliderBrightness(v) { brightness = v }
export function sliderFalloff(v) { falloff = 1 + v * 5 }

export function beforeRender(delta) {}

export function render3D(index, x, y, z) {
  var d = hypot3(x - 0.5, y - 0.5, z - 0.5)
  var v = max(0, 1 - d * falloff)
  v = v * v * brightness
  hsv(0, 0, v)
}

export function render2D(index, x, y) {
  render3D(index, x, y, 0.5)
}
```

- [ ] **Step 4: Validate utility patterns**

```bash
cd ~/code/pb/pattern_maker && uv run python validate.py examples/utility/
```

Expected: No errors. May have info about missing render variants (solid_color has all three, others have 2D+3D).

- [ ] **Step 5: Commit**

```bash
git add examples/utility/
git commit -m "feat: add utility example patterns (solid color, coord debug, distance gradient)"
```

---

### Task 9: Breathing Pulse Pattern

**Files:**
- Create: `~/code/pb/pattern_maker/examples/organic/breathing_pulse.js`

- [ ] **Step 1: Write breathing_pulse.js**

```javascript
// Breathing Pulse
// Gentle pulsing glow that radiates from center, like a heartbeat.
// Distance from center modulated by a slow sine, gamma-corrected.
// Controls: Speed (animation rate), Brightness (overall intensity), Hue (color)

var speed = 0.05
var brightness = 1
var baseHue = 0.6

export function sliderSpeed(v) { speed = 0.01 + v * 0.1 }
export function sliderBrightness(v) { brightness = v }
export function sliderHue(v) { baseHue = v }

var t1, t2

export function beforeRender(delta) {
  t1 = wave(time(speed))
  t2 = wave(time(speed * 0.7))
}

export function render3D(index, x, y, z) {
  var d = hypot3(x - 0.5, y - 0.5, z - 0.5)
  var pulse = t1 * 0.7 + t2 * 0.3
  var v = max(0, pulse - d * 2)
  v = v * v * v * brightness
  hsv(baseHue + d * 0.1, 0.8, v)
}

export function render2D(index, x, y) {
  render3D(index, x, y, 0.5)
}
```

- [ ] **Step 2: Validate**

```bash
cd ~/code/pb/pattern_maker && uv run python validate.py examples/organic/breathing_pulse.js
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add examples/organic/breathing_pulse.js
git commit -m "feat: add breathing pulse pattern"
```

---

### Task 10: Lava Flow and Aurora Patterns

**Files:**
- Create: `~/code/pb/pattern_maker/examples/organic/lava_flow.js`
- Create: `~/code/pb/pattern_maker/examples/organic/aurora.js`

- [ ] **Step 1: Write lava_flow.js**

```javascript
// Lava Flow
// Organic flowing color using dual Perlin noise layers.
// One noise layer controls hue, another controls brightness.
// Animated by drifting coordinates through noise space on independent axes.
// Controls: Speed (animation rate), Brightness (overall intensity), Scale (noise detail)

var speed = 0.05
var brightness = 1
var noiseScale = 3

export function sliderSpeed(v) { speed = 0.02 + v * 0.15 }
export function sliderBrightness(v) { brightness = v }
export function sliderScale(v) { noiseScale = 1 + v * 6 }

var noiseTime

export function beforeRender(delta) {
  noiseTime = time(speed * 100) * 256
}

export function render3D(index, x, y, z) {
  var sx = x * noiseScale
  var sy = y * noiseScale
  var sz = z * noiseScale

  var h = perlin(sx - noiseTime, sy, sz, 0)
  var v = perlin(sx, sy, sz - noiseTime, 1)

  h = h + 0.5
  v = (v + 0.5)
  v = v * v * v * brightness
  hsv(h, 1, v)
}

export function render2D(index, x, y) {
  render3D(index, x, y, 0.5)
}
```

- [ ] **Step 2: Write aurora.js**

```javascript
// Aurora
// Horizontal wave bands with noise-modulated color and vertical fade.
// Creates a northern-lights effect with shimmering curtains.
// Controls: Speed (animation rate), Brightness (overall intensity), Spread (band width)

var speed = 0.04
var brightness = 1
var spread = 3

export function sliderSpeed(v) { speed = 0.01 + v * 0.1 }
export function sliderBrightness(v) { brightness = v }
export function sliderSpread(v) { spread = 1 + v * 6 }

var t1, noiseTime

export function beforeRender(delta) {
  t1 = time(speed)
  noiseTime = time(speed * 50) * 256
}

export function render3D(index, x, y, z) {
  var n = perlin(x * spread + noiseTime, z * spread, 0, 0)
  var curtain = wave(t1 + n + x * 2)

  var verticalFade = smoothstep(0, 0.6, y)
  var shimmer = perlin(x * 8, y * 4, z * 4 - noiseTime * 0.5, 1) + 0.5

  var h = 0.45 + n * 0.15
  var v = curtain * verticalFade * shimmer
  v = v * v * brightness
  hsv(h, 0.7 + shimmer * 0.3, v)
}

export function render2D(index, x, y) {
  render3D(index, x, y, 0.5)
}
```

- [ ] **Step 3: Validate**

```bash
cd ~/code/pb/pattern_maker && uv run python validate.py examples/organic/lava_flow.js examples/organic/aurora.js
```

Expected: Warnings about perlin in render (expected — noise per pixel is the core technique). No errors.

- [ ] **Step 4: Commit**

```bash
git add examples/organic/lava_flow.js examples/organic/aurora.js
git commit -m "feat: add lava flow and aurora patterns"
```

---

### Task 11: Flowing Water and Nebula Patterns

**Files:**
- Create: `~/code/pb/pattern_maker/examples/organic/flowing_water.js`
- Create: `~/code/pb/pattern_maker/examples/organic/nebula.js`

- [ ] **Step 1: Write flowing_water.js**

```javascript
// Flowing Water
// Layered sine waves at different frequencies with noise perturbation.
// Creates a liquid, shimmering water surface effect.
// Controls: Speed (flow rate), Brightness (overall intensity), Turbulence (noise amount)

var speed = 0.04
var brightness = 1
var turbulence = 0.3

export function sliderSpeed(v) { speed = 0.01 + v * 0.1 }
export function sliderBrightness(v) { brightness = v }
export function sliderTurbulence(v) { turbulence = v * 0.8 }

var t1, t2, t3

export function beforeRender(delta) {
  t1 = time(speed)
  t2 = time(speed * 1.3)
  t3 = time(speed * 0.7)
}

export function render3D(index, x, y, z) {
  var n = perlin(x * 4, z * 4, t1 * 256, 0) * turbulence

  var w1 = wave(t1 + x * 3 + n)
  var w2 = wave(t2 + z * 2.5 + n * 0.7)
  var w3 = wave(t3 + (x + z) * 2 + n * 0.5)

  var v = (w1 + w2 * 0.6 + w3 * 0.3) / 1.9
  var h = 0.55 + v * 0.1

  var depthFade = smoothstep(0, 0.7, 1 - y)
  v = v * depthFade
  v = v * v * brightness
  hsv(h, 0.6 + v * 0.4, v)
}

export function render2D(index, x, y) {
  render3D(index, x, y, 0.5)
}
```

- [ ] **Step 2: Write nebula.js**

```javascript
// Nebula
// Multi-octave fractal Brownian motion with slow coordinate drift.
// Creates deep-space nebula clouds with rich color variation.
// Controls: Speed (drift rate), Brightness (overall intensity), Detail (FBM octaves mapped to scale)

var speed = 0.03
var brightness = 1
var detail = 4

export function sliderSpeed(v) { speed = 0.01 + v * 0.08 }
export function sliderBrightness(v) { brightness = v }
export function sliderDetail(v) { detail = 2 + v * 4 }

var noiseTime

export function beforeRender(delta) {
  noiseTime = time(speed * 80) * 256
}

export function render3D(index, x, y, z) {
  var sx = x * detail
  var sy = y * detail
  var sz = z * detail

  var n1 = perlin(sx + noiseTime * 0.3, sy, sz - noiseTime * 0.2, 0)
  var n2 = perlin(sx, sy - noiseTime * 0.25, sz, 1)
  var n3 = perlin(sx - noiseTime * 0.15, sy + noiseTime * 0.1, sz, 2)

  var h = (n1 + 0.5) * 0.8 + 0.1
  var s = 0.7 + (n2 + 0.5) * 0.3
  var v = (n3 + 0.5)
  v = v * v * v * brightness
  hsv(h, s, v)
}

export function render2D(index, x, y) {
  render3D(index, x, y, 0.5)
}
```

- [ ] **Step 3: Validate**

```bash
cd ~/code/pb/pattern_maker && uv run python validate.py examples/organic/flowing_water.js examples/organic/nebula.js
```

Expected: Warnings about perlin/wave in render (expected). No errors.

- [ ] **Step 4: Commit**

```bash
git add examples/organic/flowing_water.js examples/organic/nebula.js
git commit -m "feat: add flowing water and nebula patterns"
```

---

### Task 12: Fire and Fireflies Patterns

**Files:**
- Create: `~/code/pb/pattern_maker/examples/organic/fire.js`
- Create: `~/code/pb/pattern_maker/examples/organic/fireflies.js`

- [ ] **Step 1: Write fire.js**

This pattern uses a heat array with upward propagation. It's inherently 2D (needs a "down" direction) — render2D only.

```javascript
// Fire
// Classic fire effect using heat diffusion with upward propagation.
// Heat rises from the bottom, cools as it goes up, random sparks.
// 2D only — requires vertical axis for heat propagation.
// Controls: Speed (animation rate), Brightness (intensity), Cooling (how fast heat dissipates)

var speed = 0.05
var brightness = 1
var cooling = 0.6

export function sliderSpeed(v) { speed = 0.02 + v * 0.15 }
export function sliderBrightness(v) { brightness = v }
export function sliderCooling(v) { cooling = 0.2 + v * 1.0 }

var cols = 16
var rows = 16
var heat = array(cols * rows)

function idx(col, row) {
  return clamp(col, 0, cols - 1) + clamp(row, 0, rows - 1) * cols
}

export function beforeRender(delta) {
  var dt = delta / 16

  for (var col = 0; col < cols; col++) {
    heat[idx(col, 0)] = 1

    for (var row = rows - 1; row > 0; row--) {
      var below = (heat[idx(col - 1, row - 1)] + heat[idx(col, row - 1)] + heat[idx(col + 1, row - 1)]) / 3
      heat[idx(col, row)] = max(0, below - cooling / rows * dt - random(0.01))
    }
  }
}

export function render2D(index, x, y) {
  var col = floor(x * cols)
  var row = floor((1 - y) * rows)
  var h = heat[idx(col, row)]
  var hue = h * 0.12
  var sat = 1 - h * 0.4
  hsv(hue, sat, h * h * brightness)
}
```

- [ ] **Step 2: Write fireflies.js**

```javascript
// Fireflies
// N glowing point sources that drift slowly through 3D space via Perlin noise.
// Each firefly has a soft distance falloff and independent pulse.
// Controls: Speed (drift rate), Brightness (glow intensity), Count (number of fireflies)

var speed = 0.04
var brightness = 1
var count = 5

export function sliderSpeed(v) { speed = 0.01 + v * 0.1 }
export function sliderBrightness(v) { brightness = v }
export function sliderCount(v) { count = max(1, floor(1 + v * 7)) }

var maxFlies = 8
var fx = array(maxFlies)
var fy = array(maxFlies)
var fz = array(maxFlies)
var fhue = array(maxFlies)
var fpulse = array(maxFlies)

var t1

export function beforeRender(delta) {
  t1 = time(speed * 60) * 256
  for (var i = 0; i < maxFlies; i++) {
    fx[i] = (perlin(t1 * 0.3, i * 73.1, 0, 0) + 0.5)
    fy[i] = (perlin(0, t1 * 0.25, i * 47.3, 1) + 0.5)
    fz[i] = (perlin(i * 31.7, 0, t1 * 0.2, 2) + 0.5)
    fhue[i] = (perlin(i * 17.3, t1 * 0.1, 0, 3) + 0.5) * 0.3 + 0.15
    fpulse[i] = wave(time(speed * (1 + i * 0.3)))
  }
}

export function render3D(index, x, y, z) {
  var totalV = 0
  var closestH = 0
  var closestD = 10

  for (var i = 0; i < count; i++) {
    var d = hypot3(x - fx[i], y - fy[i], z - fz[i])
    var glow = fpulse[i] * 0.015 / (d * d + 0.015)
    totalV += glow
    if (d < closestD) {
      closestD = d
      closestH = fhue[i]
    }
  }

  totalV = min(1, totalV)
  totalV = totalV * totalV * brightness
  hsv(closestH, 0.8, totalV)
}

export function render2D(index, x, y) {
  render3D(index, x, y, 0.5)
}
```

- [ ] **Step 3: Validate**

```bash
cd ~/code/pb/pattern_maker && uv run python validate.py examples/organic/fire.js examples/organic/fireflies.js
```

Expected: fire.js — info about render2D only. fireflies.js — warnings about hypot3 in loop (expected for this pattern type). No errors.

- [ ] **Step 4: Commit**

```bash
git add examples/organic/fire.js examples/organic/fireflies.js
git commit -m "feat: add fire and fireflies patterns"
```

---

### Task 13: Expanding Rings and Helix Spiral Patterns

**Files:**
- Create: `~/code/pb/pattern_maker/examples/geometric/expanding_rings.js`
- Create: `~/code/pb/pattern_maker/examples/geometric/helix_spiral.js`

- [ ] **Step 1: Write expanding_rings.js**

```javascript
// Expanding Rings
// Concentric shells of light pulsing outward from center.
// Sharp ring edges using smoothstep, multiple simultaneous rings.
// Controls: Speed (expansion rate), Brightness (intensity), Ring Count (simultaneous rings)

var speed = 0.04
var brightness = 1
var ringCount = 3

export function sliderSpeed(v) { speed = 0.01 + v * 0.1 }
export function sliderBrightness(v) { brightness = v }
export function sliderRingCount(v) { ringCount = max(1, floor(1 + v * 6)) }

var t1

export function beforeRender(delta) {
  t1 = time(speed)
}

export function render3D(index, x, y, z) {
  var d = hypot3(x - 0.5, y - 0.5, z - 0.5)
  var ring = wave((d * ringCount - t1) % 1)
  ring = smoothstep(0.3, 0.5, ring)
  var h = d * 2 + t1
  var v = ring * brightness
  v = v * v
  hsv(h, 0.8, v)
}

export function render2D(index, x, y) {
  render3D(index, x, y, 0.5)
}
```

- [ ] **Step 2: Write helix_spiral.js**

```javascript
// Helix Spiral
// Rotating helix bands wrapping around the vertical axis.
// Uses atan2 angle + z-offset to create spiral geometry.
// 3D only — requires vertical axis and radial symmetry.
// Controls: Speed (rotation rate), Brightness (intensity), Twist (helix tightness)

var speed = 0.05
var brightness = 1
var twist = 3

export function sliderSpeed(v) { speed = 0.01 + v * 0.1 }
export function sliderBrightness(v) { brightness = v }
export function sliderTwist(v) { twist = 1 + v * 8 }

var t1

export function beforeRender(delta) {
  t1 = time(speed)
}

export function render3D(index, x, y, z) {
  var angle = atan2(z - 0.5, x - 0.5) / PI2 + 0.5
  var spiral = (angle + y * twist + t1) % 1
  var band = wave(spiral)
  band = smoothstep(0.3, 0.6, band)
  var radius = hypot(x - 0.5, z - 0.5)
  var h = y + t1 * 0.5
  var v = band * brightness * smoothstep(0.05, 0.2, radius)
  v = v * v
  hsv(h, 0.9, v)
}
```

- [ ] **Step 3: Validate**

```bash
cd ~/code/pb/pattern_maker && uv run python validate.py examples/geometric/expanding_rings.js examples/geometric/helix_spiral.js
```

Expected: helix — warning about atan2 in render (accepted, required for the effect). Info about 3D only. No errors.

- [ ] **Step 4: Commit**

```bash
git add examples/geometric/expanding_rings.js examples/geometric/helix_spiral.js
git commit -m "feat: add expanding rings and helix spiral patterns"
```

---

### Task 14: Spinning Planes and Wave Interference Patterns

**Files:**
- Create: `~/code/pb/pattern_maker/examples/geometric/spinning_planes.js`
- Create: `~/code/pb/pattern_maker/examples/geometric/wave_interference.js`

- [ ] **Step 1: Write spinning_planes.js**

```javascript
// Spinning Planes
// A glowing plane that rotates through 3D space.
// Dot product of position with a rotating normal vector creates the sweep.
// Controls: Speed (rotation rate), Brightness (intensity), Thickness (plane width)

var speed = 0.04
var brightness = 1
var thickness = 8

export function sliderSpeed(v) { speed = 0.01 + v * 0.1 }
export function sliderBrightness(v) { brightness = v }
export function sliderThickness(v) { thickness = 2 + v * 15 }

var nx, ny, nz

export function beforeRender(delta) {
  var a = time(speed) * PI2
  var b = time(speed * 0.7) * PI2
  nx = sin(a) * cos(b)
  ny = sin(b)
  nz = cos(a) * cos(b)
}

export function render3D(index, x, y, z) {
  var dot = (x - 0.5) * nx + (y - 0.5) * ny + (z - 0.5) * nz
  var v = max(0, 1 - abs(dot) * thickness)
  v = v * v * brightness
  var h = dot + 0.5
  hsv(h, 0.7, v)
}

export function render2D(index, x, y) {
  render3D(index, x, y, 0.5)
}
```

- [ ] **Step 2: Write wave_interference.js**

```javascript
// Wave Interference
// Multiple wave sources at fixed positions, amplitudes summed.
// Creates interference patterns (constructive/destructive) like ripples in a pond.
// Controls: Speed (wave rate), Brightness (intensity), Sources (number of wave origins)

var speed = 0.04
var brightness = 1
var sourceCount = 3

export function sliderSpeed(v) { speed = 0.01 + v * 0.1 }
export function sliderBrightness(v) { brightness = v }
export function sliderSources(v) { sourceCount = max(2, floor(2 + v * 4)) }

var maxSources = 6
var sx = array(maxSources)
var sy = array(maxSources)
var sz = array(maxSources)

sx[0] = 0.2; sy[0] = 0.5; sz[0] = 0.5
sx[1] = 0.8; sy[1] = 0.5; sz[1] = 0.5
sx[2] = 0.5; sy[2] = 0.2; sz[2] = 0.5
sx[3] = 0.5; sy[3] = 0.8; sz[3] = 0.5
sx[4] = 0.5; sy[4] = 0.5; sz[4] = 0.2
sx[5] = 0.5; sy[5] = 0.5; sz[5] = 0.8

var t1

export function beforeRender(delta) {
  t1 = time(speed)
}

export function render3D(index, x, y, z) {
  var sum = 0
  for (var i = 0; i < sourceCount; i++) {
    var d = hypot3(x - sx[i], y - sy[i], z - sz[i])
    sum += wave(d * 8 - t1)
  }
  sum = sum / sourceCount
  var h = sum * 0.5 + t1
  var v = sum * sum * brightness
  hsv(h, 0.8, v)
}

export function render2D(index, x, y) {
  render3D(index, x, y, 0.5)
}
```

- [ ] **Step 3: Validate**

```bash
cd ~/code/pb/pattern_maker && uv run python validate.py examples/geometric/spinning_planes.js examples/geometric/wave_interference.js
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add examples/geometric/spinning_planes.js examples/geometric/wave_interference.js
git commit -m "feat: add spinning planes and wave interference patterns"
```

---

### Task 15: Kaleidoscope and Voronoi Patterns

**Files:**
- Create: `~/code/pb/pattern_maker/examples/geometric/kaleidoscope.js`
- Create: `~/code/pb/pattern_maker/examples/geometric/voronoi_cells.js`

- [ ] **Step 1: Write kaleidoscope.js**

```javascript
// Kaleidoscope
// Polar coordinate folding with noise fill.
// Divides the angular space into segments and mirrors them.
// Controls: Speed (rotation rate), Brightness (intensity), Segments (mirror count)

var speed = 0.04
var brightness = 1
var segments = 6

export function sliderSpeed(v) { speed = 0.01 + v * 0.1 }
export function sliderBrightness(v) { brightness = v }
export function sliderSegments(v) { segments = max(2, floor(2 + v * 10)) }

var noiseTime

export function beforeRender(delta) {
  noiseTime = time(speed * 80) * 256
}

export function render3D(index, x, y, z) {
  var cx = x - 0.5
  var cz = z - 0.5
  var angle = atan2(cz, cx) / PI2 + 0.5
  var radius = hypot(cx, cz)

  var segAngle = angle * segments
  segAngle = triangle(segAngle % 1)

  var nx = segAngle * 4
  var ny = radius * 4 + y * 2
  var n = perlin(nx + noiseTime, ny, 0, 0) + 0.5

  var h = n + radius
  var v = n * smoothstep(0.02, 0.15, radius)
  v = v * v * brightness
  hsv(h, 0.85, v)
}

export function render2D(index, x, y) {
  var cx = x - 0.5
  var cy = y - 0.5
  var angle = atan2(cy, cx) / PI2 + 0.5
  var radius = hypot(cx, cy)

  var segAngle = angle * segments
  segAngle = triangle(segAngle % 1)

  var nx = segAngle * 4
  var ny = radius * 4
  var n = perlin(nx + noiseTime, ny, 0, 0) + 0.5

  var h = n + radius
  var v = n * smoothstep(0.02, 0.15, radius)
  v = v * v * brightness
  hsv(h, 0.85, v)
}
```

- [ ] **Step 2: Write voronoi_cells.js**

```javascript
// Voronoi Cells
// N seed points bouncing in the bounding box, nearest-distance coloring.
// Each pixel is colored by its nearest seed point.
// Controls: Speed (bounce rate), Brightness (intensity), Cells (number of seeds)

var speed = 0.04
var brightness = 1
var cellCount = 4

export function sliderSpeed(v) { speed = 0.01 + v * 0.1 }
export function sliderBrightness(v) { brightness = v }
export function sliderCells(v) { cellCount = max(2, floor(2 + v * 4)) }

var maxCells = 6
var cx = array(maxCells)
var cy = array(maxCells)
var cz = array(maxCells)
var vx = array(maxCells)
var vy = array(maxCells)
var vz = array(maxCells)
var ch = array(maxCells)

// Initialize velocities and hues with fixed values
vx[0] = 0.3;  vy[0] = 0.2;  vz[0] = 0.15; ch[0] = 0.0
vx[1] = -0.2; vy[1] = 0.3;  vz[1] = -0.2; ch[1] = 0.17
vx[2] = 0.15; vy[2] = -0.25; vz[2] = 0.3; ch[2] = 0.33
vx[3] = -0.3; vy[3] = -0.15; vz[3] = 0.2; ch[3] = 0.5
vx[4] = 0.25; vy[4] = 0.1;  vz[4] = -0.3; ch[4] = 0.67
vx[5] = -0.1; vy[5] = -0.3; vz[5] = -0.15; ch[5] = 0.83

// Initialize positions to center
cx[0] = 0.3; cy[0] = 0.4; cz[0] = 0.5
cx[1] = 0.7; cy[1] = 0.6; cz[1] = 0.5
cx[2] = 0.5; cy[2] = 0.3; cz[2] = 0.3
cx[3] = 0.4; cy[3] = 0.7; cz[3] = 0.7
cx[4] = 0.6; cy[4] = 0.5; cz[4] = 0.4
cx[5] = 0.5; cy[5] = 0.5; cz[5] = 0.6

export function beforeRender(delta) {
  var dt = delta * speed * 0.05
  for (var i = 0; i < maxCells; i++) {
    cx[i] += vx[i] * dt
    cy[i] += vy[i] * dt
    cz[i] += vz[i] * dt
    if (cx[i] < 0 || cx[i] > 1) vx[i] = -vx[i]
    if (cy[i] < 0 || cy[i] > 1) vy[i] = -vy[i]
    if (cz[i] < 0 || cz[i] > 1) vz[i] = -vz[i]
    cx[i] = clamp(cx[i], 0, 1)
    cy[i] = clamp(cy[i], 0, 1)
    cz[i] = clamp(cz[i], 0, 1)
  }
}

export function render3D(index, x, y, z) {
  var minD = 10
  var minI = 0
  var secondD = 10
  for (var i = 0; i < cellCount; i++) {
    var d = hypot3(x - cx[i], y - cy[i], z - cz[i])
    if (d < minD) {
      secondD = minD
      minD = d
      minI = i
    } else if (d < secondD) {
      secondD = d
    }
  }
  var edge = smoothstep(0, 0.04, secondD - minD)
  var v = edge * brightness
  v = v * v
  hsv(ch[minI], 0.8, v)
}

export function render2D(index, x, y) {
  render3D(index, x, y, 0.5)
}
```

- [ ] **Step 3: Validate**

```bash
cd ~/code/pb/pattern_maker && uv run python validate.py examples/geometric/kaleidoscope.js examples/geometric/voronoi_cells.js
```

Expected: Warnings about atan2/perlin/hypot3 in render (expected). No errors.

- [ ] **Step 4: Commit**

```bash
git add examples/geometric/kaleidoscope.js examples/geometric/voronoi_cells.js
git commit -m "feat: add kaleidoscope and voronoi cell patterns"
```

---

### Task 16: Project Directory Structure and Maps

**Files:**
- Create: `~/code/pb/pattern_maker/patterns/egg/.gitkeep`
- Create: `~/code/pb/pattern_maker/maps/.gitkeep`

- [ ] **Step 1: Create directories**

```bash
mkdir -p ~/code/pb/pattern_maker/patterns/egg
mkdir -p ~/code/pb/pattern_maker/maps
touch ~/code/pb/pattern_maker/patterns/egg/.gitkeep
touch ~/code/pb/pattern_maker/maps/.gitkeep
```

- [ ] **Step 2: Run full validation on all examples**

```bash
cd ~/code/pb/pattern_maker && uv run python validate.py examples/
```

Expected: No errors across all 16 patterns. Warnings and info expected.

- [ ] **Step 3: Run validator tests**

```bash
cd ~/code/pb/pattern_maker && uv run pytest test_validate.py -v
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add patterns/ maps/
git commit -m "feat: add project directory structure (patterns/egg, maps)"
```

- [ ] **Step 5: Final commit — initial project setup complete**

```bash
git add -A
git commit -m "chore: pixelblaze pattern creator initial setup complete"
```
