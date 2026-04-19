"""Fetch palette bodies from cpt-city, handling both URL shapes."""

from __future__ import annotations

import re

import httpx

from palette_maker.urls import classify_url

USER_AGENT = "palette_maker/0.1 (+https://github.com/pschwarz/pb)"
TIMEOUT = 15.0

_C3G_LINK_RE = re.compile(
    r'href="(?P<href>/pub/cpt-city/resource/schemes/\d+)"[^>]*>\s*c3g\s*<'
)


def fetch_palette_body(url: str) -> str:
    """Fetch palette text for any cpt-city URL (collection or scheme).

    Collection URLs are HTML pages listing 11 export-format scheme links; we
    follow the `c3g` (CSS3 gradient) link and return its body. Scheme URLs are
    fetched directly.
    """
    kind, normalized = classify_url(url)
    with httpx.Client(
        timeout=TIMEOUT,
        headers={"User-Agent": USER_AGENT},
        follow_redirects=True,
    ) as client:
        if kind == "collection":
            return _fetch_via_collection(client, normalized)
        return _get_text(client, normalized)


def _fetch_via_collection(client: httpx.Client, collection_url: str) -> str:
    html = _get_text(client, collection_url)
    match = _C3G_LINK_RE.search(html)
    if not match:
        raise ValueError(f"no CSS3 gradient link found on {collection_url}")
    scheme_path = match.group("href")
    scheme_url = f"https://phillips.shef.ac.uk{scheme_path}"
    return _get_text(client, scheme_url)


def _get_text(client: httpx.Client, url: str) -> str:
    response = client.get(url)
    response.raise_for_status()
    return response.text
