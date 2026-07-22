---
name: palette
description: Use when the user pastes a cpt-city palette URL, asks to "add a palette" or "grab a palette from cpt-city", or describes a palette by color/mood ("warm sunset", "something icy", "resembles labradorite", "a palette for a stormy ocean"). Turns URLs or fuzzy descriptions into PixelBlaze-ready gradient-palette blocks using the committed cpt-city index (6000+ palettes).
---

# palette

Turn a cpt-city URL — or a conversational color/mood description — into a PixelBlaze-ready gradient-palette block.

## Trigger

Invoke when the user:

- pastes a cpt-city URL (any of: `https://phillips.shef.ac.uk/pub/cpt-city/...`, legacy `soliton.vm.bytemark.co.uk/...`, or a `resource/schemes/<id>` direct-scheme URL),
- describes a palette by **colors or mood** ("warm sunset with purple", "something icy", "resembles labradorite", "stormy ocean", "desert at dusk"),
- says "add this palette to <pattern file>" with a URL,
- asks for a new palette for a pattern and you need one.

There are two paths — pick based on what the user gave you:

1. **URL path** — they pasted a URL. Run the CLI, show the block, offer to append.
2. **Discovery path** — they described colors/mood. Search the committed index, present 3–5 candidate swatches, let them pick, then emit the block.

## Block style (both paths produce this)

```
//<canonical cpt-city URL>
//<color description>
var <slug>_gp = [
    0, R, G, B,
    ...,
  255, R, G, B]

arrayMutate(<slug>_gp,(v, i ,a) => v / 255);
```

---

## Path 1 — URL

From the repo root:

```bash
cd palette_maker && uv run python palette.py url "<cpt-city-url>"
```

By default it prints the palette block to stdout and an ANSI 24-bit color swatch to stderr, so `... > out.js` still captures clean code while the swatch stays visible in the terminal. `--no-preview` suppresses the swatch.

Workflow:

1. **Run the CLI** with the URL the user gave. It handles URL normalization (legacy hosts, `.png.index.html` suffixes, direct scheme URLs) automatically.
2. **Show the user the block** exactly as the CLI printed it.
3. **If the user has an open pattern file**, ask whether to append the block to its palette section. If the palette is in the committed index (most are — try `show <slug>` first), use the insert command, which places the block before `var palettes = [...]` and registers it in the array automatically:

   ```bash
   cd palette_maker && uv run python palette.py insert <slug> <path/to/pattern.js>
   ```

   Only insert manually (block before the `var palettes = [...]` declaration, new `<slug>_gp` appended to the array — see `pattern_maker/patterns/egg/hc_pat.js:120`) when the palette isn't indexed or the pattern has no `palettes` array.
4. **If the CLI errors**, surface the error verbatim. Common cases:
   - `no CSS3 gradient link found` — URL isn't a palette page; ask the user to double-check.
   - HTTP 4xx/5xx — cpt-city might be transiently down, or URL is wrong.

---

## Path 2 — Discovery by color/mood

The committed index at `palette_maker/data/cpt_city_index.jsonl` has 6000+ palettes — one JSON object per line with `slug`, `author`, `collection`, `url`, `color_names` (dash-joined summary like `teal-purple`), and `stops` (list of `[pos, r, g, b]` tuples). That's enough to score palettes any way the query demands.

**Don't call a fixed `search` subcommand — there isn't one.** Each query needs its own scoring logic. Write per-query Python inline.

### Workflow

1. **Read the index.** It's small enough to load fully:

   ```python
   import json
   from pathlib import Path
   entries = [json.loads(l) for l in Path("palette_maker/data/cpt_city_index.jsonl").open()]
   ```

2. **Write a scoring function** specific to the user's prompt, building on the shared helpers in `palette_maker.score` (`luminance`, `saturation`, `warmth`, `stop_stats`, and the `WARM_NAMES`/`COOL_NAMES`/`NEUTRAL_NAMES` sets) rather than re-deriving them. Consider:
   - `color_names` — literal match for explicit colors ("purple", "teal") and mood proxies (`WARM_NAMES` = warm; `COOL_NAMES` + "white" = cool/icy).
   - `stops` — `stop_stats(entry["stops"])` gives min/max/mean luminance, mean saturation, and mean warmth. E.g. "labradorite" wants low `mean_lum` with high `max_lum` flashes.
   - Stop count — reject palettes that are clearly wrong (e.g. >15 stops for a "simple two-color gradient" request).

   **Strongly prefer hard rejects over soft bonuses.** With 6000+ candidates, a +40 "cool color" bonus gets drowned by palettes that happen to be dark and saturated but are otherwise wrong (e.g. a red/brown sunset when the user asked for labradorite). If the prompt says "cool iridescent," *disqualify* any palette whose name_summary contains red/orange/yellow/brown — don't just bonus the cool ones. Be opinionated; filter aggressively first, then rank what's left.

3. **Rank and keep the top 3–5.** Sort by score, slice, take what you need.

4. **Render an ANSI swatch for each.** Reuse the existing helper:

   ```python
   from palette_maker.preview import render_swatch
   from palette_maker.parse import Stop
   stops = [Stop(*tpl) for tpl in entry["stops"]]
   swatch = render_swatch(stops)
   ```

5. **Present them to the user.** Print slug + `author/collection` + URL + swatch for each candidate. Ask which one they want.

   **Critical: let the Bash tool output itself be the presentation.** The swatches are raw ANSI 24-bit escape sequences (`\x1b[48;2;R;G;Bm...`). Claude Code renders ANSI *in the Bash tool output view* but not in assistant-authored markdown — if you summarize the candidates in your reply (prose, a table, a fenced code block of the "results"), the user sees plain text or literal escape bytes, not colors. So: run the script once, let the user see the Bash output directly, and in your reply just say something like "picks above — which one?" Don't re-paste the swatch section.

6. **On pick, emit the block:**

   ```bash
   cd palette_maker && uv run python palette.py show <slug>
   ```

   If the slug is ambiguous, the CLI will list candidate `<author>/<collection>/<slug>` paths; re-run with `--author <a>` and/or `--collection <c>`. If the user has an open pattern file, offer to append with `palette.py insert <slug> <pattern.js>` (same flags for disambiguation).

   For a preview the user can view outside the terminal, both `show` and `url` accept `--html <path>` to write a standalone HTML gradient swatch.

### Worked example — "I want a palette that resembles labradorite"

```python
import json
from pathlib import Path
from palette_maker.parse import Stop
from palette_maker.preview import render_swatch
from palette_maker.score import WARM_NAMES, COOL_NAMES, saturation, stop_stats

entries = [json.loads(l) for l in Path("palette_maker/data/cpt_city_index.jsonl").open()]

def score(entry):
    stops = entry["stops"]
    if len(stops) < 3 or len(stops) > 12:
        return -1
    names = set(entry["color_names"])
    # Hard rejects — labradorite is dark & cool-iridescent, not warm.
    if names & WARM_NAMES:
        return -1
    if not (names & COOL_NAMES):
        return -1
    # Must be dark overall with at least one bright saturated "flash" stop.
    stats = stop_stats(stops)
    max_sat = max(saturation(r, g, b) for _, r, g, b in stops)
    if stats["mean_lum"] > 0.35:
        return -1
    if max_sat < 0.6:
        return -1
    # Rank survivors: darker base + more saturated flashes win.
    return (1 - stats["mean_lum"]) + max_sat

ranked = sorted(entries, key=score, reverse=True)[:5]
for e in ranked:
    stops = [Stop(*tpl) for tpl in e["stops"]]
    print(f"{e['slug']}  {e['author']}/{e['collection']}")
    print(render_swatch(stops))
    print(e["url"])
    print()
```

Then present the output to the user and ask them to pick.

### When results are empty or too many

**Don't give up.** Loosen or tighten filters and retry:

- Empty? Widen the scoring thresholds (e.g. raise the brightness cap, drop a required color-name hit).
- 100+? Add a cue — stop-count cap, a specific color requirement, a luminance range.

The committed index has 6000+ palettes — something matches almost any prompt.

---

## Slug override (both paths)

The slug is derived from the URL or index entry's last path segment. If the user needs a specific name (e.g. to avoid a collision with an existing `_gp` variable), pass `--slug <name>`:

```bash
uv run python palette.py url "<url>" --slug <custom_name>
uv run python palette.py show <indexed_slug> --slug <custom_name>
```

## Refreshing the index

Rare — the committed JSONL is the source of truth for discovery. To rebuild from a fresh cpt-city clone, see `palette_maker/CLAUDE.md` → "Refreshing the palette index".
