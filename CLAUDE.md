# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PixelBlaze LED art project with two subprojects:

- **Pattern authoring** (`pattern_maker/`) — Knowledge system that makes Claude an expert PixelBlaze pattern author. See `pattern_maker/AGENTS.md` for the full system prompt and rules. Has its own `CLAUDE.md` with pattern-specific commands and conventions. LED coordinate maps (scanned via [marimapper](https://github.com/TheMariday/marimapper)) live under `pattern_maker/maps/`.
- **Palette maker** (`palette_maker/`) — Turns cpt-city palette URLs (or fuzzy color descriptions) into PixelBlaze-ready gradient-palette blocks. Ships a `palette` skill (at `palette_maker/.claude/skills/palette/`) and a committed index of 6000+ palettes. Has its own `CLAUDE.md`. Launch Claude Code from the repo root (not from `pattern_maker/`) so the skill is discoverable while authoring patterns.

A companion emulator lives outside this repo at `~/code/pb/pixelblaze-pattern-emulator` (Vite + Three.js). It executes patterns against real maps without hardware and mounts this repo's `patterns/` and `maps/` dirs via its `.env.local`. Use it to preview patterns during authoring (`npm run dev` there).

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

### Device CLI (run from `pattern_maker/`; `compile`/`render`/`perf` need no hardware, the rest take a device via `--server`/`$PB_SERVER`/discovery — real or `uv run python -m fakeblaze`)

```bash
cd pattern_maker && uv run python pb.py compile patterns/egg/foo.js   # real bytecode compile check (offline via cached compiler)
cd pattern_maker && uv run python pb.py render patterns/egg/foo.js --map maps/egg_mapping/led_map_3d.csv  # headless render, no hardware
cd pattern_maker && uv run python pb.py push patterns/egg/foo.js      # live trial (--save to keep)
cd pattern_maker && uv run python pb.py devices                       # discover / list / vars / backup / frame
cd pattern_maker && uv run python pb.py perf patterns/egg/foo.js --map maps/egg_mapping/led_map_3d.csv  # est. hardware FPS (no device)
cd pattern_maker && uv run python pb.py fetch-compiler                # one-time with real hardware: enable offline compile
```

### Palette maker (run from `palette_maker/`)

```bash
cd palette_maker && uv run python palette.py url <cpt-city-url>   # URL → PB gradient block
cd palette_maker && uv run python palette.py show <slug>          # look up a palette by slug from the index
cd palette_maker && uv run python palette.py insert <slug> <pattern.js>  # insert into a pattern's palettes array
cd palette_maker && uv run pytest                                 # tests
```

### Marimapper (external CLI; scans land under `pattern_maker/maps/<project>/`)

```bash
marimapper_check_backend pixelblaze --server <ip>     # test connection
marimapper pixelblaze --server <ip>                    # scan (run from the target map dir)
marimapper_upload_mapping_to_pixelblaze --server <ip>  # upload led_map_3d.csv
```

## Architecture

```
pb_pattern_maker/
├── pattern_maker/        # PixelBlaze pattern authoring system
│   ├── AGENTS.md         # System prompt — Claude as PB pattern expert
│   ├── CLAUDE.md         # Pattern-specific commands/conventions
│   ├── validate.py       # AST-based static analysis enforcing PB safety rules
│   ├── test_validate.py  # pytest tests for the validator
│   ├── pb.py             # Device CLI: offline compile, headless render, push, backup, vars
│   ├── compiler.py       # Offline compilation via the cached device compiler
│   ├── references/       # Language, safety, techniques, waveforms docs
│   ├── examples/         # Reference patterns (geometric/, organic/, utility/)
│   ├── patterns/         # User patterns organized by project (e.g. patterns/egg/)
│   └── maps/             # LED coordinate maps (marimapper scans, <project>_map.json)
├── palette_maker/        # cpt-city URL → PixelBlaze gradient-palette block
│   ├── CLAUDE.md         # Palette-specific commands/conventions
│   ├── palette.py        # CLI entry point
│   ├── palette_maker/    # urls, parse, format, fetch, cli, index
│   ├── data/             # Committed cpt-city index (cpt_city_index.jsonl)
│   ├── tests/            # pytest + fixtures (no network)
│   └── .claude/skills/palette/  # Skill auto-loaded when launched from pb/ root
└── docs/                 # Design specs and plans
```

**Pattern authoring flow**: Read `pattern_maker/AGENTS.md` before writing any pattern. It defines mandatory safety rules (no allocation in render functions, ES6 subset restrictions, performance constraints) and the required pattern structure. All patterns must pass `validate.py` before delivery.
