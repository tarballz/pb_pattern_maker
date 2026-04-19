# palette_maker

Tool + skill that converts cpt-city palette URLs into PixelBlaze gradient-palette
blocks matching the style used in `pattern_maker/patterns/egg/hc_pat.js`.

## When to use

- User pastes a cpt-city URL.
- A pattern needs a new palette and the user has one in mind from cpt-city.

## When NOT to use

- Fuzzy palette description ("sunset-y with purple"). Not built yet. Ask the
  user to browse https://phillips.shef.ac.uk/pub/cpt-city/ and paste a URL.

## How it fits

- `pattern_maker/` — authors `.js` patterns; consumes the blocks this tool emits.
- `palette_maker/` (this) — sources palettes.
- Root `marimapper` workflow — LED coordinate mapping; independent of this.

Each is a separate subsystem with its own `CLAUDE.md`.

## Primary command

```bash
cd palette_maker
uv run python palette.py url "<cpt-city-url>"
```

Output goes to stdout; paste into the pattern's palette section (before the
`var palettes = [...]` array) and add the new `<slug>_gp` to that array.
