# Hardware Performance Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `pb.py perf <pattern> --map <csv>` reports a pattern's estimated hardware FPS using the emulator's existing calibrated model, without a browser.

**Architecture:** Extract the emulator's hardware-FPS constants + formula into a pure `src/vm/hwmodel.js` (shared by the browser HUD and the CLI, so they can't diverge); add a node harness in pattern_maker that imports that module plus the emulator's already-pure `countExpensiveRenderOps` and map parser via `$PB_EMU_ROOT`; wrap it in a `pb.py perf` subcommand that is advisory unless `--min-fps` is passed.

**Tech Stack:** JS (ES modules, vitest) in the emulator repo; Python 3.11 + argparse + subprocess in pattern_maker; node as an external process.

**Spec:** `docs/superpowers/specs/2026-07-22-hardware-perf-gate-design.md`

## Global Constraints

- Two repos: emulator = `/Users/paytonschwarz/code/pb/pixelblaze-pattern-emulator`, pattern_maker = `/Users/paytonschwarz/code/pb/pb_pattern_maker`. Both commit direct-to-main. **No AI trailers in commit messages** (no `Co-Authored-By`, no `Generated with`).
- The emulator edit is an **extraction with zero behavior change**. The browser HUD must display identical numbers after Task 1; the full emulator suite staying green is the proof.
- Calibration constants are **copied verbatim**, including their source-citation comments. Do not retune them.
- `$PB_EMU_ROOT` defaults to `~/code/pb/pixelblaze-pattern-emulator`; every failure to locate node or that checkout must produce a named, actionable error — never a traceback.
- pattern_maker python runs under `uv` (`uv run python ...`), never bare `python`/`pip`.

## File Structure

| File | Repo | Responsibility |
|---|---|---|
| `src/vm/hwmodel.js` (create) | emulator | Pure: `HW_EST` constants + `estimateHardwareFps({pixelCount, outputMethod, expensiveOpCount})` |
| `test/hwmodel.test.js` (create) | emulator | Unit tests for the pure model |
| `src/app/main.js` (modify) | emulator | Imports the model; local wrapper reads `state` and delegates |
| `pattern_maker/tools/perf_estimate.mjs` (create) | pattern_maker | Node harness: map parse → dispatch pick → op count → FPS → JSON on stdout |
| `pattern_maker/pb.py` (modify) | pattern_maker | New `perf` subcommand wrapping the harness |
| `pattern_maker/test_perf.py` (create) | pattern_maker | pytest for arg handling, error paths, and one real integration run |

---

### Task 1: Extract the hardware model in the emulator

**Files:**
- Create: `/Users/paytonschwarz/code/pb/pixelblaze-pattern-emulator/src/vm/hwmodel.js`
- Create: `/Users/paytonschwarz/code/pb/pixelblaze-pattern-emulator/test/hwmodel.test.js`
- Modify: `/Users/paytonschwarz/code/pb/pixelblaze-pattern-emulator/src/app/main.js` (the `// ---------- FPS / hardware-estimate HUD ----------` block, ~line 1018–1060)

**Interfaces:**
- Produces: `HW_EST` (object with `COMPUTE_PX_PER_SEC`, `EXPENSIVE_OP_PENALTY`, `OUTPUT.{ws2812,expander,apa102}.{rate,resetSec,label}`, `MAX_DISPLAY_FPS`) and `estimateHardwareFps({ pixelCount, outputMethod, expensiveOpCount }) -> number | null`. Task 2 imports both.

- [ ] **Step 1: Write the failing test** — create `test/hwmodel.test.js`:

```js
// Pure hardware-FPS model. Expected values are hand-computed from the
// documented constants (48k px/s compute, WS2812 33k px/s + 300us latch).
import { describe, it, expect } from 'vitest'
import { HW_EST, estimateHardwareFps } from '../src/vm/hwmodel.js'

describe('estimateHardwareFps', () => {
  it('is output-bound on a big WS2812 rig with a cheap pattern', () => {
    // tCompute = 1449/48000 = 0.030188 ; tOutput = 1449/33000 + 0.0003 = 0.044209
    const fps = estimateHardwareFps({ pixelCount: 1449, outputMethod: 'ws2812', expensiveOpCount: 0 })
    expect(fps).toBeCloseTo(22.62, 1)
  })

  it('becomes compute-bound once the pattern is expensive', () => {
    // computeRate = 48000/(1+0.15*10) = 19200 ; tCompute = 1449/19200 = 0.075469
    const fps = estimateHardwareFps({ pixelCount: 1449, outputMethod: 'ws2812', expensiveOpCount: 10 })
    expect(fps).toBeCloseTo(13.25, 1)
  })

  it('clamps to MAX_DISPLAY_FPS on tiny rigs', () => {
    const fps = estimateHardwareFps({ pixelCount: 100, outputMethod: 'ws2812', expensiveOpCount: 0 })
    expect(fps).toBe(HW_EST.MAX_DISPLAY_FPS)
  })

  it('treats apa102 as unbounded output (always compute-bound)', () => {
    const apa = estimateHardwareFps({ pixelCount: 1449, outputMethod: 'apa102', expensiveOpCount: 10 })
    const ws  = estimateHardwareFps({ pixelCount: 1449, outputMethod: 'ws2812', expensiveOpCount: 10 })
    expect(apa).toBeCloseTo(13.25, 1)   // compute term only
    expect(apa).toBeGreaterThanOrEqual(ws)
  })

  it('expander lifts the output ceiling above ws2812', () => {
    const exp = estimateHardwareFps({ pixelCount: 1449, outputMethod: 'expander', expensiveOpCount: 0 })
    const ws  = estimateHardwareFps({ pixelCount: 1449, outputMethod: 'ws2812', expensiveOpCount: 0 })
    expect(exp).toBeGreaterThan(ws)
  })

  it('falls back to ws2812 for an unknown output method', () => {
    const unknown = estimateHardwareFps({ pixelCount: 1449, outputMethod: 'nonsense', expensiveOpCount: 0 })
    const ws = estimateHardwareFps({ pixelCount: 1449, outputMethod: 'ws2812', expensiveOpCount: 0 })
    expect(unknown).toBe(ws)
  })

  it('returns null without a pixel count', () => {
    expect(estimateHardwareFps({ pixelCount: 0, outputMethod: 'ws2812', expensiveOpCount: 0 })).toBeNull()
    expect(estimateHardwareFps({ pixelCount: undefined, outputMethod: 'ws2812', expensiveOpCount: 0 })).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd /Users/paytonschwarz/code/pb/pixelblaze-pattern-emulator && npx vitest run test/hwmodel.test.js`
Expected: FAIL — cannot resolve `../src/vm/hwmodel.js`.

- [ ] **Step 3: Create `src/vm/hwmodel.js`** (constants copied verbatim from `main.js`, comments preserved):

```js
// Estimated-hardware-FPS model, shared by the browser HUD and the headless
// perf CLI (pattern_maker's tools/perf_estimate.mjs) so the two can never
// disagree. Pure — no DOM, no app state.
//
// Constants are official ElectroMage / forum numbers, not measurements of this
// machine. Sources:
//   - compute ~48k px/s avg V3 pattern eval (product page; confirmed in
//     https://forum.electromage.com/t/what-is-the-fastest-output-fps-possible-for-3600-pixels-on-pb-non-micro/4574)
//   - WS2812 direct: 800 kbps / 24 bits ≈ 33k px/s + ~300 µs reset latch (same thread)
//   - Output Expander: 66k px/s total per 2 Mbps serial bus, channels clock out
//     in parallel (https://www.bhencke.com/serial-ws2812-driver) — the per-bus
//     ceiling doesn't rise with more channels, but it sits above the compute
//     ceiling, so expander rigs are compute-bound rather than output-bound.
//   - APA102 direct: SPI to 20 MHz — effectively compute-bound at any count.
// EXPENSIVE_OP_PENALTY is a rough calibration factor (est., not measured):
// each expensive per-pixel call site (perlin/atan2/sin/...) shaves the compute
// budget. FPS = 1 / max(computeTime, outputTime) — the optimistic-overlap
// model, which matches wizard's published 3600-px measurements within
// pattern-cost variance.
export const HW_EST = {
  COMPUTE_PX_PER_SEC: 48000,
  EXPENSIVE_OP_PENALTY: 0.15,
  OUTPUT: {
    ws2812:   { rate: 33000,    resetSec: 0.0003, label: 'WS2812' },
    expander: { rate: 66000,    resetSec: 0,      label: 'Expander' },
    apa102:   { rate: Infinity, resetSec: 0,      label: 'APA102' }
  },
  MAX_DISPLAY_FPS: 120
}

// Returns estimated frames/sec on a Pixelblaze V3, or null without a pixel
// count. `bound` is derivable by the caller: compute-bound when
// computeTime >= outputTime.
export function estimateHardwareFps({ pixelCount, outputMethod, expensiveOpCount = 0 }) {
  if (!pixelCount) return null
  const out = HW_EST.OUTPUT[outputMethod] || HW_EST.OUTPUT.ws2812
  const computeRate = HW_EST.COMPUTE_PX_PER_SEC / (1 + HW_EST.EXPENSIVE_OP_PENALTY * expensiveOpCount)
  const tCompute = pixelCount / computeRate
  const tOutput = out.rate === Infinity ? 0 : pixelCount / out.rate + out.resetSec
  return Math.min(1 / Math.max(tCompute, tOutput), HW_EST.MAX_DISPLAY_FPS)
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run test/hwmodel.test.js`
Expected: 7 passed.

- [ ] **Step 5: Rewire `main.js` to use the shared module.** Add to the import block at the top of `src/app/main.js`:

```js
import { HW_EST, estimateHardwareFps as estimateHwFpsPure } from '../vm/hwmodel.js'
```

Then in the `// ---------- FPS / hardware-estimate HUD ----------` section, DELETE the local `const HW_EST = {...}` block and its preceding source-citation comment (they now live in hwmodel.js), and replace the local `estimateHardwareFps()` body with the delegating wrapper. Keep `const fpsEl`, `let expensiveOpCount`, `let emuFpsEma`, `let patternMsEma`, `let lastFpsHudUpdate`, `let hwAccumMs` exactly where they are:

```js
function estimateHardwareFps() {
  return estimateHwFpsPure({
    pixelCount: state.preparedMap?.pixelCount,
    outputMethod: state.options.outputMethod,
    expensiveOpCount
  })
}
```

`updateFpsHud` still references `HW_EST.OUTPUT[...]` for the label — that now resolves to the imported constant, unchanged.

- [ ] **Step 6: Verify no behavior change**

Run: `npx vitest run` — Expected: all suites green (186+ tests).
Run: `node --check src/app/main.js` — Expected: clean.
Run: `grep -n "COMPUTE_PX_PER_SEC" src/app/main.js` — Expected: no output (constants fully moved).

- [ ] **Step 7: Commit**

```bash
cd /Users/paytonschwarz/code/pb/pixelblaze-pattern-emulator
git add src/vm/hwmodel.js test/hwmodel.test.js src/app/main.js
git commit -m "Extract hardware-FPS model into a pure shared module"
```

---

### Task 2: Node harness in pattern_maker

**Files:**
- Create: `/Users/paytonschwarz/code/pb/pb_pattern_maker/pattern_maker/tools/perf_estimate.mjs`

**Interfaces:**
- Consumes: Task 1's `HW_EST` + `estimateHardwareFps`; the emulator's existing `countExpensiveRenderOps(source, renderName)` from `src/vm/lint.js`, `parseMapContent`/`prepareMap`/`selectRenderFnInfo` from `src/map/index.js`, and `createVM` from `src/vm/index.js`.
- Produces: a CLI emitting one JSON object on stdout:
  `{ pixelCount, dim, renderPicked, expensiveOpCount, estFps, bound, outputMethod }`.
  Task 3 parses exactly these keys. `bound` is `"compute"` or `"output"`.

**Why a VM is built:** `selectRenderFnInfo(dim, exports)` needs the pattern's classified exports to decide which render function the firmware would dispatch to — and that pick determines which function's expensive ops get counted (so a pattern exporting both `render2D` and `render3D` isn't double-billed). `createVM` is the proven headless way to get `classified`; the emulator's own `test/integration.test.js` does exactly this under node. No frames are rendered.

- [ ] **Step 1: Write the harness**

```js
#!/usr/bin/env node
// Headless estimated-hardware-FPS check for a PixelBlaze pattern.
//
// Imports the emulator's own analysis + hardware model (via $PB_EMU_ROOT) so
// this can never disagree with the FPS shown in the emulator's HUD. Emits one
// JSON object on stdout; all diagnostics go to stderr.
//
// Usage:
//   node perf_estimate.mjs --pattern <file.js> [--map <file.csv>]
//                          [--pixel-count N] [--output-method ws2812|expander|apa102]

import { readFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

function fail(msg) {
  process.stderr.write(msg + '\n')
  process.exit(2)
}

function parseArgs(argv) {
  const args = { outputMethod: 'ws2812' }
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i], v = argv[i + 1]
    if (k === '--pattern') args.pattern = v
    else if (k === '--map') args.map = v
    else if (k === '--pixel-count') args.pixelCount = parseInt(v, 10)
    else if (k === '--output-method') args.outputMethod = v
    else fail(`unknown argument: ${k}`)
  }
  return args
}

const args = parseArgs(process.argv.slice(2))
if (!args.pattern) fail('missing --pattern')
if (!args.map && !args.pixelCount) fail('need --map or --pixel-count')

const EMU = process.env.PB_EMU_ROOT || join(homedir(), 'code/pb/pixelblaze-pattern-emulator')
if (!existsSync(join(EMU, 'src/vm/hwmodel.js'))) {
  fail(`emulator not found at ${EMU} (set PB_EMU_ROOT). ` +
       `If it is present, it may predate the shared hardware model — pull it.`)
}

const imp = (rel) => import(pathToFileURL(join(EMU, rel)).href)
const { estimateHardwareFps, HW_EST } = await imp('src/vm/hwmodel.js')
const { countExpensiveRenderOps } = await imp('src/vm/lint.js')
const { parseMapContent, prepareMap, selectRenderFnInfo } = await imp('src/map/index.js')
const { createVM } = await imp('src/vm/index.js')

const source = readFileSync(args.pattern, 'utf8')

let pixelCount = args.pixelCount
let dim = 3
if (args.map) {
  const parsed = parseMapContent(readFileSync(args.map, 'utf8'))
  const map = prepareMap(parsed, { normalizeMode: 'fill' })
  pixelCount = map.pixelCount
  dim = map.dim
}

// Build the VM only to learn which render function the firmware would pick.
let renderPicked
try {
  const vm = createVM({ source, pixelCount, mapDim: dim })
  renderPicked = selectRenderFnInfo(dim, vm.classified).picked
} catch (err) {
  fail(`could not load pattern: ${err.message || err}`)
}

const expensiveOpCount = countExpensiveRenderOps(source, renderPicked.split(' ')[0])
const estFps = estimateHardwareFps({ pixelCount, outputMethod: args.outputMethod, expensiveOpCount })

const out = HW_EST.OUTPUT[args.outputMethod] || HW_EST.OUTPUT.ws2812
const computeRate = HW_EST.COMPUTE_PX_PER_SEC / (1 + HW_EST.EXPENSIVE_OP_PENALTY * expensiveOpCount)
const tCompute = pixelCount / computeRate
const tOutput = out.rate === Infinity ? 0 : pixelCount / out.rate + out.resetSec

process.stdout.write(JSON.stringify({
  pixelCount, dim, renderPicked, expensiveOpCount,
  estFps, bound: tCompute >= tOutput ? 'compute' : 'output',
  outputMethod: args.outputMethod
}) + '\n')
```

- [ ] **Step 2: Run it against a real pattern and the egg map**

```bash
cd /Users/paytonschwarz/code/pb/pb_pattern_maker/pattern_maker
node tools/perf_estimate.mjs --pattern patterns/egg/fibonacci_dream.js --map maps/egg_mapping/led_map_3d.csv
```
Expected: one JSON line with `pixelCount` ≈ 1449, `renderPicked` `"render3D"`, a non-zero `expensiveOpCount`, and a plausible `estFps`.

- [ ] **Step 3: Confirm the heavy-vs-light contrast**

```bash
node tools/perf_estimate.mjs --pattern patterns/egg/cosmic_bloom.js --map maps/egg_mapping/led_map_3d.csv
node tools/perf_estimate.mjs --pattern examples/utility/solid_color.js --map maps/egg_mapping/led_map_3d.csv
```
Expected: `cosmic_bloom` reports ~5 expensive ops, `bound: "compute"`, and ~18.9 FPS; `solid_color` reports 0 ops, `bound: "output"`, and ~22.6 FPS — a materially higher estimate. If the light pattern is not strictly higher, stop — the model is being fed wrong.

**Why this specific pair** (do not substitute a lower-op "heavy" pattern): at
1449 pixels on WS2812 the output path costs 44.2 ms/frame, so the rig is
output-bound — and therefore pinned at 22.62 FPS — for any pattern with 0–3
expensive ops. Only at 4+ ops does compute overtake output and the estimate
start moving. A contrast test needs one pattern on each side of that
crossover. (`fibonacci_dream` looks heavy but counts only 1 op: its hot loop
is `wave()`/`mod()`, which are cheap LUT operations and correctly excluded
from `EXPENSIVE_OPS`.)

- [ ] **Step 4: Check the missing-emulator error path**

```bash
PB_EMU_ROOT=/nonexistent node tools/perf_estimate.mjs --pattern patterns/egg/gyroid.js --pixel-count 1449
```
Expected: exit 2 with the "emulator not found at /nonexistent (set PB_EMU_ROOT)" message, no stack trace.

- [ ] **Step 5: Commit**

```bash
cd /Users/paytonschwarz/code/pb/pb_pattern_maker
git add pattern_maker/tools/perf_estimate.mjs
git commit -m "Add headless hardware-FPS estimate harness"
```

---

### Task 3: `pb.py perf` subcommand

**Files:**
- Modify: `/Users/paytonschwarz/code/pb/pb_pattern_maker/pattern_maker/pb.py`
- Create: `/Users/paytonschwarz/code/pb/pb_pattern_maker/pattern_maker/test_perf.py`

**Interfaces:**
- Consumes: Task 2's harness JSON keys.
- Produces: `run_perf_estimate(pattern, map_path=None, pixel_count=None, output_method="ws2812") -> dict` (importable, so tests don't shell through argparse) and a `perf` subcommand.

- [ ] **Step 1: Write the failing tests** — create `pattern_maker/test_perf.py`:

```python
import json
import shutil
import subprocess
from pathlib import Path

import pytest

import pb

EMU = Path.home() / "code/pb/pixelblaze-pattern-emulator"
HAVE_NODE = shutil.which("node") is not None
HAVE_EMU = (EMU / "src/vm/hwmodel.js").exists()
HAVE_MAP = Path("maps/egg_mapping/led_map_3d.csv").exists()
integration = pytest.mark.skipif(
    not (HAVE_NODE and HAVE_EMU and HAVE_MAP),
    reason="needs node, the emulator checkout, and the egg map",
)


def test_requires_map_or_pixel_count():
    with pytest.raises(SystemExit):
        pb.run_perf_estimate("patterns/egg/gyroid.js")


def test_missing_node_reports_clearly(monkeypatch):
    monkeypatch.setattr(pb.shutil, "which", lambda _: None)
    with pytest.raises(SystemExit) as e:
        pb.run_perf_estimate("patterns/egg/gyroid.js", pixel_count=1449)
    assert "node" in str(e.value).lower()


def test_harness_failure_surfaces_stderr(monkeypatch):
    def boom(*a, **k):
        return subprocess.CompletedProcess(a, 2, stdout="", stderr="emulator not found at /nope")
    monkeypatch.setattr(pb.subprocess, "run", boom)
    with pytest.raises(SystemExit) as e:
        pb.run_perf_estimate("patterns/egg/gyroid.js", pixel_count=1449)
    assert "emulator not found" in str(e.value)


@integration
def test_real_estimate_against_egg_map():
    result = pb.run_perf_estimate(
        "patterns/egg/fibonacci_dream.js", map_path="maps/egg_mapping/led_map_3d.csv"
    )
    assert result["pixelCount"] > 1000
    assert result["renderPicked"].startswith("render")
    assert result["expensiveOpCount"] > 0
    assert 0 < result["estFps"] <= 120
    assert result["bound"] in ("compute", "output")


@integration
def test_expensive_pattern_estimates_slower_than_cheap_one():
    # cosmic_bloom (~5 expensive ops) is compute-bound at 1449px; solid_color
    # (0 ops) is output-bound. The pair must straddle that crossover — below
    # 4 ops the egg is pinned at its 22.62 FPS output ceiling and every
    # pattern estimates identically, so a same-side pair proves nothing.
    heavy = pb.run_perf_estimate(
        "patterns/egg/cosmic_bloom.js", map_path="maps/egg_mapping/led_map_3d.csv"
    )
    light = pb.run_perf_estimate(
        "examples/utility/solid_color.js", map_path="maps/egg_mapping/led_map_3d.csv"
    )
    assert heavy["expensiveOpCount"] > light["expensiveOpCount"]
    assert light["estFps"] > heavy["estFps"]
    assert heavy["bound"] == "compute"
    assert light["bound"] == "output"
```

- [ ] **Step 2: Run to verify failure**

Run: `cd /Users/paytonschwarz/code/pb/pb_pattern_maker/pattern_maker && uv run python -m pytest test_perf.py -q`
Expected: FAIL — `AttributeError: module 'pb' has no attribute 'run_perf_estimate'`.

- [ ] **Step 3: Implement in `pb.py`.** Add to the imports at the top:

```python
import json
import shutil
import subprocess
```

Add the runner and command function (place them next to the other `cmd_*` functions):

```python
HARNESS = Path(__file__).parent / "tools" / "perf_estimate.mjs"


def run_perf_estimate(pattern: str, map_path: str | None = None,
                      pixel_count: int | None = None,
                      output_method: str = "ws2812") -> dict:
    """Estimate hardware FPS by shelling to the node harness. Exits with a
    named message rather than a traceback on any failure."""
    if not map_path and not pixel_count:
        sys.exit("Need --map or --pixel-count to know how many LEDs to model.")
    if shutil.which("node") is None:
        sys.exit("node not found on PATH — required for the perf estimate.")

    cmd = ["node", str(HARNESS), "--pattern", pattern, "--output-method", output_method]
    if map_path:
        cmd += ["--map", map_path]
    if pixel_count:
        cmd += ["--pixel-count", str(pixel_count)]

    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        sys.exit(proc.stderr.strip() or f"perf estimate failed (exit {proc.returncode})")
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError:
        sys.exit(f"perf estimate returned unreadable output: {proc.stdout[:200]}")


def cmd_perf(args):
    result = run_perf_estimate(args.file, args.map, args.pixel_count, args.output_method)
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        fps = result["estFps"]
        print(f"{args.file}")
        print(f"  {result['pixelCount']} pixels ({result['dim']}D map) -> {result['renderPicked']}")
        print(f"  {result['expensiveOpCount']} expensive op(s) in the rendered function")
        print(f"  est. {fps:.1f} FPS on V3 / {result['outputMethod']} ({result['bound']}-bound)")
    if args.min_fps and result["estFps"] < args.min_fps:
        sys.exit(f"FAIL: {result['estFps']:.1f} FPS is below --min-fps {args.min_fps}")
```

Register the subcommand in `main()` alongside the others:

```python
    p = sub.add_parser("perf", help="estimate hardware FPS for a pattern (no device needed)")
    p.add_argument("file")
    p.add_argument("--map", help="map CSV/JSON to take the pixel count and dimensionality from")
    p.add_argument("--pixel-count", type=int, help="model this many pixels instead of reading a map")
    p.add_argument("--output-method", default="ws2812", choices=["ws2812", "expander", "apa102"])
    p.add_argument("--min-fps", type=float, help="exit non-zero if the estimate falls below this")
    p.add_argument("--json", action="store_true", help="print the raw JSON result")
    p.set_defaults(fn=cmd_perf)
```

- [ ] **Step 4: Run tests to verify pass**

Run: `uv run python -m pytest test_perf.py -q`
Expected: 5 passed (or 3 passed + 2 skipped without node/emulator/map).
Run: `uv run python -m pytest -q` — Expected: whole suite green.

- [ ] **Step 5: Exercise the CLI both ways**

```bash
uv run python pb.py perf patterns/egg/fibonacci_dream.js --map maps/egg_mapping/led_map_3d.csv
uv run python pb.py perf patterns/egg/fibonacci_dream.js --map maps/egg_mapping/led_map_3d.csv --min-fps 200; echo "exit=$?"
```
Expected: first prints the summary and exits 0; second prints a FAIL line and `exit=1`.

- [ ] **Step 6: Commit**

```bash
cd /Users/paytonschwarz/code/pb/pb_pattern_maker
git add pattern_maker/pb.py pattern_maker/test_perf.py
git commit -m "Add pb.py perf subcommand for hardware FPS estimates"
```

---

### Task 4: Documentation

**Files:**
- Modify: `pattern_maker/CLAUDE.md` (device-CLI command block)
- Modify: `pattern_maker/AGENTS.md` (workflow/command list)
- Modify: `pattern_maker/references/safety-rules.md` (Performance Budget section)
- Modify: root `CLAUDE.md` (device CLI block)

- [ ] **Step 1: Add the command to `pattern_maker/CLAUDE.md`'s device-CLI block:**

```bash
uv run python pb.py perf patterns/egg/foo.js --map maps/egg_mapping/led_map_3d.csv  # est. hardware FPS (no device)
```

- [ ] **Step 2: Same one-liner in root `CLAUDE.md`'s device-CLI block and in `AGENTS.md`'s command list**, noting it needs no device.

- [ ] **Step 3: Point `references/safety-rules.md`'s Performance Budget section at the tool.** Append after the "Practical limits by LED count" list:

```markdown
These thresholds are rules of thumb. To actually measure, run
`pb.py perf <pattern> --map <your map>` — it reports estimated FPS on a V3
for your real pixel count, and whether the pattern is compute-bound (optimize
the render function) or output-bound (the LED wiring is the ceiling, so
optimizing the pattern won't help).
```

- [ ] **Step 4: Verify docs are accurate** — run each command exactly as written in the docs and confirm it works.

- [ ] **Step 5: Commit**

```bash
git add pattern_maker/CLAUDE.md pattern_maker/AGENTS.md pattern_maker/references/safety-rules.md CLAUDE.md
git commit -m "Document the pb.py perf command"
```

## Self-review notes

- **Spec coverage:** shared `hwmodel.js` (T1), harness importing lint/map/hwmodel via `$PB_EMU_ROOT` (T2), `pb.py perf` with advisory default + `--min-fps` teeth (T3), both `--map` and `--pixel-count` inputs (T2/T3), compute-vs-output reporting (T2 `bound`, T3 print), named errors for missing node/emulator (T2 step 4, T3 tests), emulator suite green as proof of no HUD change (T1 step 6), heavy-vs-light sanity check (T2 step 3, T3 test), docs (T4). No gaps.
- **Placeholders:** none — every code step carries complete code.
- **Type consistency:** the JSON keys emitted in T2 (`pixelCount`, `dim`, `renderPicked`, `expensiveOpCount`, `estFps`, `bound`, `outputMethod`) are exactly the keys read in T3's `cmd_perf` and asserted in T3's tests. `estimateHardwareFps`'s destructured parameter names match between T1's module, T1's tests, and T2's call site.
