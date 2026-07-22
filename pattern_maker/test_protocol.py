import json

import pytest
from pixelblaze.pixelblaze import Pixelblaze

from fakeblaze.protocol import (
    FRAME_FIRST,
    FRAME_LAST,
    FRAME_MIDDLE,
    FrameReassemblyError,
    MessageType,
    Reassembler,
    build_config_json,
    build_expander_frame,
    build_preview_frame,
    build_preview_image_frames,
    build_program_list_frames,
    build_sequencer_json,
    build_source_code_frames,
    build_stats_json,
    chunk_message,
)


def test_expander_frame_matches_real_capture():
    # Captured live on 2026-07-21: type=9, flags=5, single payload byte 5.
    assert build_expander_frame() == bytes([9, 5, 5])


def test_preview_frame_has_no_header():
    rgb = bytes([1, 2, 3, 4, 5, 6])
    frame = build_preview_frame(rgb)
    assert frame == bytes([MessageType.PREVIEW_FRAME]) + rgb
    assert len(frame) == 1 + len(rgb)


def test_preview_frame_rejects_non_triple_length():
    with pytest.raises(ValueError):
        build_preview_frame(bytes([1, 2]))


def test_chunk_message_single_chunk_flags():
    frames = chunk_message(MessageType.PROGRAM_LIST, b"abc")
    assert len(frames) == 1
    assert frames[0][0] == MessageType.PROGRAM_LIST
    assert frames[0][1] == FRAME_FIRST | FRAME_LAST
    assert frames[0][2:] == b"abc"


def test_chunk_message_empty_payload_is_single_empty_chunk():
    frames = chunk_message(MessageType.PROGRAM_LIST, b"")
    assert len(frames) == 1
    assert frames[0] == bytes([MessageType.PROGRAM_LIST, FRAME_FIRST | FRAME_LAST])


def test_chunk_message_splits_across_boundary():
    payload = bytes(range(256)) * 3  # 768 bytes
    frames = chunk_message(MessageType.GET_SOURCE_CODE, payload, max_chunk=300)
    assert len(frames) == 3
    # Matches pixelblaze-client's own wsSendBinary chunking: the first frame
    # sets FRAME_FIRST *and* (if more chunks follow) FRAME_MIDDLE together.
    assert frames[0][1] == FRAME_FIRST | FRAME_MIDDLE
    assert frames[1][1] == FRAME_MIDDLE
    assert frames[2][1] == FRAME_LAST
    reassembled = b"".join(f[2:] for f in frames)
    assert reassembled == payload


def test_reassembler_round_trips_chunked_message():
    payload = bytes(range(256)) * 6  # 1536 bytes, spans 2 chunks at 1280
    frames = chunk_message(MessageType.PUT_SOURCE_CODE, payload, max_chunk=1280)
    assert len(frames) == 2

    reassembler = Reassembler(MessageType.PUT_SOURCE_CODE)
    assert reassembler.feed(frames[0]) is None
    result = reassembler.feed(frames[1])
    assert result == payload


def test_reassembler_rejects_wrong_type():
    reassembler = Reassembler(MessageType.PUT_SOURCE_CODE)
    with pytest.raises(FrameReassemblyError):
        reassembler.feed(bytes([MessageType.PUT_BYTE_CODE, FRAME_FIRST | FRAME_LAST]) + b"x")


def test_reassembler_rejects_missing_first_frame():
    reassembler = Reassembler(MessageType.PUT_SOURCE_CODE)
    with pytest.raises(FrameReassemblyError):
        reassembler.feed(bytes([MessageType.PUT_SOURCE_CODE, FRAME_MIDDLE]) + b"x")


def test_reassembler_rejects_duplicate_first_frame():
    reassembler = Reassembler(MessageType.PUT_SOURCE_CODE)
    assert reassembler.feed(bytes([MessageType.PUT_SOURCE_CODE, FRAME_FIRST]) + b"x") is None
    with pytest.raises(FrameReassemblyError):
        reassembler.feed(bytes([MessageType.PUT_SOURCE_CODE, FRAME_FIRST | FRAME_LAST]) + b"y")


def test_program_list_matches_real_capture_shape():
    # Real device sent a single-chunk 'id\tname\n' payload for a short list.
    frames = build_program_list_frames([("abc123", "test pattern"), ("def456", "another")])
    assert len(frames) == 1
    assert frames[0][0] == MessageType.PROGRAM_LIST
    assert frames[0][1] == FRAME_FIRST | FRAME_LAST
    assert frames[0][2:] == b"abc123\ttest pattern\ndef456\tanother\n"


def test_preview_image_frames_wrap_type_and_flags():
    jpeg = b"\xff\xd8\xff" + b"\x00" * 40 + b"\xff\xd9"
    frames = build_preview_image_frames(jpeg)
    assert len(frames) == 1
    assert frames[0][0] == MessageType.PREVIEW_IMAGE
    assert frames[0][2:] == jpeg


def test_source_code_round_trips_through_real_client_codec():
    # Oracle: use pixelblaze-client's own LZString compress/decompress so
    # we know fakeblaze produces bytes a real client can actually decode.
    source_payload = json.dumps({"main": "export function render(index) { rgb(0,0,0) }"})
    compressed = Pixelblaze._compress_to_uint8array(source_payload)

    frames = build_source_code_frames(compressed)
    reassembler = Reassembler(MessageType.GET_SOURCE_CODE)
    reassembled = None
    for frame in frames:
        reassembled = reassembler.feed(frame)
    assert reassembled == compressed

    decoded = Pixelblaze._decompress_from_uint8array(reassembled)
    assert decoded == source_payload


def test_config_json_matches_real_capture_shape():
    doc = json.loads(build_config_json(name="Test PB", pixel_count=10, version="3.51", chip_id=1))
    assert doc["name"] == "Test PB"
    assert doc["pixelCount"] == 10
    assert doc["ver"] == "3.51"
    # Field set matches a real getConfig capture (2026-07-21), sans identifying values.
    assert set(doc) == {
        "name", "brandName", "pixelCount", "brightness", "maxBrightness", "colorOrder",
        "dataSpeed", "ledType", "sequenceTimer", "transitionDuration", "sequencerMode",
        "runSequencer", "simpleUiMode", "learningUiMode", "discoveryEnable", "timezone",
        "autoOffEnable", "autoOffStart", "autoOffEnd", "cpuSpeed", "networkPowerSave",
        "mapperFit", "leaderId", "nodeId", "soundSrc", "accelSrc", "lightSrc", "analogSrc",
        "exp", "ver", "chipId",
    }


def test_sequencer_json_starts_with_active_program_key():
    text = build_sequencer_json(active_program_id="abc123", name="test pattern")
    assert text.startswith('{"activeProgram":')
    doc = json.loads(text)
    assert doc["activeProgram"]["activeProgramId"] == "abc123"


def test_stats_json_starts_with_fps_key():
    text = build_stats_json(fps=42.5)
    assert text.startswith('{"fps":')
    doc = json.loads(text)
    assert doc["fps"] == 42.5
