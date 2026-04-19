"""Parse cpt-city palette exports into a list of RGB stops."""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class Stop:
    pos: int  # 0-255
    r: int
    g: int
    b: int


_CSS_STOP_RE = re.compile(
    r"rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)\s*([\d.]+)%"
)


def parse_css_gradient(body: str) -> list[Stop]:
    """Parse a cpt-city CSS3 export into stops with positions 0-255."""
    if "linear-gradient" not in body:
        raise ValueError("no linear-gradient block found")

    stops: list[Stop] = []
    for match in _CSS_STOP_RE.finditer(body):
        r, g, b, pct = match.groups()
        pos = round(float(pct) * 2.55)
        stops.append(Stop(pos, int(r), int(g), int(b)))

    if not stops:
        raise ValueError("linear-gradient block contained no stops")
    return stops


def sniff_and_parse(body: str) -> list[Stop]:
    """Dispatch to the appropriate parser based on body content."""
    if "linear-gradient" in body:
        return parse_css_gradient(body)
    raise ValueError("unrecognized palette format")
