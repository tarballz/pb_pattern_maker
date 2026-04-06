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
