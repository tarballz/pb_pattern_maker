# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PixelBlaze LED art project with two subprojects:

- **Pattern authoring** (`pattern_maker/`) — Knowledge system that makes Claude an expert PixelBlaze pattern author. See `pattern_maker/AGENTS.md` for the full system prompt and rules. Has its own `CLAUDE.md` with pattern-specific commands and conventions. LED coordinate maps (scanned via [marimapper](https://github.com/TheMariday/marimapper)) live under `pattern_maker/maps/`.
- **Palette maker** (`palette_maker/`) — Turns cpt-city palette URLs (or fuzzy color descriptions) into PixelBlaze-ready gradient-palette blocks. Ships a `palette` skill (at `palette_maker/.claude/skills/palette/`) and a committed index of 6000+ palettes. Has its own `CLAUDE.md`. Launch Claude Code from the `pb/` root (not from `pattern_maker/`) so the skill is discoverable while authoring patterns.

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

### Palette maker (run from `palette_maker/`)

```bash
cd palette_maker && uv run python palette.py url <cpt-city-url>   # URL → PB gradient block
cd palette_maker && uv run python palette.py show <slug>          # look up a palette by slug from the index
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
pb/
├── pattern_maker/        # PixelBlaze pattern authoring system
│   ├── AGENTS.md         # System prompt — Claude as PB pattern expert
│   ├── CLAUDE.md         # Pattern-specific commands/conventions
│   ├── validate.py       # Static analysis enforcing PB safety rules
│   ├── test_validate.py  # pytest tests for the validator
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
