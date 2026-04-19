# CLAUDE.md

Guidance for Claude Code when working in this subproject.

## What This Is

`palette_maker/` turns cpt-city palette URLs into PixelBlaze-ready gradient-palette
blocks (the `var <name>_gp = [...]` + `arrayMutate(...)` form used in
`pattern_maker/patterns/egg/hc_pat.js`).

It's a top-level sibling to `pattern_maker/`, not nested, because its logic is
pattern-language-agnostic and it will grow its own committed data (palette
index in Phase 2).

## Commands

All commands use `uv` and run from this directory.

```bash
uv sync                                             # set up venv
uv run python palette.py url <cpt-city-url>         # fetch + format a palette (+ ANSI swatch to stderr)
uv run python palette.py url <cpt-city-url> --no-preview  # suppress the swatch
uv run pytest                                       # all tests
uv run pytest tests/test_urls.py -v                 # one test file
```

## Conventions

- Source package: `palette_maker/` (urls, parse, format, fetch, cli).
- CLI shim: `palette.py` at the subproject root — entry point for `uv run python palette.py ...`.
- Fixtures live in `tests/fixtures/` (real cpt-city CSS exports).
- No network in tests — HTTP is mocked with `respx`.
- Skill at `.claude/skills/palette/SKILL.md` — invoked when a user pastes a cpt-city URL in a Claude Code session.

## Phase status

Phase 1 (current): URL → block. Supports collection URLs, legacy mirror URLs,
and direct `resource/schemes/<id>` URLs.

Phase 2 (not built): `search`, `show`, `index` subcommands for conversational
palette discovery. See the plan file that drove this work for details.
