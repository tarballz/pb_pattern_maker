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

Device CLI (`pb.py`, wraps [pixelblaze-client](https://github.com/zranger1/pixelblaze-client);
needs the device on the LAN — address from `--server`, `$PB_SERVER`, or discovery):
```bash
uv run python pb.py devices                      # discover Pixelblazes
uv run python pb.py compile patterns/egg/foo.js  # true bytecode compile check
uv run python pb.py push patterns/egg/foo.js     # live trial (not saved)
uv run python pb.py push patterns/egg/foo.js --save  # save to the device
uv run python pb.py list                         # patterns on the device
uv run python pb.py vars [speed=0.5 ...]         # read/set exported vars
uv run python pb.py backup egg.pbb               # full device backup
uv run python pb.py frame -o frame.ppm           # snapshot the preview frame
uv run python pb.py perf patterns/egg/foo.js --map maps/egg_mapping/led_map_3d.csv  # est. hardware FPS (no device)
```

## Conventions

- Patterns go in `patterns/<project>/<name>.js`
- LED coordinate maps go in `maps/<project>/` as marimapper CSV exports:
  - `led_map_3d.csv` — columns `index,x,y,z,xn,yn,zn,error` (raw XYZ, unit normal, fit
    residual; `error = -1` marks interpolated points in the `_filled` variant)
  - `led_map_2d_<timestamp>.csv` — columns `index,u,v` (normalized surface UVs)
  - Maps are uploaded to the device's Mapper tab (see marimapper commands in the root
    README); pattern code never reads them — the firmware feeds normalized 0–1 coords
    to `render2D`/`render3D`
- Example patterns in `examples/` are reference implementations — don't modify without reason
- All patterns must pass `validate.py` with no errors before delivery
- Pattern files are standalone PixelBlaze .js (ES6 subset) — no imports, no Node.js

## Previewing patterns

The companion emulator repo at `~/code/pb/pixelblaze-pattern-emulator` (Vite + Three.js)
renders patterns against real maps without hardware. Its `.env.local` already mounts
this project's `patterns/` and `maps/` dirs. Run `npm run dev` there and use the Path
tab to load a pattern. Caveat: it executes real JS with float math, so device-only
failures (unsupported syntax, fixed-point overflow) won't reproduce there — that's what
`validate.py` is for.
