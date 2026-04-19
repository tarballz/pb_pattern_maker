from palette_maker.parse import Stop
from palette_maker.preview import render_swatch


def _bg(r: int, g: int, b: int) -> str:
    return f"\x1b[48;2;{r};{g};{b}m \x1b[0m"


class TestRenderSwatch:
    def test_single_stop_fills_bar(self):
        bar = render_swatch([Stop(0, 10, 20, 30)], width=3)
        assert bar == _bg(10, 20, 30) * 3

    def test_two_stop_interpolates_linearly(self):
        stops = [Stop(0, 0, 0, 0), Stop(255, 255, 0, 0)]
        bar = render_swatch(stops, width=3)
        # Expected cells at pos 0, 128 (127.5 → 128 via banker's rounding), 255.
        assert bar == _bg(0, 0, 0) + _bg(128, 0, 0) + _bg(255, 0, 0)

    def test_uses_stop_position_not_order(self):
        stops = [Stop(0, 0, 0, 0), Stop(64, 255, 0, 0), Stop(255, 255, 0, 0)]
        bar = render_swatch(stops, width=2)
        # cells at pos 0 and 255: (0,0,0), (255,0,0)
        assert bar == _bg(0, 0, 0) + _bg(255, 0, 0)
