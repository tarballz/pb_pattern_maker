# Hardware Performance Gate — Design

## Problem

The pattern-authoring system can tell you a pattern is *unsafe* (allocation in
render, `time()` in render — hard errors in `validate.py`), but it cannot tell
you a pattern is *too slow*. Performance guidance today is qualitative
(`references/safety-rules.md`'s "1000+ LEDs: keep render minimal") and the
static check is toothless: `validate.py` flags expensive calls in render as
WARN, deduped per callee, so twenty `atan2` calls report identically to one.
The result is 106 accumulated warnings across `patterns/` and `examples/` that
authors and reviewers routinely dismiss as a known false-positive class.

The one genuinely quantitative tool — the emulator's estimated-hardware-FPS
HUD, which models V3 compute and per-output-method bandwidth — only exists
when a human opens a browser and reads it. Nothing in the authoring loop
(validate → compile → push) consults it, and `pb.py` has no performance check
at all.

Goal: make that existing model callable from the command line so a pattern's
estimated hardware FPS against a real map can be checked without a browser.

## Scope decisions (user-confirmed)

- **Shared model, not a duplicate.** The calibration constants and formula are
  extracted into a pure module in the emulator repo so the browser HUD and the
  CLI can never disagree. This is a second scoped exception to the standing
  "ask before editing the emulator repo" rule (the first was the real-compiler
  hook); it is an extraction with no behavior change, not a redesign.
- **Advisory by default.** A new `pb.py perf` command, not a new class of
  `validate.py` error. It exits non-zero only when explicitly given
  `--min-fps`. Rationale: adding another always-on warning to a pile of 106
  already-ignored warnings would change nothing.

Explicitly out of scope: fixing `validate.py`'s dedup-counting bug (the
emulator's `countExpensiveRenderOps` already counts every call site, and this
work makes that the authoritative counter); retuning the calibration constants
(they remain ElectroMage's published figures, already commented in-repo as
estimates rather than measurements).

## Design

### 1. `src/vm/hwmodel.js` (new, emulator repo, pure)

Moves verbatim out of `src/app/main.js`:

- `HW_EST` — `COMPUTE_PX_PER_SEC: 48000`, `EXPENSIVE_OP_PENALTY: 0.15`,
  `OUTPUT: { ws2812: {rate: 33000, resetSec: 0.0003}, expander: {rate: 66000,
  resetSec: 0}, apa102: {rate: Infinity, resetSec: 0} }`, `MAX_DISPLAY_FPS:
  120` — with its existing source-citation comments preserved.
- `estimateHardwareFps({ pixelCount, outputMethod, expensiveOpCount })` →
  `number | null` (null when `pixelCount` is falsy). Same arithmetic as today:
  compute rate derated by the expensive-op penalty, output time per method
  plus latch, `FPS = min(1 / max(tCompute, tOutput), MAX_DISPLAY_FPS)`.

`main.js` imports both and keeps a thin local wrapper that reads
`state.preparedMap.pixelCount`, `state.options.outputMethod`, and the
module-level `expensiveOpCount`, then delegates. **No browser behavior
change** — the HUD must render identical numbers.

### 2. `pattern_maker/tools/perf_estimate.mjs` (new, node harness)

Imports from `$PB_EMU_ROOT` (default `~/code/pb/pixelblaze-pattern-emulator`),
all already-pure and headless-proven (the emulator's own
`test/integration.test.js` drives these under `environment: 'node'`):

- `countExpensiveRenderOps` from `src/vm/lint.js`
- `estimateHardwareFps`, `HW_EST` from the new `src/vm/hwmodel.js`
- `parseMapContent`, `prepareMap`, `selectRenderFnInfo` from `src/map/index.js`

The map parse serves two purposes: real `pixelCount`, and a dimensionality
that determines which render function the firmware would actually dispatch to
— so the op count bills `render3D` *or* `render2D`, never both.

Input via argv: pattern path, optional map path, optional explicit pixel
count, output method. Output: a single JSON object on stdout —
`{ pixelCount, dim, renderPicked, expensiveOpCount, estFps, bound, outputMethod }`
where `bound` is `"compute"` or `"output"`.

### 3. `pb.py perf` (new subcommand)

```
pb.py perf <pattern.js> [--map <csv>] [--pixel-count N]
          [--output-method ws2812|expander|apa102] [--min-fps N] [--json]
```

Shells to node with the harness, pretty-prints the result (estimated FPS,
expensive-op count, picked render function, compute- vs output-bound — the
last tells the author whether to optimize the pattern or change wiring), and
passes `--json` through for scripting. Exit code 1 only when `--min-fps` is
given and the estimate falls short. `--map` and `--pixel-count` are mutually
exclusive alternatives; at least one is required.

Failure modes get named, actionable errors rather than tracebacks: node not on
PATH; `$PB_EMU_ROOT` unset and the default checkout absent; map file
unparseable.

## Testing

- **Emulator**: unit tests for the pure `hwmodel.js` — known inputs to known
  FPS, both sides of the compute/output crossover (a small WS2812 rig is
  output-bound; a large one is compute-bound), and the `apa102`
  `rate: Infinity` path. Full existing suite must stay green, which is what
  proves the HUD extraction was behavior-preserving.
- **pattern_maker**: pytest for `pb.py perf` argument handling and error
  paths (missing node, missing emulator root, neither `--map` nor
  `--pixel-count`), plus one integration test invoking the real harness
  against a real pattern and the egg map — skipped when node or the emulator
  checkout is unavailable, following the repo's existing skip-if-absent
  convention.
- **Sanity check** (manual, recorded in the implementation report): on the
  1449-LED egg map, a heavy pattern (`fibonacci_dream`, dense `atan2`) must
  estimate materially lower FPS than a light one (`solid_color`).

## Docs

`pattern_maker/CLAUDE.md` and AGENTS.md's command list gain the new command.
`references/safety-rules.md`'s Performance Budget section gains a pointer that
this is how to measure rather than guess.
