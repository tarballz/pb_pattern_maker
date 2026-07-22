# CLAUDE.md

Guidance for Claude Code when working in this subproject.

## What This Is

`palette_maker/` turns cpt-city palette URLs into PixelBlaze-ready gradient-palette
blocks (the `var <name>_gp = [...]` + `arrayMutate(...)` form used in
`pattern_maker/patterns/egg/hc_pat.js`).

It's a top-level sibling to `pattern_maker/`, not nested, because its logic is
pattern-language-agnostic and it owns its own committed data (the palette index).

## Commands

All commands use `uv` and run from this directory.

```bash
uv sync                                             # set up venv
uv run python palette.py url <cpt-city-url>         # fetch + format a palette (+ ANSI swatch to stderr)
uv run python palette.py url <cpt-city-url> --no-preview  # suppress the swatch
uv run python palette.py show <slug>                # print the indexed palette's block (+ swatch)
uv run python palette.py show <slug> --author <a> --collection <c>  # disambiguate shared slugs
uv run python palette.py show <slug> --html swatch.html  # also write a portable HTML swatch
uv run python palette.py insert <slug> <pattern.js> # insert block + register in `var palettes = [...]`
uv run python palette.py index build --source <cpt-city-clone>  # (re)build data/cpt_city_index.jsonl
uv run pytest                                       # all tests
uv run pytest tests/test_urls.py -v                 # one test file
```

## Refreshing the palette index

`data/cpt_city_index.jsonl` is a committed artifact listing every cpt-city
palette (slug, author, collection, canonical URL, stops, dashed color-name
summary). It's built locally — no scraping of `phillips.shef.ac.uk`, which has
`Crawl-delay: 5` and would take 20+ hours.

The committed index is the source of truth for palette discovery and for the
`show` subcommand — users don't need a cpt-city clone unless they're refreshing
it.

Source of truth: the cpt-city source repo at
[`codeberg.org/jjgreen/cpt-city`](https://codeberg.org/jjgreen/cpt-city)
(mirrored at [`gitlab.com/jjg/cpt-city`](https://gitlab.com/jjg/cpt-city)).
The raw palette data lives under `level-0/` (version-controlled); the
CSS3-gradient format our parser consumes lives under `level-2/` and is
*generated* by `make level-2` using the `cptutils` C package.

To refresh:

```bash
# 1. Clone (first time only)
git clone https://codeberg.org/jjgreen/cpt-city.git ~/code/cpt-city
git clone https://codeberg.org/jjgreen/cptutils.git ~/code/cptutils

# 2. Build cptutils (the C package that generates level-2 files).
#    Requires libxml2 + libpng + zlib development headers. On Debian/Ubuntu:
#        sudo apt install libxml2-dev libpng-dev zlib1g-dev
#    On macOS: `brew install libxml2 libpng`
#    Then:
cd ~/code/cptutils && ./configure --prefix=$HOME/.local --without-json && make && make install

# 3. Prepare the source tree + generate CSS (levels 1 and 2).
#    level-2 is a Ruby 3.x script; it needs the `parallel` gem.
gem install --user-install parallel
cd ~/code/cpt-city/src
PATH=$HOME/.local/bin:$PATH make dirs-setup level-1 level-2

# 4. Build the index. `--source` points at the level-2 tree; the builder
#    walks it and picks up `.c3g` (CSS3-gradient) files.
cd -
cd palette_maker
uv run python palette.py index build --source ~/code/cpt-city/src/2

# 5. Review + commit
git diff data/cpt_city_index.jsonl | head           # spot-check upstream churn
git add data/cpt_city_index.jsonl && git commit -m "chore: refresh palette index"
```

`index build` accepts `--limit N` for smoke tests and `--output <path>` to
write somewhere other than the default. Layout it expects inside the level-2
tree: `<source>/<author>/<collection>/<slug>.c3g` (what `make level-2`
produces); `.css` files with the same layout are also accepted (used by the
test fixtures).

### Troubleshooting

- **`puts(*)` syntax error in `bin/level-2`** — the script uses Ruby 3.2+
  argument-forwarding. On Ruby 3.0.x, change `def info(*)` / `puts(*)` to
  `def info(*args)` / `puts(*args)`, and `Struct.new(*options_kwarg.keys)` to
  `Struct.new(*options_kwarg.keys, keyword_init: true)`. May also need
  `require 'pathname'` at the top.
- **cptutils: `libpng not found`** — if libpng-dev can't be installed system-
  wide, `apt-get download libpng-dev zlib1g-dev` then `dpkg -x *.deb
  ~/.local/png-extract/` to stage headers, then pass
  `CPPFLAGS=-I$HOME/.local/png-extract/usr/include` and corresponding `-L`
  + `-lz` to `configure`/`make`.

## Conventions

- Source package: `palette_maker/` (urls, parse, format, fetch, cli, index, insert, preview, score).
- `score.py` holds the shared discovery helpers (luminance/saturation/warmth, name sets)
  used by the `palette` skill's fuzzy-search path.
- CLI shim: `palette.py` at the subproject root — entry point for `uv run python palette.py ...`.
- Fixtures live in `tests/fixtures/` (real cpt-city CSS exports).
- No network in tests — HTTP is mocked with `respx`.
- Skill at `.claude/skills/palette/SKILL.md` — invoked when a user pastes a cpt-city URL in a Claude Code session.

## Phase status

Phase 1 (done): URL → block. Supports collection URLs, legacy mirror URLs,
and direct `resource/schemes/<id>` URLs.

Phase 2 (done): `show` and `index build` subcommands plus the committed
6000+-palette index. Conversational discovery is handled by the `palette`
skill, which scores the index with ad-hoc inline Python rather than a fixed
`search` subcommand (see `.claude/skills/palette/SKILL.md`).
