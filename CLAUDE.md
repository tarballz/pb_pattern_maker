# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PixelBlaze LED art project with two main areas:

- **LED mapping** (root) — Uses [marimapper](https://github.com/TheMariday/marimapper) to scan LED positions with a webcam and upload 3D coordinate maps to a PixelBlaze controller.
- **Pattern authoring** (`pattern_maker/`) — Knowledge system that makes Claude an expert PixelBlaze pattern author. See `pattern_maker/AGENTS.md` for the full system prompt and rules. Has its own `CLAUDE.md` with pattern-specific commands and conventions.

## Commands

All Python commands use `uv` (never bare `pip` or `python`).

### Validate patterns (run from `pattern_maker/`)

```bash
cd pattern_maker && uv run python validate.py patterns/egg/lava_flow.js   # single file
cd pattern_maker && uv run python validate.py patterns/                     # all patterns
cd pattern_maker && uv run python validate.py examples/                     # examples
```

### Run tests (from `pattern_maker/`)

```bash
cd pattern_maker && uv run pytest test_validate.py
```

### Marimapper

```bash
marimapper_check_backend pixelblaze --server <ip>     # test connection
marimapper pixelblaze --server <ip>                    # scan (run from mapping dir)
marimapper_upload_mapping_to_pixelblaze --server <ip>  # upload led_map_3d.csv
```

## Architecture

```
pb/
├── egg_mapping/          # LED mapping scans for the egg installation
├── pattern_maker/        # PixelBlaze pattern authoring system
│   ├── AGENTS.md         # System prompt — Claude as PB pattern expert
│   ├── CLAUDE.md         # Pattern-specific commands/conventions
│   ├── validate.py       # Static analysis enforcing PB safety rules
│   ├── test_validate.py  # pytest tests for the validator
│   ├── references/       # Language, safety, techniques, waveforms docs
│   ├── examples/         # Reference patterns (geometric/, organic/, utility/)
│   ├── patterns/         # User patterns organized by project (e.g. patterns/egg/)
│   └── maps/             # LED coordinate maps (<project>_map.json)
└── docs/                 # Design specs and plans
```

**Pattern authoring flow**: Read `pattern_maker/AGENTS.md` before writing any pattern. It defines mandatory safety rules (no allocation in render functions, ES6 subset restrictions, performance constraints) and the required pattern structure. All patterns must pass `validate.py` before delivery.
