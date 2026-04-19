from pathlib import Path

import pytest

from palette_maker.parse import Stop, parse_css_gradient, sniff_and_parse


FIXTURES = Path(__file__).parent / "fixtures"


def _read(name: str) -> str:
    return (FIXTURES / name).read_text()


class TestParseCssGradient:
    def test_two_stop_bhw1_05(self):
        stops = parse_css_gradient(_read("bhw1_05.css"))
        assert stops == [
            Stop(0, 5, 239, 137),
            Stop(255, 158, 35, 221),
        ]

    def test_fractional_positions_round_to_nearest_0_255(self):
        stops = parse_css_gradient(_read("bhw2_whooo.css"))
        # 14 stops, 0.000% → 0, 2.002% → round(2.002 * 2.55) = 5, ..., 100.000% → 255
        assert len(stops) == 14
        assert stops[0] == Stop(0, 66, 187, 172)
        assert stops[1] == Stop(5, 66, 187, 172)  # 2.002%
        assert stops[-1] == Stop(255, 160, 210, 159)

    def test_sunset_real(self):
        stops = parse_css_gradient(_read("sunset_real.css"))
        assert stops[0] == Stop(0, 191, 0, 0)
        # 8.848% * 2.55 = 22.56 → 23
        assert stops[1] == Stop(23, 223, 85, 0)
        assert stops[-1] == Stop(255, 0, 0, 212)

    def test_missing_linear_gradient_raises(self):
        with pytest.raises(ValueError, match="no linear-gradient"):
            parse_css_gradient("not a gradient\njust some text\n")

    def test_ignores_comments_and_blank_lines(self):
        # Comments were already covered by all fixtures; this is an edge case
        # with no comment at all.
        body = "linear-gradient(\n  0deg,\n  rgb(1,2,3) 0.000%,\n  rgb(4,5,6) 100.000%\n);\n"
        stops = parse_css_gradient(body)
        assert stops == [Stop(0, 1, 2, 3), Stop(255, 4, 5, 6)]


class TestSniffAndParse:
    def test_dispatches_to_css(self):
        stops = sniff_and_parse(_read("bhw1_05.css"))
        assert stops[0] == Stop(0, 5, 239, 137)

    def test_unknown_format_raises(self):
        with pytest.raises(ValueError, match="unrecognized"):
            sniff_and_parse("GIMP Gradient\nName: foo\n")
