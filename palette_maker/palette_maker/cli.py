"""Command-line entry point for palette_maker."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from palette_maker.fetch import fetch_palette_body
from palette_maker.format import format_block
from palette_maker.index import IndexEntry, build_index, load_index, write_jsonl
from palette_maker.insert import InsertError, insert_block
from palette_maker.parse import Stop, sniff_and_parse
from palette_maker.preview import render_html, render_swatch
from palette_maker.urls import classify_url, slug_from_collection_url


def _emit(stops: list[Stop], block: str, args: argparse.Namespace) -> None:
    sys.stdout.write(block)
    if not args.no_preview:
        sys.stderr.write(render_swatch(stops) + "\n")
    if getattr(args, "html", None):
        Path(args.html).write_text(render_html(stops, title=args.html))
        sys.stderr.write(f"HTML swatch written to {args.html}\n")


def _cmd_url(args: argparse.Namespace) -> int:
    kind, normalized = classify_url(args.url)
    body = fetch_palette_body(normalized)
    stops = sniff_and_parse(body)

    if kind == "collection":
        slug = slug_from_collection_url(normalized)
    else:
        slug = args.slug or f"scheme_{normalized.rsplit('/', 1)[-1]}"

    block = format_block(stops, normalized, slug)
    _emit(stops, block, args)
    return 0


DEFAULT_INDEX_PATH = Path(__file__).resolve().parent.parent / "data" / "cpt_city_index.jsonl"


def _cmd_index_build(args: argparse.Namespace) -> int:
    entries = build_index(Path(args.source), limit=args.limit)
    count = write_jsonl(entries, Path(args.output))
    sys.stderr.write(f"wrote {count} entries to {args.output}\n")
    return 0


def _entry_path(entry: IndexEntry) -> str:
    return f"{entry.author}/{entry.collection}/{entry.slug}"


def _resolve_entry(args: argparse.Namespace) -> IndexEntry | None:
    """Look up a unique index entry for args.slug_query, or report why not."""
    index_path = Path(args.index) if args.index else DEFAULT_INDEX_PATH
    entries = load_index(index_path)

    matches = [e for e in entries if e.slug == args.slug_query]
    if args.author:
        matches = [e for e in matches if e.author == args.author]
    if args.collection:
        matches = [e for e in matches if e.collection == args.collection]

    if not matches:
        sys.stderr.write(f"no palette found for slug {args.slug_query!r}\n")
        return None
    if len(matches) > 1:
        sys.stderr.write(f"slug {args.slug_query!r} is ambiguous; candidates:\n")
        for entry in matches:
            sys.stderr.write(f"  {_entry_path(entry)}\n")
        sys.stderr.write("narrow with --author and/or --collection.\n")
        return None
    return matches[0]


def _entry_block(entry: IndexEntry, slug_override: str | None) -> tuple[list[Stop], str]:
    stops = [Stop(pos=p, r=r, g=g, b=b) for p, r, g, b in entry.stops]
    slug = slug_override or entry.slug
    return stops, format_block(stops, entry.url, slug)


def _cmd_show(args: argparse.Namespace) -> int:
    entry = _resolve_entry(args)
    if entry is None:
        return 1
    stops, block = _entry_block(entry, args.slug)
    _emit(stops, block, args)
    return 0


def _cmd_insert(args: argparse.Namespace) -> int:
    entry = _resolve_entry(args)
    if entry is None:
        return 1
    stops, block = _entry_block(entry, args.slug)

    pattern_path = Path(args.pattern)
    try:
        source = pattern_path.read_text()
    except OSError as e:
        sys.stderr.write(f"cannot read pattern file: {e}\n")
        return 1

    try:
        updated = insert_block(source, block)
    except InsertError as e:
        sys.stderr.write(f"{pattern_path}: {e}\n")
        return 1

    pattern_path.write_text(updated)
    sys.stderr.write(f"inserted {entry.slug} into {pattern_path} and registered it in `palettes`\n")
    if not args.no_preview:
        sys.stderr.write(render_swatch(stops) + "\n")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="palette_maker",
        description="Fetch cpt-city palettes and format them for PixelBlaze patterns.",
    )
    sub = parser.add_subparsers(dest="command")

    url_cmd = sub.add_parser(
        "url",
        help="Fetch a cpt-city palette URL and print a PixelBlaze-ready block.",
    )
    url_cmd.add_argument("url", help="cpt-city collection page URL or scheme resource URL.")
    url_cmd.add_argument(
        "--slug",
        help="Override the JS variable slug (defaults to the URL's last path segment).",
    )
    url_cmd.add_argument(
        "--no-preview",
        action="store_true",
        help="Suppress the ANSI color swatch normally printed to stderr.",
    )
    url_cmd.add_argument(
        "--html",
        help="Also write a standalone HTML gradient swatch to this path.",
    )
    url_cmd.set_defaults(func=_cmd_url)

    index_cmd = sub.add_parser(
        "index",
        help="Manage the local cpt-city palette index.",
    )
    index_sub = index_cmd.add_subparsers(dest="index_action")
    build_cmd = index_sub.add_parser(
        "build",
        help="Build the palette index from a level-2 cpt-city clone.",
    )
    build_cmd.add_argument(
        "--source",
        required=True,
        help="Path to a jjgreen/cpt-city clone with `make level-2` already run.",
    )
    build_cmd.add_argument(
        "--output",
        default=str(DEFAULT_INDEX_PATH),
        help="Where to write the JSONL index (default: data/cpt_city_index.jsonl).",
    )
    build_cmd.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Cap the number of entries (useful for testing).",
    )
    build_cmd.set_defaults(func=_cmd_index_build)

    show_cmd = sub.add_parser(
        "show",
        help="Print the PixelBlaze block for an indexed palette by slug.",
    )
    show_cmd.add_argument(
        "slug_query",
        metavar="slug",
        help="Palette slug as stored in the index (e.g. bhw1_05).",
    )
    show_cmd.add_argument(
        "--slug",
        help="Override the JS variable slug (defaults to the indexed slug).",
    )
    show_cmd.add_argument(
        "--author",
        help="Disambiguate when multiple palettes share a slug.",
    )
    show_cmd.add_argument(
        "--collection",
        help="Disambiguate when multiple palettes share a slug.",
    )
    show_cmd.add_argument(
        "--index",
        help=f"Path to the palette index JSONL (default: {DEFAULT_INDEX_PATH}).",
    )
    show_cmd.add_argument(
        "--no-preview",
        action="store_true",
        help="Suppress the ANSI color swatch normally printed to stderr.",
    )
    show_cmd.add_argument(
        "--html",
        help="Also write a standalone HTML gradient swatch to this path.",
    )
    show_cmd.set_defaults(func=_cmd_show)

    insert_cmd = sub.add_parser(
        "insert",
        help="Insert an indexed palette into a pattern file's `palettes` array.",
    )
    insert_cmd.add_argument(
        "slug_query",
        metavar="slug",
        help="Palette slug as stored in the index (e.g. bhw1_05).",
    )
    insert_cmd.add_argument(
        "pattern",
        help="Path to the PixelBlaze pattern file (must contain `var palettes = [...]`).",
    )
    insert_cmd.add_argument(
        "--slug",
        help="Override the JS variable slug (defaults to the indexed slug).",
    )
    insert_cmd.add_argument(
        "--author",
        help="Disambiguate when multiple palettes share a slug.",
    )
    insert_cmd.add_argument(
        "--collection",
        help="Disambiguate when multiple palettes share a slug.",
    )
    insert_cmd.add_argument(
        "--index",
        help=f"Path to the palette index JSONL (default: {DEFAULT_INDEX_PATH}).",
    )
    insert_cmd.add_argument(
        "--no-preview",
        action="store_true",
        help="Suppress the ANSI color swatch normally printed to stderr.",
    )
    insert_cmd.set_defaults(func=_cmd_insert)

    return parser


def run(argv: list[str]) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if not getattr(args, "command", None) or not getattr(args, "func", None):
        parser.print_help(sys.stderr)
        return 2
    return args.func(args)


def main() -> None:
    sys.exit(run(sys.argv[1:]))


if __name__ == "__main__":
    main()
