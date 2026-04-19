"""Format parsed stops as PixelBlaze gradient-palette blocks."""

from __future__ import annotations

from palette_maker.parse import Stop
from palette_maker.urls import sanitize_slug


_NAMED_COLORS: list[tuple[str, tuple[int, int, int]]] = [
    ("black", (0, 0, 0)),
    ("white", (255, 255, 255)),
    ("gray", (128, 128, 128)),
    ("red", (255, 0, 0)),
    ("orange", (255, 128, 0)),
    ("yellow", (255, 255, 0)),
    ("lime", (0, 255, 0)),
    ("green", (0, 128, 0)),
    ("teal", (0, 128, 128)),
    ("cyan", (0, 255, 255)),
    ("blue", (0, 0, 255)),
    ("navy", (0, 0, 128)),
    ("purple", (128, 0, 128)),
    ("magenta", (255, 0, 255)),
    ("pink", (255, 128, 192)),
    ("brown", (139, 69, 19)),
]


def _nearest_name(r: int, g: int, b: int) -> str:
    best_name = ""
    best_dist = 10**9
    for name, (nr, ng, nb) in _NAMED_COLORS:
        d = (r - nr) ** 2 + (g - ng) ** 2 + (b - nb) ** 2
        if d < best_dist:
            best_dist = d
            best_name = name
    return best_name


def describe_stops(stops: list[Stop]) -> str:
    """Produce a dash-joined color summary from the stop list."""
    names: list[str] = []
    for s in stops:
        name = _nearest_name(s.r, s.g, s.b)
        if not names or names[-1] != name:
            names.append(name)
    return "-".join(names)


def format_block(stops: list[Stop], url: str, slug: str) -> str:
    """Produce a PixelBlaze gradient-palette block in hc_pat.js style."""
    var_name = f"{sanitize_slug(slug)}_gp"
    description = describe_stops(stops)

    lines: list[str] = []
    lines.append(f"//{url}")
    lines.append(f"//{description}")
    lines.append(f"var {var_name} = [")

    last = len(stops) - 1
    for i, s in enumerate(stops):
        pos_field = f"{s.pos:>5}"
        r_field = f"{s.r:>4}"
        g_field = f"{s.g:>3}"
        b_field = f"{s.b:>3}"
        tail = "," if i < last else "]"
        lines.append(f"{pos_field},{r_field},{g_field},{b_field}{tail}")

    lines.append("")  # blank line before arrayMutate
    lines.append(f"arrayMutate({var_name},(v, i ,a) => v / 255);")
    return "\n".join(lines) + "\n"
