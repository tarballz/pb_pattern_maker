---
name: palette
description: Use when the user pastes a cpt-city palette URL, asks to "add a palette" or "grab a palette from cpt-city", or asks how to get palette arrays into a PixelBlaze pattern. Converts a cpt-city URL into a ready-to-paste PixelBlaze gradient-palette block (URL comment + color description + `var <name>_gp = [...]` + `arrayMutate` line). Phase 1 handles URLs only; fuzzy discovery ("warm sunset with purple") is not built yet.
---

# palette

Turn a cpt-city palette URL into a PixelBlaze-ready gradient-palette block.

## Trigger

Invoke when the user:

- pastes a cpt-city URL (any of: `https://phillips.shef.ac.uk/pub/cpt-city/...`, legacy `soliton.vm.bytemark.co.uk/...`, or a `resource/schemes/<id>` direct-scheme URL),
- asks for a new palette for a pattern and you need one,
- says "add this palette to <pattern file>" with a URL,
- asks "how do I get a palette" or similar.

Do NOT invoke for fuzzy descriptions ("I want something sunset-y"). Phase 1 only supports URLs. If the user describes colors without a URL, respond:

> Fuzzy palette discovery isn't built yet — please paste a cpt-city URL (e.g. browse https://phillips.shef.ac.uk/pub/cpt-city/ and drop me a link).

## How to run

From the repo root:

```bash
cd palette_maker && uv run python palette.py url "<cpt-city-url>"
```

By default it prints the palette block to stdout and an ANSI 24-bit color swatch to stderr, so `... > out.js` still captures clean code while the swatch stays visible in the terminal. `--no-preview` suppresses the swatch.

Block style (stdout):

```
//<canonical cpt-city URL>
//<color description>
var <slug>_gp = [
    0, R, G, B,
    ...,
  255, R, G, B]

arrayMutate(<slug>_gp,(v, i ,a) => v / 255);
```

## Workflow

1. **Run the CLI** with the URL the user gave. It handles URL normalization (legacy hosts, `.png.index.html` suffixes, direct scheme URLs) automatically.
2. **Show the user the block** exactly as the CLI printed it.
3. **If the user has an open pattern file**, ask whether to append the block to its palette section. If yes, insert it *before* the `var palettes = [...]` array declaration (see `pattern_maker/patterns/egg/hc_pat.js:120` for reference), and if the pattern uses a `palettes` array, add the new `<slug>_gp` to that array.
4. **If the CLI errors**, surface the error verbatim. Common cases:
   - `no CSS3 gradient link found` — URL isn't a palette page; ask the user to double-check.
   - HTTP 4xx/5xx — cpt-city might be transiently down, or URL is wrong.

## Slug override

The slug is derived from the URL's last path segment. If the user needs a specific name (e.g. to avoid a collision with an existing `_gp` variable), pass `--slug <name>`:

```bash
uv run python palette.py url "<url>" --slug <custom_name>
```

## Not in scope for Phase 1

- `search` (fuzzy discovery by colors / keywords)
- `show` (ANSI swatch preview)
- `index` (local scrape of cpt-city)

These are deferred until Phase 1 has been used in real pattern authoring and the format is confirmed to match what the user actually wants.
