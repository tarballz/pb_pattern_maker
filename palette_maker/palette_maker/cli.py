"""Command-line entry point for palette_maker."""

from __future__ import annotations

import argparse
import sys

from palette_maker.fetch import fetch_palette_body
from palette_maker.format import format_block
from palette_maker.parse import sniff_and_parse
from palette_maker.preview import render_swatch
from palette_maker.urls import classify_url, slug_from_collection_url


def _cmd_url(args: argparse.Namespace) -> int:
    kind, normalized = classify_url(args.url)
    body = fetch_palette_body(normalized)
    stops = sniff_and_parse(body)

    if kind == "collection":
        slug = slug_from_collection_url(normalized)
    else:
        slug = args.slug or f"scheme_{normalized.rsplit('/', 1)[-1]}"

    block = format_block(stops, normalized, slug)
    sys.stdout.write(block)

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
    url_cmd.set_defaults(func=_cmd_url)

    return parser


def run(argv: list[str]) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if not getattr(args, "command", None):
        parser.print_help(sys.stderr)
        return 2
    return args.func(args)


def main() -> None:
    sys.exit(run(sys.argv[1:]))


if __name__ == "__main__":
    main()
