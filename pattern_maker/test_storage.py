import tempfile
from pathlib import Path

import pytest
from pixelblaze.pixelblaze import PBP

from fakeblaze.storage import PathSecurityError, Storage


def make_pbp_bytes(pattern_id: str, name: str) -> bytes:
    # Oracle: build a real PBP via pixelblaze-client's own class so storage.py
    # is tested against bytes an actual client would produce. Routed through
    # toFile() (its only public byte-serialization path) rather than reaching
    # into its private buffer.
    pbp = PBP.fromComponents(
        pattern_id,
        name=name,
        previewImage=b"\xff\xd8\xff\xd9",
        byteCode=b"\x00\x00\x00\x00\x00\x00\x00\x00",
        sourceCode="export function render(index) { rgb(0,0,0) }",
    )
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "pattern"
        pbp.toFile(out)
        return out.with_suffix(".pbp").read_bytes()


@pytest.fixture
def storage(tmp_path):
    return Storage(tmp_path / "fakeblaze-data")


def test_creates_data_dir_and_pattern_subdir(tmp_path):
    data_dir = tmp_path / "nested" / "fakeblaze-data"
    Storage(data_dir)
    assert data_dir.is_dir()
    assert (data_dir / "p").is_dir()


def test_write_read_delete_round_trip(storage):
    assert storage.read_file("/config.json") is None
    storage.write_file("/config.json", b'{"a":1}')
    assert storage.read_file("/config.json") == b'{"a":1}'
    assert storage.delete_file("/config.json") is True
    assert storage.read_file("/config.json") is None
    assert storage.delete_file("/config.json") is False


def test_list_files_matches_written_content(storage):
    storage.write_file("/config.json", b"x")
    storage.write_file("/p/abc123", b"yy")
    assert storage.list_files() == [("/config.json", 1), ("/p/abc123", 2)]


@pytest.mark.parametrize("bad_path", ["no-leading-slash", "/../escape", "/p/../../escape", "/p/../etc/passwd"])
def test_rejects_unsafe_paths(storage, bad_path):
    with pytest.raises(PathSecurityError):
        storage.write_file(bad_path, b"x")
    with pytest.raises(PathSecurityError):
        storage.read_file(bad_path)


def test_save_and_load_pattern_via_real_pbp_class(storage):
    blob = make_pbp_bytes("abc12345678901234", "Test Pattern")
    storage.save_pattern("abc12345678901234", blob)

    loaded_bytes = storage.load_pattern_bytes("abc12345678901234")
    assert loaded_bytes == blob

    loaded = storage.load_pattern("abc12345678901234")
    assert loaded.name == "Test Pattern"
    assert loaded.sourceCode == '{"main":"export function render(index) { rgb(0,0,0) }"}'


def test_load_missing_pattern_returns_none(storage):
    assert storage.load_pattern_bytes("nope") is None
    assert storage.load_pattern("nope") is None


def test_delete_pattern_removes_blob_and_controls(storage):
    storage.save_pattern("abc", make_pbp_bytes("abc", "P"))
    storage.save_controls("abc", {"speed": 0.5})

    assert storage.delete_pattern("abc") is True
    assert storage.load_pattern_bytes("abc") is None
    assert storage.load_controls("abc") is None


def test_delete_pattern_without_controls_file_still_succeeds(storage):
    storage.save_pattern("abc", make_pbp_bytes("abc", "P"))
    assert storage.delete_pattern("abc") is True


def test_controls_round_trip(storage):
    assert storage.load_controls("abc") is None
    storage.save_controls("abc", {"speed": 0.5, "hue": 1})
    assert storage.load_controls("abc") == {"speed": 0.5, "hue": 1}


def test_list_patterns_maps_id_to_name(storage):
    storage.save_pattern("id1", make_pbp_bytes("id1", "First"))
    storage.save_pattern("id2", make_pbp_bytes("id2", "Second"))
    storage.save_controls("id1", {"x": 1})  # should not appear as a pattern

    assert storage.list_patterns() == {"id1": "First", "id2": "Second"}


def test_list_patterns_skips_corrupt_blobs(storage):
    storage.save_pattern("id1", make_pbp_bytes("id1", "First"))
    storage.write_file("/p/garbage", b"not a real pbp blob")

    assert storage.list_patterns() == {"id1": "First"}


def test_config_round_trip_and_default(storage):
    default = {"name": "fakeblaze", "pixelCount": 1}
    assert storage.get_config(default) == default
    storage.save_config({"name": "custom", "pixelCount": 42})
    assert storage.get_config(default) == {"name": "custom", "pixelCount": 42}


def test_seeded_webui_round_trip(storage):
    assert storage.seeded_webui() is None
    storage.seed_webui(b"\x1f\x8b fake gzip bytes")
    assert storage.seeded_webui() == b"\x1f\x8b fake gzip bytes"


def test_seeded_version_reads_sidecar_file(tmp_path):
    data_dir = tmp_path / "fakeblaze-data"
    storage = Storage(data_dir)
    assert storage.seeded_version() is None
    (data_dir / "ver.txt").write_text("3.51\n")
    assert storage.seeded_version() == "3.51"
