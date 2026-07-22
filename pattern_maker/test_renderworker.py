"""Tests for the fakeblaze render worker (node child + Python facade).

Integration tier: exercises a real node child process running the real
emulator modules against the real egg map. Skips entirely when node, the
emulator checkout, or the map is missing (same convention as test_perf.py).
"""

import shutil
import time
from pathlib import Path

import pytest

from fakeblaze.renderworker import RenderWorker, _fallback_pixel_count

EMU = Path.home() / "code/pb/pixelblaze-pattern-emulator"
MAP = Path("maps/egg_mapping/led_map_3d.csv")
HAVE_NODE = shutil.which("node") is not None
HAVE_EMU = (EMU / "src/vm/index.js").exists()
HAVE_MAP = MAP.exists()

pytestmark = pytest.mark.skipif(
    not (HAVE_NODE and HAVE_EMU and HAVE_MAP),
    reason="needs node, the emulator checkout, and the egg map",
)


def pattern_source(name):
    return Path("patterns/egg") / name


def wait_until(predicate, timeout=15.0, interval=0.1):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return True
        time.sleep(interval)
    return False


@pytest.fixture
def worker():
    w = RenderWorker(MAP).start()
    yield w
    w.stop()


def test_render_frame_real_pattern(worker):
    assert not worker.degraded
    assert worker.pixel_count > 1000
    resp = worker.load_pattern(pattern_source("cosmic_bloom.js").read_text(), "cosmic_bloom")
    assert resp["ok"], resp.get("error")
    assert resp["renderPicked"].startswith("render")
    rgb = worker.frame(16.7)
    assert len(rgb) == worker.pixel_count * 3
    assert any(rgb), "cosmic_bloom should not render all-black"


def test_fallback_pixel_count_matches_emulator(worker):
    # The Python-side CSV counter (used for degraded-mode black frames) must
    # agree with the emulator's parser: pixelCount = max(index)+1, indices
    # are sparse in marimapper scans, so row-counting would be wrong.
    assert _fallback_pixel_count(MAP) == worker.pixel_count


def test_vars_round_trip(worker):
    # gyroid.js has `export var currentIndex = 0`
    resp = worker.load_pattern(pattern_source("gyroid.js").read_text(), "gyroid")
    assert resp["ok"], resp.get("error")
    assert "currentIndex" in resp["vars"]
    assert "currentIndex" in worker.get_vars()
    assert worker.set_vars({"currentIndex": 2})
    assert worker.get_vars()["currentIndex"] == 2


def test_set_controls_changes_output(worker):
    resp = worker.load_pattern(pattern_source("cosmic_bloom.js").read_text(), "cosmic_bloom")
    assert resp["ok"], resp.get("error")
    assert any(c["name"] == "sliderBrightness" for c in resp["controls"])
    worker.frame(16.7)  # settle first-frame caches
    # delta_ms=0 freezes the animation clock so the only difference between
    # the two frames is the control change.
    before = worker.frame(0)
    assert worker.set_controls({"sliderBrightness": 0.0})
    after = worker.frame(0)
    assert len(after) == len(before)
    assert after != before
    assert sum(after) < sum(before), "lowering the brightness slider should dim the frame"


def test_bad_pattern_keeps_worker_alive(worker):
    good = worker.load_pattern(pattern_source("cosmic_bloom.js").read_text(), "cosmic_bloom")
    assert good["ok"]
    baseline = worker.frame(16.7)
    assert any(baseline)

    bad = worker.load_pattern("this is not javascript (((", "broken")
    assert bad["ok"] is False
    assert bad["error"]

    # The child must survive and the previous pattern must keep rendering.
    assert worker.ping()
    rgb = worker.frame(16.7)
    assert len(rgb) == worker.pixel_count * 3
    assert any(rgb)


def test_crash_recovery(worker):
    resp = worker.load_pattern(pattern_source("cosmic_bloom.js").read_text(), "cosmic_bloom")
    assert resp["ok"]
    assert any(worker.frame(16.7))

    worker._proc.kill()

    # The very next frame must not raise and must be the right length
    # (served from cache while the worker restarts in the background).
    rgb = worker.frame(16.7)
    assert len(rgb) == worker.pixel_count * 3

    assert wait_until(worker.ping), "worker did not come back after a crash"
    assert not worker.degraded
    # The last-good pattern was replayed automatically: fresh frames render.
    rgb = worker.frame(16.7)
    assert len(rgb) == worker.pixel_count * 3
    assert any(rgb)


def test_degraded_mode_when_node_missing():
    w = RenderWorker(MAP, node="definitely-not-node").start()
    try:
        assert w.degraded
        assert w.last_error
        rgb = w.frame(16.7)
        assert len(rgb) == 1449 * 3
        assert not any(rgb), "degraded mode serves black frames"
        assert w.load_pattern("export function render(i) { hsv(0,0,1) }", "x")["ok"] is False
        assert w.get_vars() == {}
        assert w.ping() is False
    finally:
        w.stop()


def test_degraded_mode_when_emulator_missing(tmp_path):
    w = RenderWorker(MAP, emulator_root=tmp_path / "nope").start()
    try:
        assert w.degraded
        assert "emulator" in w.last_error.lower()
        assert len(w.frame(16.7)) == 1449 * 3
    finally:
        w.stop()
