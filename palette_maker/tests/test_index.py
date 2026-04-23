from pathlib import Path

from palette_maker.index import IndexEntry, build_index, load_index, write_jsonl


FIXTURE_ROOT = Path(__file__).parent / "fixtures" / "mini_corpus"


def _by_slug(entries: list[IndexEntry]) -> dict[str, IndexEntry]:
    return {e.slug: e for e in entries}


class TestBuildIndex:
    def test_walks_corpus_and_yields_all_palettes(self):
        entries = list(build_index(FIXTURE_ROOT))
        assert {e.slug for e in entries} == {"bhw1_05", "bhw2_whooo", "Sunset_Real"}

    def test_derives_author_collection_slug_from_path(self):
        by_slug = _by_slug(list(build_index(FIXTURE_ROOT)))
        e = by_slug["bhw1_05"]
        assert e.author == "bhw"
        assert e.collection == "bhw1"
        assert e.slug == "bhw1_05"

    def test_builds_canonical_phillips_url(self):
        by_slug = _by_slug(list(build_index(FIXTURE_ROOT)))
        assert (
            by_slug["Sunset_Real"].url
            == "https://phillips.shef.ac.uk/pub/cpt-city/nd/atmospheric/Sunset_Real"
        )

    def test_populates_stops_matching_parser(self):
        by_slug = _by_slug(list(build_index(FIXTURE_ROOT)))
        stops = by_slug["bhw1_05"].stops
        # Fixture has two stops: rgb(5,239,137) 0% and rgb(158,35,221) 100%
        assert stops == [(0, 5, 239, 137), (255, 158, 35, 221)]

    def test_populates_color_names_via_describe_stops(self):
        by_slug = _by_slug(list(build_index(FIXTURE_ROOT)))
        # Sunset_Real: red-orange-yellow-pink-purple-navy-blue-ish progression
        names = by_slug["Sunset_Real"].color_names
        assert "red" in names
        assert "purple" in names or "magenta" in names

    def test_limit_caps_output(self):
        entries = list(build_index(FIXTURE_ROOT, limit=2))
        assert len(entries) == 2


class TestJsonlRoundTrip:
    def test_write_then_load_preserves_entries(self, tmp_path):
        entries = list(build_index(FIXTURE_ROOT))
        out = tmp_path / "index.jsonl"
        write_jsonl(entries, out)
        loaded = load_index(out)
        assert loaded == entries

    def test_jsonl_has_one_line_per_entry(self, tmp_path):
        entries = list(build_index(FIXTURE_ROOT))
        out = tmp_path / "index.jsonl"
        write_jsonl(entries, out)
        lines = out.read_text().splitlines()
        assert len(lines) == len(entries)
