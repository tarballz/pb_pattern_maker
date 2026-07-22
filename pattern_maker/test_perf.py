import json
import shutil
import subprocess
from pathlib import Path

import pytest

import pb

EMU = Path.home() / "code/pb/pixelblaze-pattern-emulator"
HAVE_NODE = shutil.which("node") is not None
HAVE_EMU = (EMU / "src/vm/hwmodel.js").exists()
HAVE_MAP = Path("maps/egg_mapping/led_map_3d.csv").exists()
integration = pytest.mark.skipif(
    not (HAVE_NODE and HAVE_EMU and HAVE_MAP),
    reason="needs node, the emulator checkout, and the egg map",
)


def test_requires_map_or_pixel_count():
    with pytest.raises(SystemExit):
        pb.run_perf_estimate("patterns/egg/gyroid.js")


def test_missing_node_reports_clearly(monkeypatch):
    monkeypatch.setattr(pb.shutil, "which", lambda _: None)
    with pytest.raises(SystemExit) as e:
        pb.run_perf_estimate("patterns/egg/gyroid.js", pixel_count=1449)
    assert "node" in str(e.value).lower()


def test_harness_failure_surfaces_stderr(monkeypatch):
    def boom(*a, **k):
        return subprocess.CompletedProcess(a, 2, stdout="", stderr="emulator not found at /nope")
    monkeypatch.setattr(pb.subprocess, "run", boom)
    with pytest.raises(SystemExit) as e:
        pb.run_perf_estimate("patterns/egg/gyroid.js", pixel_count=1449)
    assert "emulator not found" in str(e.value)


@integration
def test_real_estimate_against_egg_map():
    result = pb.run_perf_estimate(
        "patterns/egg/fibonacci_dream.js", map_path="maps/egg_mapping/led_map_3d.csv"
    )
    assert result["pixelCount"] > 1000
    assert result["renderPicked"].startswith("render")
    assert result["expensiveOpCount"] > 0
    assert 0 < result["estFps"] <= 120
    assert result["bound"] in ("compute", "output")


@integration
def test_expensive_pattern_estimates_slower_than_cheap_one():
    # cosmic_bloom (~5 expensive ops) is compute-bound at 1449px; solid_color
    # (0 ops) is output-bound. The pair must straddle that crossover — below
    # 4 ops the egg is pinned at its 22.62 FPS output ceiling and every
    # pattern estimates identically, so a same-side pair proves nothing.
    heavy = pb.run_perf_estimate(
        "patterns/egg/cosmic_bloom.js", map_path="maps/egg_mapping/led_map_3d.csv"
    )
    light = pb.run_perf_estimate(
        "examples/utility/solid_color.js", map_path="maps/egg_mapping/led_map_3d.csv"
    )
    assert heavy["expensiveOpCount"] > light["expensiveOpCount"]
    assert light["estFps"] > heavy["estFps"]
    assert heavy["bound"] == "compute"
    assert light["bound"] == "output"
