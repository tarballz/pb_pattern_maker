# PixelBlaze LED Art

Pattern authoring, color palettes, and LED mapping for PixelBlaze-controlled installations.

This repo has two subprojects. All Python commands use [`uv`](https://docs.astral.sh/uv/) (never bare `pip`/`python`).

## Pattern Maker

`pattern_maker/` is a knowledge system that makes Claude Code an expert PixelBlaze pattern author. It includes reference docs, example patterns, user patterns organized by project, LED coordinate maps, and a static analyzer that enforces PixelBlaze safety rules.

```bash
cd pattern_maker

# Validate a single pattern
uv run python validate.py patterns/egg/lava_lamp.js

# Validate all patterns (or all examples)
uv run python validate.py patterns/
uv run python validate.py examples/

# Run the validator tests
uv run pytest test_validate.py
```

Layout:

- `AGENTS.md` — full pattern-authoring rules and system prompt (read this before writing any pattern)
- `references/` — `language.md`, `safety-rules.md`, `3d-techniques.md`, `waveforms.md`
- `examples/` — reference patterns grouped as `geometric/`, `organic/`, `utility/`
- `patterns/` — user patterns by project (`egg/`, `zranger_2d_3d/`)
- `maps/` — LED coordinate maps (marimapper scans)
- `validate.py` / `test_validate.py` — the safety-rule static analyzer and its tests

## Palette Maker

`palette_maker/` turns [cpt-city](http://soliton.vm.bytemark.co.uk/pub/cpt-city/) palette URLs — or fuzzy color descriptions — into PixelBlaze-ready gradient-palette blocks. It ships a `palette` skill and a committed index of 6000+ palettes.

```bash
cd palette_maker

# cpt-city URL → PixelBlaze gradient block
uv run python palette.py url <cpt-city-url>

# Look up a palette by slug from the index
uv run python palette.py show <slug>

# Tests
uv run pytest
```

Launch Claude Code from the repo root (not from `pattern_maker/`) so the `palette` skill at `palette_maker/.claude/skills/palette/` is discoverable while you author patterns.

## LED Mapping

LED coordinate maps live under `pattern_maker/maps/<project>/`, scanned with [marimapper](https://github.com/TheMariday/marimapper), which captures LED positions via webcam and uploads 3D coordinate maps to the PixelBlaze controller.

```bash
marimapper_check_backend pixelblaze --server <ip>     # test connection
marimapper pixelblaze --server <ip>                    # scan (run from the target map dir)
marimapper_upload_mapping_to_pixelblaze --server <ip>  # upload led_map_3d.csv
```

## Projects

- **egg** — 3D egg sculpture (~1400–1500 LEDs), the first installation. Patterns in `pattern_maker/patterns/egg/`, map in `pattern_maker/maps/egg_mapping/`.
- **zranger_2d_3d** — 2D/3D pattern collection in `pattern_maker/patterns/zranger_2d_3d/`.
