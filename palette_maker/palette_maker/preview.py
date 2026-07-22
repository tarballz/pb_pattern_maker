"""ANSI 24-bit color swatch rendering for terminals."""

from __future__ import annotations

from palette_maker.parse import Stop


def render_swatch(stops: list[Stop], width: int = 48) -> str:
    """Render an interpolated palette preview as ANSI truecolor background cells."""
    if not stops:
        return ""
    sorted_stops = sorted(stops, key=lambda s: s.pos)

    cells: list[str] = []
    for i in range(width):
        pos = 0 if width == 1 else round(i * 255 / (width - 1))
        r, g, b = _sample(sorted_stops, pos)
        cells.append(f"\x1b[48;2;{r};{g};{b}m \x1b[0m")
    return "".join(cells)


def render_html(stops: list[Stop], title: str = "palette") -> str:
    """Render the palette as a standalone HTML gradient swatch.

    Portable alternative to the ANSI swatch — viewable anywhere, not just
    truecolor terminals.
    """
    sorted_stops = sorted(stops, key=lambda s: s.pos)
    css_stops = ", ".join(
        f"rgb({s.r},{s.g},{s.b}) {s.pos / 255:.1%}" for s in sorted_stops
    )
    return (
        "<!doctype html>\n"
        f"<title>{title}</title>\n"
        '<body style="margin:0;background:#111;display:grid;place-items:center;min-height:100vh">\n'
        f'<div style="width:min(90vw,640px);height:96px;border-radius:8px;'
        f'background:linear-gradient(90deg, {css_stops})"></div>\n'
        "</body>\n"
    )


def _sample(stops: list[Stop], pos: int) -> tuple[int, int, int]:
    if pos <= stops[0].pos:
        s = stops[0]
        return s.r, s.g, s.b
    if pos >= stops[-1].pos:
        s = stops[-1]
        return s.r, s.g, s.b

    for i in range(len(stops) - 1):
        lo, hi = stops[i], stops[i + 1]
        if lo.pos <= pos <= hi.pos:
            span = hi.pos - lo.pos
            if span == 0:
                return lo.r, lo.g, lo.b
            t = (pos - lo.pos) / span
            return (
                round(lo.r + (hi.r - lo.r) * t),
                round(lo.g + (hi.g - lo.g) * t),
                round(lo.b + (hi.b - lo.b) * t),
            )
    s = stops[-1]
    return s.r, s.g, s.b
