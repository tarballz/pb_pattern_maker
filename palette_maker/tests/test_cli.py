import json
from pathlib import Path

import httpx
import pytest
import respx

from palette_maker.cli import run
from palette_maker.index import IndexEntry, write_jsonl


FIXTURE_CORPUS = Path(__file__).parent / "fixtures" / "mini_corpus"


CSS_BODY = """/*
  cpt-city: bhw/bhw1/bhw1_05
*/
linear-gradient(
  0deg,
  rgb(  5, 239, 137)   0.000%,
  rgb(158,  35, 221) 100.000%
);
"""

COLLECTION_HTML = """<html><body>
  <a title="CSS3 gradient" data-turbo="false" href="/pub/cpt-city/resource/schemes/402974">c3g</a>
</body></html>
"""


@respx.mock
def test_url_subcommand_end_to_end(capsys):
    collection = "https://phillips.shef.ac.uk/pub/cpt-city/bhw/bhw1/bhw1_05"
    scheme = "https://phillips.shef.ac.uk/pub/cpt-city/resource/schemes/402974"
    respx.get(collection).mock(return_value=httpx.Response(200, text=COLLECTION_HTML))
    respx.get(scheme).mock(return_value=httpx.Response(200, text=CSS_BODY))

    exit_code = run(["url", collection])

    assert exit_code == 0
    captured = capsys.readouterr()
    assert "var bhw1_05_gp = [" in captured.out
    assert "arrayMutate(bhw1_05_gp,(v, i ,a) => v / 255);" in captured.out
    assert f"//{collection}" in captured.out
    # Swatch goes to stderr so `> file.js` captures only the block.
    assert "\x1b[48;2;" in captured.err


@respx.mock
def test_no_preview_flag_suppresses_swatch(capsys):
    collection = "https://phillips.shef.ac.uk/pub/cpt-city/bhw/bhw1/bhw1_05"
    scheme = "https://phillips.shef.ac.uk/pub/cpt-city/resource/schemes/402974"
    respx.get(collection).mock(return_value=httpx.Response(200, text=COLLECTION_HTML))
    respx.get(scheme).mock(return_value=httpx.Response(200, text=CSS_BODY))

    exit_code = run(["url", "--no-preview", collection])

    assert exit_code == 0
    captured = capsys.readouterr()
    assert "\x1b[48;2;" not in captured.err


def test_missing_subcommand_prints_help(capsys):
    exit_code = run([])

    assert exit_code != 0
    err = capsys.readouterr().err
    assert "usage" in err.lower()


class TestIndexBuild:
    def test_writes_jsonl_to_output_path(self, tmp_path, capsys):
        out = tmp_path / "index.jsonl"
        exit_code = run(
            ["index", "build", "--source", str(FIXTURE_CORPUS), "--output", str(out)]
        )
        assert exit_code == 0
        lines = out.read_text().splitlines()
        assert len(lines) == 3
        slugs = {json.loads(line)["slug"] for line in lines}
        assert slugs == {"bhw1_05", "bhw2_whooo", "Sunset_Real"}

    def test_respects_limit_flag(self, tmp_path):
        out = tmp_path / "index.jsonl"
        exit_code = run(
            [
                "index",
                "build",
                "--source",
                str(FIXTURE_CORPUS),
                "--output",
                str(out),
                "--limit",
                "2",
            ]
        )
        assert exit_code == 0
        assert len(out.read_text().splitlines()) == 2

    def test_prints_count_to_stderr(self, tmp_path, capsys):
        out = tmp_path / "index.jsonl"
        run(["index", "build", "--source", str(FIXTURE_CORPUS), "--output", str(out)])
        err = capsys.readouterr().err
        assert "3" in err


@pytest.fixture
def mini_index(tmp_path):
    out = tmp_path / "index.jsonl"
    run(["index", "build", "--source", str(FIXTURE_CORPUS), "--output", str(out)])
    return out


class TestShow:
    def test_happy_path_prints_block(self, mini_index, capsys):
        exit_code = run(["show", "bhw1_05", "--index", str(mini_index)])

        assert exit_code == 0
        captured = capsys.readouterr()
        assert "var bhw1_05_gp = [" in captured.out
        assert "arrayMutate(bhw1_05_gp,(v, i ,a) => v / 255);" in captured.out
        assert "//https://phillips.shef.ac.uk/pub/cpt-city/bhw/bhw1/bhw1_05" in captured.out
        # swatch to stderr by default
        assert "\x1b[48;2;" in captured.err

    def test_no_preview_suppresses_swatch(self, mini_index, capsys):
        exit_code = run(
            ["show", "bhw1_05", "--index", str(mini_index), "--no-preview"]
        )

        assert exit_code == 0
        captured = capsys.readouterr()
        assert "\x1b[48;2;" not in captured.err

    def test_slug_override_renames_js_variable(self, mini_index, capsys):
        exit_code = run(
            [
                "show",
                "bhw1_05",
                "--index",
                str(mini_index),
                "--slug",
                "my_palette",
                "--no-preview",
            ]
        )

        assert exit_code == 0
        out = capsys.readouterr().out
        assert "var my_palette_gp = [" in out
        assert "arrayMutate(my_palette_gp," in out
        assert "bhw1_05_gp" not in out

    def test_nonexistent_slug_errors(self, mini_index, capsys):
        exit_code = run(
            ["show", "not_a_real_slug", "--index", str(mini_index), "--no-preview"]
        )

        assert exit_code != 0
        err = capsys.readouterr().err
        assert "not_a_real_slug" in err

    def test_ambiguous_slug_lists_candidates(self, tmp_path, capsys):
        index_path = tmp_path / "dupes.jsonl"
        entries = [
            IndexEntry(
                slug="shared",
                author="alice",
                collection="coll_a",
                url="https://phillips.shef.ac.uk/pub/cpt-city/alice/coll_a/shared",
                color_names=["red", "blue"],
                stops=[(0, 255, 0, 0), (255, 0, 0, 255)],
            ),
            IndexEntry(
                slug="shared",
                author="bob",
                collection="coll_b",
                url="https://phillips.shef.ac.uk/pub/cpt-city/bob/coll_b/shared",
                color_names=["green", "yellow"],
                stops=[(0, 0, 255, 0), (255, 255, 255, 0)],
            ),
        ]
        write_jsonl(entries, index_path)

        exit_code = run(["show", "shared", "--index", str(index_path), "--no-preview"])

        assert exit_code != 0
        err = capsys.readouterr().err
        assert "alice/coll_a/shared" in err
        assert "bob/coll_b/shared" in err

    def test_author_disambiguates_shared_slug(self, tmp_path, capsys):
        index_path = tmp_path / "dupes.jsonl"
        entries = [
            IndexEntry(
                slug="shared",
                author="alice",
                collection="coll_a",
                url="https://phillips.shef.ac.uk/pub/cpt-city/alice/coll_a/shared",
                color_names=["red", "blue"],
                stops=[(0, 255, 0, 0), (255, 0, 0, 255)],
            ),
            IndexEntry(
                slug="shared",
                author="bob",
                collection="coll_b",
                url="https://phillips.shef.ac.uk/pub/cpt-city/bob/coll_b/shared",
                color_names=["green", "yellow"],
                stops=[(0, 0, 255, 0), (255, 255, 255, 0)],
            ),
        ]
        write_jsonl(entries, index_path)

        exit_code = run(
            [
                "show",
                "shared",
                "--index",
                str(index_path),
                "--author",
                "bob",
                "--no-preview",
            ]
        )

        assert exit_code == 0
        out = capsys.readouterr().out
        assert "//https://phillips.shef.ac.uk/pub/cpt-city/bob/coll_b/shared" in out
