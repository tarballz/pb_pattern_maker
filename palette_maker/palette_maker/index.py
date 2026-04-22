"""Build and load the cpt-city palette index."""

from __future__ import annotations

import json
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterable, Iterator

from palette_maker.format import describe_stops
from palette_maker.parse import Stop, sniff_and_parse


CANONICAL_URL_BASE = "https://phillips.shef.ac.uk/pub/cpt-city"


@dataclass(frozen=True)
class IndexEntry:
    slug: str
    author: str
    collection: str
    url: str
    color_names: list[str]
    stops: list[tuple[int, int, int, int]]


def _stops_to_tuples(stops: list[Stop]) -> list[tuple[int, int, int, int]]:
    return [(s.pos, s.r, s.g, s.b) for s in stops]


def build_index(source_dir: Path, limit: int | None = None) -> Iterator[IndexEntry]:
    """Walk a level-2 cpt-city tree and yield one IndexEntry per .css palette.

    Expects `<source_dir>/<author>/<collection>/<slug>.css` layout (the shape
    `make level-2` produces in a jjgreen/cpt-city clone).
    """
    source_dir = Path(source_dir)
    count = 0
    paths = sorted(
        p for p in source_dir.rglob("*") if p.suffix in (".c3g", ".css")
    )
    for css_path in paths:
        rel = css_path.relative_to(source_dir)
        parts = rel.parts
        if len(parts) < 3:
            continue
        author = parts[-3]
        collection = parts[-2]
        slug = css_path.stem

        body = css_path.read_text(encoding="utf-8", errors="replace")
        try:
            stops = sniff_and_parse(body)
        except ValueError:
            continue

        names = describe_stops(stops).split("-")
        url = f"{CANONICAL_URL_BASE}/{author}/{collection}/{slug}"
        yield IndexEntry(
            slug=slug,
            author=author,
            collection=collection,
            url=url,
            color_names=names,
            stops=_stops_to_tuples(stops),
        )
        count += 1
        if limit is not None and count >= limit:
            return


def _entry_to_json(entry: IndexEntry) -> str:
    return json.dumps(asdict(entry), separators=(",", ":"), ensure_ascii=False)


def write_jsonl(entries: Iterable[IndexEntry], path: Path) -> int:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    n = 0
    with path.open("w", encoding="utf-8") as f:
        for entry in entries:
            f.write(_entry_to_json(entry))
            f.write("\n")
            n += 1
    return n


def load_index(path: Path) -> list[IndexEntry]:
    path = Path(path)
    out: list[IndexEntry] = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            data = json.loads(line)
            out.append(
                IndexEntry(
                    slug=data["slug"],
                    author=data["author"],
                    collection=data["collection"],
                    url=data["url"],
                    color_names=list(data["color_names"]),
                    stops=[tuple(s) for s in data["stops"]],
                )
            )
    return out
