"""Pure encode/decode helpers for the PixelBlaze websocket protocol.

No I/O here — server.py owns the actual socket plumbing. Frame formats are
verified against a real device (firmware 3.51, 200 pixels) captured on
2026-07-21; see docs/superpowers/plans/2026-07-21-fakeblaze-hardware-optional-plan.md
for the capture notes, including a correction to the original preview-frame
format assumption.

PBP (Pixelblaze Binary Pattern) build/parse is intentionally NOT reimplemented
here — pixelblaze-client already ships a complete `pixelblaze.PBP` class
(`fromComponents` to build, property accessors to parse) that storage.py can
use directly.
"""

from __future__ import annotations

import json
from enum import IntEnum


class MessageType(IntEnum):
    PUT_SOURCE_CODE = 1
    PUT_BYTE_CODE = 3
    PREVIEW_IMAGE = 4
    PREVIEW_FRAME = 5
    GET_SOURCE_CODE = 6
    PROGRAM_LIST = 7
    PUT_PIXEL_MAP = 8
    EXPANDER_CONFIG = 9


FRAME_FIRST = 1
FRAME_MIDDLE = 2
FRAME_LAST = 4

# Chunk size the device uses when *sending* multi-part binary messages
# (previewImage/getSourceCode/programList/expanderConfig) — confirmed against
# real captures up to 7056 bytes, all single-chunk. putSourceCode/putByteCode
# (client -> device only) chunk at 1280 instead; mirrored here for reassembly.
OUTGOING_MAX_CHUNK = 8192
INCOMING_CODE_MAX_CHUNK = 1280


def chunk_message(message_type: MessageType, payload: bytes, *, max_chunk: int = OUTGOING_MAX_CHUNK) -> list[bytes]:
    """Split payload into wire-ready frames: ``[type, flags, ...chunk bytes]``."""
    if not payload:
        return [bytes([message_type, FRAME_FIRST | FRAME_LAST])]
    frames = []
    for i in range(0, len(payload), max_chunk):
        chunk = payload[i:i + max_chunk]
        flags = FRAME_FIRST if i == 0 else 0
        flags |= FRAME_LAST if i + max_chunk >= len(payload) else FRAME_MIDDLE
        frames.append(bytes([message_type, flags]) + chunk)
    return frames


class FrameReassemblyError(Exception):
    pass


class Reassembler:
    """Accumulates chunked frames of one binary message type into a full payload.

    Mirrors the client-side state machine in pixelblaze-client's wsReceive()
    so fakeblaze rejects the same malformed sequences a real device would.
    """

    def __init__(self, expected_type: MessageType):
        self.expected_type = expected_type
        self._buffer: bytearray | None = None

    def feed(self, frame: bytes) -> bytes | None:
        if len(frame) < 2:
            raise FrameReassemblyError("frame shorter than 2-byte header")
        frame_type, flags = frame[0], frame[1]
        if frame_type != self.expected_type:
            raise FrameReassemblyError(f"expected type {self.expected_type}, got {frame_type}")
        is_first = bool(flags & FRAME_FIRST)
        is_last = bool(flags & FRAME_LAST)
        if self._buffer is None and not is_first:
            raise FrameReassemblyError("first frame must set FRAME_FIRST")
        if self._buffer is not None and is_first:
            raise FrameReassemblyError("FRAME_FIRST received mid-message")
        if self._buffer is None:
            self._buffer = bytearray(frame[2:])
        else:
            self._buffer += frame[2:]
        if is_last:
            complete, self._buffer = bytes(self._buffer), None
            return complete
        return None


def build_expander_frame() -> bytes:
    """The type-9 frame a real device always sends as the 3rd part of a getConfig reply."""
    return bytes([MessageType.EXPANDER_CONFIG, FRAME_FIRST | FRAME_LAST, 5])


def build_preview_frame(rgb: bytes) -> bytes:
    """Type-5 preview frame: type byte + RGB triples, no flags byte, no padding.

    Verified byte-for-byte against a real 200-pixel device: total length is
    exactly ``1 + len(rgb)``, RGB starting immediately after the type byte.
    (An earlier draft of the design doc wrongly assumed an 18-byte zero
    header here — see the capture notes linked above.)
    """
    if len(rgb) % 3 != 0:
        raise ValueError("rgb must be a whole number of 3-byte triples")
    return bytes([MessageType.PREVIEW_FRAME]) + rgb


def build_program_list_frames(patterns: list[tuple[str, str]]) -> list[bytes]:
    """``patterns``: ``[(patternId, name), ...]`` -> chunked type-7 ``id\\tname\\n`` text."""
    payload = "".join(f"{pattern_id}\t{name}\n" for pattern_id, name in patterns).encode("utf-8")
    return chunk_message(MessageType.PROGRAM_LIST, payload)


def build_source_code_frames(compressed_source: bytes) -> list[bytes]:
    """``compressed_source``: LZString ``compressToUint8Array`` bytes of ``{"main": src}``."""
    return chunk_message(MessageType.GET_SOURCE_CODE, compressed_source)


def build_preview_image_frames(jpeg: bytes) -> list[bytes]:
    return chunk_message(MessageType.PREVIEW_IMAGE, jpeg)


def build_config_json(*, name: str, pixel_count: int, brightness: float = 1, max_brightness: int = 100,
                       color_order: str = "GRB", data_speed: int = 3500000, led_type: int = 2,
                       version: str = "3.51", chip_id: int = 0, brand_name: str = "",
                       timezone: str = "UTC", **extra) -> str:
    """Key order verified against a real device's getConfig reply."""
    doc = {
        "name": name, "brandName": brand_name, "pixelCount": pixel_count,
        "brightness": brightness, "maxBrightness": max_brightness, "colorOrder": color_order,
        "dataSpeed": data_speed, "ledType": led_type, "sequenceTimer": 15,
        "transitionDuration": 0, "sequencerMode": 0, "runSequencer": False,
        "simpleUiMode": False, "learningUiMode": False, "discoveryEnable": True,
        "timezone": timezone, "autoOffEnable": False, "autoOffStart": "00:00",
        "autoOffEnd": "00:00", "cpuSpeed": 240, "networkPowerSave": False,
        "mapperFit": 1, "leaderId": 0, "nodeId": 0, "soundSrc": 0, "accelSrc": 0,
        "lightSrc": 0, "analogSrc": 0, "exp": 0, "ver": version, "chipId": chip_id,
    }
    doc.update(extra)
    return json.dumps(doc, separators=(",", ":"))


def build_sequencer_json(*, active_program_id: str, name: str, controls: dict | None = None,
                          sequencer_mode: int = 0, run_sequencer: bool = False) -> str:
    """Must start with ``{"activeProgram":`` — pixelblaze-client keys off this
    prefix to recognize an unsolicited sequencer push (see wsReceive)."""
    doc = {
        "activeProgram": {"name": name, "activeProgramId": active_program_id, "controls": controls or {}},
        "sequencerMode": sequencer_mode, "runSequencer": run_sequencer,
    }
    return json.dumps(doc, separators=(",", ":"))


def build_stats_json(*, fps: float, vmerr: int = 0, vmerrpc: int = -1, mem: int = 10003,
                      exp: int = 0, render_type: int = 2, uptime: int = 0,
                      storage_used: int = 0, storage_size: int = 0, rr0: int = 0,
                      rr1: int = 0, reboot_counter: int = 0) -> str:
    """Must start with ``{"fps":`` — pixelblaze-client keys off this prefix to
    recognize the once-a-second stats push (see wsReceive)."""
    doc = {
        "fps": fps, "vmerr": vmerr, "vmerrpc": vmerrpc, "mem": mem, "exp": exp,
        "renderType": render_type, "uptime": uptime, "storageUsed": storage_used,
        "storageSize": storage_size, "rr0": rr0, "rr1": rr1, "rebootCounter": reboot_counter,
    }
    return json.dumps(doc, separators=(",", ":"))
