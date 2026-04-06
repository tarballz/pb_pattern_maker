# PixelBlaze LED Art

Pattern authoring and LED mapping for PixelBlaze-controlled installations.

## Pattern Maker

`pattern_maker/` is a knowledge system that makes Claude Code an expert PixelBlaze pattern author. It includes reference docs, example patterns, and a static analyzer that enforces PixelBlaze safety rules.

```bash
cd pattern_maker

# Validate a pattern
uv run python validate.py patterns/egg/lava_flow.js

# Validate all patterns
uv run python validate.py patterns/

# Run tests
uv run pytest test_validate.py
```

See `pattern_maker/AGENTS.md` for the full pattern authoring rules.

## LED Mapping

`egg_mapping/` contains scan data from [marimapper](https://github.com/TheMariday/marimapper), which captures LED positions via webcam and uploads 3D coordinate maps to the PixelBlaze controller.

## Projects

- **egg** — ~1400-1500 LED 3D egg sculpture (first installation)
