"""URL parsing and normalization for cpt-city palette URLs."""

from __future__ import annotations

import re
from urllib.parse import urlparse, urlunparse

CANONICAL_HOST = "phillips.shef.ac.uk"
CPT_CITY_PREFIX = "/pub/cpt-city/"
SCHEME_PREFIX = "/pub/cpt-city/resource/schemes/"


def classify_url(url: str) -> tuple[str, str]:
    """Classify a cpt-city URL and return (kind, normalized_url).

    kind is "collection" for palette-collection pages or "scheme" for direct
    format-export endpoints. Raises ValueError for non-cpt-city URLs.
    """
    parsed = urlparse(url.strip())
    if not parsed.scheme or not parsed.netloc:
        raise ValueError(f"not a cpt-city URL: {url!r}")

    path = parsed.path
    if CPT_CITY_PREFIX not in path:
        raise ValueError(f"not a cpt-city URL: {url!r}")

    # Trim to /pub/cpt-city/... on the canonical host
    idx = path.index(CPT_CITY_PREFIX)
    path = path[idx:]

    if path.startswith(SCHEME_PREFIX):
        rest = path[len(SCHEME_PREFIX):].rstrip("/")
        scheme_id = rest.split(".", 1)[0]
        if not scheme_id.isdigit():
            raise ValueError(f"scheme URL missing numeric id: {url!r}")
        new_path = f"{SCHEME_PREFIX}{scheme_id}"
        return "scheme", _rebuild(new_path)

    # collection URL: strip trailing slash, legacy /tn/ segment, .png.index.html
    collection_path = path.rstrip("/")
    collection_path = re.sub(r"\.png\.index\.html?$", "", collection_path)
    # legacy mirrors used a "/tn/" thumbnail directory in the path
    collection_path = collection_path.replace("/tn/", "/")
    return "collection", _rebuild(collection_path)


def _rebuild(path: str) -> str:
    return urlunparse(("https", CANONICAL_HOST, path, "", "", ""))


def slug_from_collection_url(url: str) -> str:
    """Return the last path segment of a collection URL (e.g. 'bhw1_05')."""
    parsed = urlparse(url)
    return parsed.path.rstrip("/").rsplit("/", 1)[-1]


_JS_ID_RE = re.compile(r"[^A-Za-z0-9_]")


def sanitize_slug(slug: str) -> str:
    """Sanitize to a valid JS identifier: alnum + underscore, no leading digit."""
    cleaned = _JS_ID_RE.sub("_", slug)
    if cleaned and cleaned[0].isdigit():
        cleaned = "_" + cleaned
    return cleaned
