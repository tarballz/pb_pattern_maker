import httpx
import pytest
import respx

from palette_maker.fetch import fetch_palette_body


COLLECTION_HTML = """<html><body>
  <a title="CSS3 gradient, 343 Bytes" data-turbo="false" href="/pub/cpt-city/resource/schemes/402974">c3g</a>
  <a title="GMT colour palette table, 283 Bytes" data-turbo="false" href="/pub/cpt-city/resource/schemes/402975">cpt</a>
  <a title="SVG gradient, 1011 Bytes" data-turbo="false" href="/pub/cpt-city/resource/schemes/402984">svg</a>
</body></html>
"""

CSS_BODY = """/*
  cpt-city: bhw/bhw1/bhw1_05
*/
linear-gradient(
  0deg,
  rgb(  5, 239, 137)   0.000%,
  rgb(158,  35, 221) 100.000%
);
"""


@respx.mock
def test_collection_url_follows_c3g_link():
    collection = "https://phillips.shef.ac.uk/pub/cpt-city/bhw/bhw1/bhw1_05"
    scheme = "https://phillips.shef.ac.uk/pub/cpt-city/resource/schemes/402974"
    respx.get(collection).mock(return_value=httpx.Response(200, text=COLLECTION_HTML))
    respx.get(scheme).mock(return_value=httpx.Response(200, text=CSS_BODY))

    body = fetch_palette_body(collection)

    assert "linear-gradient" in body


@respx.mock
def test_scheme_url_fetched_directly():
    scheme = "https://phillips.shef.ac.uk/pub/cpt-city/resource/schemes/402974"
    respx.get(scheme).mock(return_value=httpx.Response(200, text=CSS_BODY))

    body = fetch_palette_body(scheme)

    assert "linear-gradient" in body


@respx.mock
def test_missing_c3g_link_raises():
    collection = "https://phillips.shef.ac.uk/pub/cpt-city/bhw/bhw1/bhw1_05"
    no_c3g = '<html><body><a href="/elsewhere">svg</a></body></html>'
    respx.get(collection).mock(return_value=httpx.Response(200, text=no_c3g))

    with pytest.raises(ValueError, match="no CSS3 gradient link"):
        fetch_palette_body(collection)


@respx.mock
def test_http_error_raises():
    collection = "https://phillips.shef.ac.uk/pub/cpt-city/bhw/bhw1/bhw1_05"
    respx.get(collection).mock(return_value=httpx.Response(500))

    with pytest.raises(httpx.HTTPStatusError):
        fetch_palette_body(collection)
