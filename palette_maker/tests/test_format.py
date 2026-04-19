from palette_maker.format import describe_stops, format_block
from palette_maker.parse import Stop


class TestDescribeStops:
    def test_two_stop_teal_purple(self):
        stops = [Stop(0, 5, 239, 137), Stop(255, 158, 35, 221)]
        assert describe_stops(stops) == "teal-purple"

    def test_consecutive_duplicates_deduped(self):
        stops = [
            Stop(0, 255, 0, 0),
            Stop(64, 255, 5, 5),
            Stop(128, 0, 255, 0),
            Stop(255, 0, 0, 255),
        ]
        assert describe_stops(stops) == "red-lime-blue"

    def test_single_stop(self):
        assert describe_stops([Stop(0, 128, 128, 128)]) == "gray"


class TestFormatBlock:
    def test_two_stop_matches_hc_pat_style(self):
        stops = [Stop(0, 5, 239, 137), Stop(255, 158, 35, 221)]
        url = "https://phillips.shef.ac.uk/pub/cpt-city/bhw/bhw1/bhw1_05"
        slug = "bhw1_05"
        expected = (
            "//https://phillips.shef.ac.uk/pub/cpt-city/bhw/bhw1/bhw1_05\n"
            "//teal-purple\n"
            "var bhw1_05_gp = [\n"
            "    0,   5,239,137,\n"
            "  255, 158, 35,221]\n"
            "\n"
            "arrayMutate(bhw1_05_gp,(v, i ,a) => v / 255);\n"
        )
        assert format_block(stops, url, slug) == expected

    def test_multi_stop_column_alignment(self):
        # sunset_real: 7 stops, various magnitudes for pos/R/G/B
        stops = [
            Stop(0, 191, 0, 0),
            Stop(23, 223, 85, 0),
            Stop(52, 255, 170, 0),
            Stop(85, 217, 85, 89),
            Stop(136, 178, 0, 178),
            Stop(198, 89, 0, 195),
            Stop(255, 0, 0, 212),
        ]
        block = format_block(
            stops,
            "https://phillips.shef.ac.uk/pub/cpt-city/nd/atmospheric/sunset_real",
            "sunset_real",
        )
        # Spot-check alignment: every data line has the same character width
        # up to the comma after the pos field (column 6).
        lines = [l for l in block.splitlines() if l.startswith((" ", "  "))]
        assert all(len(l) >= 6 for l in lines)
        # The 3rd stop is (52, 255, 170, 0)
        assert "   52, 255,170,  0," in block
        # Last stop uses "]" instead of trailing comma
        assert "255,   0,  0,212]" in block

    def test_slug_sanitization_applied(self):
        stops = [Stop(0, 0, 0, 0), Stop(255, 255, 255, 255)]
        block = format_block(stops, "https://example/x", "black-white")
        assert "var black_white_gp = [" in block
        assert "arrayMutate(black_white_gp," in block
