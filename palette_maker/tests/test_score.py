"""Tests for the shared discovery-scoring helpers."""

from palette_maker.score import (
    COOL_NAMES,
    NEUTRAL_NAMES,
    WARM_NAMES,
    luminance,
    saturation,
    stop_stats,
    warmth,
)


class TestChannelHelpers:
    def test_luminance_extremes(self):
        assert luminance(0, 0, 0) == 0
        assert luminance(255, 255, 255) == 1

    def test_luminance_green_brighter_than_blue(self):
        assert luminance(0, 255, 0) > luminance(0, 0, 255)

    def test_saturation(self):
        assert saturation(255, 0, 0) == 1
        assert saturation(128, 128, 128) == 0
        assert saturation(0, 0, 0) == 0

    def test_warmth_sign(self):
        assert warmth(255, 0, 0) > 0
        assert warmth(0, 0, 255) < 0
        assert warmth(128, 0, 128) == 0


class TestStopStats:
    def test_dark_base_bright_flash(self):
        stops = [(0, 10, 10, 20), (128, 20, 10, 30), (255, 255, 240, 200)]
        stats = stop_stats(stops)
        assert stats["min_lum"] < 0.1
        assert stats["max_lum"] > 0.9
        assert stats["mean_lum"] < 0.5

    def test_warm_palette(self):
        stops = [(0, 255, 60, 0), (255, 255, 180, 40)]
        assert stop_stats(stops)["mean_warmth"] > 0.5


class TestNameSets:
    def test_sets_are_disjoint(self):
        assert not (WARM_NAMES & COOL_NAMES)
        assert not (WARM_NAMES & NEUTRAL_NAMES)
        assert not (COOL_NAMES & NEUTRAL_NAMES)

    def test_cover_all_format_names(self):
        from palette_maker.format import _NAMED_COLORS

        all_names = {name for name, _ in _NAMED_COLORS}
        assert all_names == WARM_NAMES | COOL_NAMES | NEUTRAL_NAMES
