import httpx
import respx

from palette_maker.cli import run


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
