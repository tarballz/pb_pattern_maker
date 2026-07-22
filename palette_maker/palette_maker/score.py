"""Shared color-scoring helpers for palette discovery.

Used by the `palette` skill's fuzzy-search path so each query doesn't
re-implement luminance/saturation/warmth from scratch. All helpers take
0-255 RGB channels or index-entry stop tuples `(pos, r, g, b)`.
"""

from __future__ import annotations

# Names produced by format.describe_stops / stored in index color_names.
WARM_NAMES = frozenset({"red", "orange", "yellow", "pink", "magenta", "brown"})
COOL_NAMES = frozenset({"blue", "navy", "cyan", "teal", "green", "lime", "purple"})
NEUTRAL_NAMES = frozenset({"black", "white", "gray"})


def luminance(r: int, g: int, b: int) -> float:
    """Perceptual luminance, 0-1 (Rec. 601 weights)."""
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255


def saturation(r: int, g: int, b: int) -> float:
    """HSV-style saturation, 0-1."""
    hi, lo = max(r, g, b), min(r, g, b)
    return 0.0 if hi == 0 else (hi - lo) / hi


def warmth(r: int, g: int, b: int) -> float:
    """Warm-vs-cool balance, -1 (cool) to +1 (warm)."""
    return (r - b) / 255


def stop_stats(stops: list[tuple[int, int, int, int]]) -> dict[str, float]:
    """Aggregate stats over an index entry's `(pos, r, g, b)` stops.

    Returns min/max/mean luminance, mean saturation, and mean warmth —
    the quantities most discovery heuristics filter on (e.g. "dark base
    with a bright flash" = low mean_lum, high max_lum).
    """
    lums = [luminance(r, g, b) for _, r, g, b in stops]
    sats = [saturation(r, g, b) for _, r, g, b in stops]
    warms = [warmth(r, g, b) for _, r, g, b in stops]
    n = len(stops)
    return {
        "min_lum": min(lums),
        "max_lum": max(lums),
        "mean_lum": sum(lums) / n,
        "mean_sat": sum(sats) / n,
        "mean_warmth": sum(warms) / n,
    }
