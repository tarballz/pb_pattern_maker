import pytest

from palette_maker.urls import classify_url, slug_from_collection_url, sanitize_slug


class TestClassifyUrl:
    def test_collection_url(self):
        u = "https://phillips.shef.ac.uk/pub/cpt-city/bhw/bhw1/bhw1_05"
        assert classify_url(u) == ("collection", u)

    def test_collection_url_trailing_slash(self):
        u = "https://phillips.shef.ac.uk/pub/cpt-city/bhw/bhw1/bhw1_05/"
        assert classify_url(u) == (
            "collection",
            "https://phillips.shef.ac.uk/pub/cpt-city/bhw/bhw1/bhw1_05",
        )

    def test_legacy_png_index_html_suffix(self):
        u = "http://soliton.vm.bytemark.co.uk/pub/cpt-city/bhw/bhw1/tn/bhw1_05.png.index.html"
        kind, normalized = classify_url(u)
        assert kind == "collection"
        assert normalized == "https://phillips.shef.ac.uk/pub/cpt-city/bhw/bhw1/bhw1_05"

    def test_scheme_url(self):
        u = "https://phillips.shef.ac.uk/pub/cpt-city/resource/schemes/402975"
        assert classify_url(u) == ("scheme", u)

    def test_scheme_url_with_extension(self):
        u = "https://phillips.shef.ac.uk/pub/cpt-city/resource/schemes/402975.gp"
        kind, normalized = classify_url(u)
        assert kind == "scheme"
        assert normalized == "https://phillips.shef.ac.uk/pub/cpt-city/resource/schemes/402975"

    def test_http_upgraded_to_https(self):
        u = "http://phillips.shef.ac.uk/pub/cpt-city/bhw/bhw1/bhw1_05"
        kind, normalized = classify_url(u)
        assert kind == "collection"
        assert normalized.startswith("https://")

    def test_unknown_url_raises(self):
        with pytest.raises(ValueError, match="not a cpt-city URL"):
            classify_url("https://example.com/foo/bar")


class TestSlugFromCollectionUrl:
    def test_simple(self):
        u = "https://phillips.shef.ac.uk/pub/cpt-city/bhw/bhw1/bhw1_05"
        assert slug_from_collection_url(u) == "bhw1_05"

    def test_nested(self):
        u = "https://phillips.shef.ac.uk/pub/cpt-city/nd/atmospheric/Sunset_Real"
        assert slug_from_collection_url(u) == "Sunset_Real"


class TestSanitizeSlug:
    def test_already_valid(self):
        assert sanitize_slug("bhw1_05") == "bhw1_05"

    def test_leading_digit(self):
        assert sanitize_slug("123abc") == "_123abc"

    def test_dashes_become_underscores(self):
        assert sanitize_slug("black-blue-white") == "black_blue_white"

    def test_special_chars_dropped(self):
        assert sanitize_slug("foo.bar+baz") == "foo_bar_baz"
