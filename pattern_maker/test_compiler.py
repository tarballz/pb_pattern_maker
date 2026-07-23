"""Tests for offline compilation (compiler.py) and `pb render`.

The compile tests need a real cached device compiler (populated by a one-time
`pb fetch-compiler` against hardware) — they skip cleanly on machines that
have never seen a Pixelblaze. The find_cached_compiler tests run everywhere:
they point the cache at a pytest tmp dir by monkeypatching the home dir.
"""

import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

import compiler

HAVE_COMPILER = compiler.find_cached_compiler() is not None
needs_compiler = pytest.mark.skipif(
    not HAVE_COMPILER,
    reason="no cached PixelBlaze compiler (run `pb fetch-compiler` once with hardware)",
)

EMU = Path.home() / "code/pb/pixelblaze-pattern-emulator"
HAVE_NODE = shutil.which("node") is not None
HAVE_EMU = (EMU / "src/vm/index.js").exists()
HAVE_MAP = Path("maps/egg_mapping/led_map_3d.csv").exists()
render_integration = pytest.mark.skipif(
    not (HAVE_NODE and HAVE_EMU and HAVE_MAP),
    reason="needs node, the emulator checkout, and the egg map",
)

VALID_PATTERN = """
export var speed = 0.5
export function beforeRender(delta) { t1 = time(0.1 * speed) }
export function render(index) { hsv(t1 + index / pixelCount, 1, 1) }
"""

BROKEN_PATTERN = """
export function render(index) {
  hsv(0, 1, 1
}
"""


# --- find_cached_compiler (no real compiler needed: fake cache in tmp) -------

def _fake_home(monkeypatch, tmp_path):
    monkeypatch.setattr(Path, "home", classmethod(lambda cls: tmp_path))
    return tmp_path / (
        "AppData/Local/pixelblaze/compiler_cache" if sys.platform == "win32"
        else ".config/pixelblaze/compiler_cache"
    )


def test_find_returns_none_when_cache_dir_absent(monkeypatch, tmp_path):
    _fake_home(monkeypatch, tmp_path)
    assert compiler.find_cached_compiler() is None
    assert compiler.find_cached_compiler("3.51") is None


def test_find_picks_newest_version_numerically(monkeypatch, tmp_path):
    cache = _fake_home(monkeypatch, tmp_path)
    cache.mkdir(parents=True)
    for version in ("3.24", "3.51", "3.40"):
        (cache / f"{version}.js").write_text("// compiler")
    (cache / "notaversion.js").write_text("// ignored")
    assert compiler.find_cached_compiler().name == "3.51.js"


def test_find_honors_pinned_version(monkeypatch, tmp_path):
    cache = _fake_home(monkeypatch, tmp_path)
    cache.mkdir(parents=True)
    (cache / "3.24.js").write_text("// compiler")
    (cache / "3.51.js").write_text("// compiler")
    assert compiler.find_cached_compiler("3.24").name == "3.24.js"
    assert compiler.find_cached_compiler("9.99") is None


def test_compile_without_cache_names_fetch_compiler(monkeypatch, tmp_path):
    _fake_home(monkeypatch, tmp_path)
    with pytest.raises(compiler.CompileError) as e:
        compiler.compile_pattern(VALID_PATTERN)
    assert "pb fetch-compiler" in str(e.value)


# --- compile_pattern against the real cached compiler ------------------------

@needs_compiler
def test_compile_valid_pattern_packs_sane_bytecode():
    blob = compiler.compile_pattern(VALID_PATTERN)
    assert isinstance(blob, bytes) and len(blob) > 8
    opcode_size = int.from_bytes(blob[0:4], "little")
    export_size = int.from_bytes(blob[4:8], "little")
    # The two header DWORDs must account for the whole blob exactly.
    assert 8 + opcode_size + export_size == len(blob)
    assert opcode_size > 0 and opcode_size % 4 == 0
    # Exports table must contain the declared export names, NUL-terminated.
    exports = blob[8 + opcode_size:]
    for name in (b"speed\x00", b"beforeRender\x00", b"render\x00"):
        assert name in exports


@needs_compiler
def test_compile_broken_pattern_raises_with_line_column():
    with pytest.raises(compiler.CompileError) as e:
        compiler.compile_pattern(BROKEN_PATTERN)
    message = str(e.value)
    assert "line" in message and "column" in message


# --- pb render smoke ---------------------------------------------------------

@render_integration
def test_pb_render_smoke(tmp_path):
    proc = subprocess.run(
        [sys.executable, "pb.py", "render", "patterns/egg/cosmic_bloom.js",
         "--map", "maps/egg_mapping/led_map_3d.csv", "--frames", "2",
         "-o", str(tmp_path), "--json"],
        capture_output=True, text=True, timeout=120,
    )
    assert proc.returncode == 0, proc.stderr
    summary = json.loads(proc.stdout)
    assert summary["pixelCount"] > 1000
    assert summary["renderPicked"].startswith("render")
    assert summary["maxRGB"] > 0
    assert summary["nan"] is False
    assert summary["blackFraction"] < 1.0
    ppms = sorted(tmp_path.glob("*.ppm"))
    assert len(ppms) == 2
    header, _, pixels_line = ppms[0].read_bytes().partition(b"\n")
    assert header == b"P6"
    assert int(pixels_line.split(b"\n")[0].split()[0]) == summary["pixelCount"]
