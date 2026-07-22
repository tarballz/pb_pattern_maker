#!/usr/bin/env python3
"""Capture raw PixelBlaze websocket protocol traffic from a real device.

Produces ground-truth fixtures for fakeblaze's protocol.py: the exact bytes
of each response frame, used as an oracle in protocol round-trip tests.
Read-only against the device — never pushes, saves, renames, or deletes
patterns. Requires the device on the LAN.
"""

import argparse
import json
import time
from pathlib import Path

from pixelblaze import Pixelblaze


def capture(pb: Pixelblaze) -> list[str | bytes]:
    frames: list[str | bytes] = []
    orig_recv = pb.ws.recv

    def logging_recv():
        frame = orig_recv()
        frames.append(frame)
        return frame

    pb.ws.recv = logging_recv
    try:
        pb.wsSendJson({"getConfig": True})
        time.sleep(0.5)
        pb.wsSendJson({"ping": True}, expectedResponse="ack")
        pb.wsSendJson({"getVars": True}, expectedResponse="vars")
        pb.wsSendJson({"listPrograms": True}, expectedResponse=pb.messageTypes.getProgramList)

        patterns = pb.getPatternList()
        if patterns:
            pattern_id = next(iter(patterns))
            pb.wsSendJson({"getPreviewImg": pattern_id}, expectedResponse=pb.messageTypes.previewImage)
            pb.wsSendJson({"getSources": pattern_id}, expectedResponse=pb.messageTypes.getSourceCode)

        pb.wsSendJson({"sendUpdates": True})
        time.sleep(1.0)
        pb.wsSendJson({"sendUpdates": False})
    finally:
        pb.ws.recv = orig_recv

    return frames


def write_fixtures(frames: list[str | bytes], out_dir: Path) -> list[dict]:
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest = []
    for i, frame in enumerate(frames):
        is_binary = isinstance(frame, (bytes, bytearray))
        entry = {"index": i, "binary": is_binary, "length": len(frame)}
        if is_binary:
            entry["type_byte"] = frame[0] if frame else None
            entry["flags_byte"] = frame[1] if len(frame) > 1 else None
            fname = f"{i:03d}.bin"
            (out_dir / fname).write_bytes(bytes(frame))
        else:
            entry["preview"] = frame[:80]
            fname = f"{i:03d}.txt"
            (out_dir / fname).write_text(frame)
        entry["file"] = fname
        manifest.append(entry)

    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("-s", "--server", required=True, help="Pixelblaze IP address")
    parser.add_argument("-o", "--output", required=True, help="directory to write captured frames into")
    args = parser.parse_args()

    with Pixelblaze(args.server) as pb:
        frames = capture(pb)

    manifest = write_fixtures(frames, Path(args.output))
    print(f"Captured {len(manifest)} frames to {args.output}")


if __name__ == "__main__":
    main()
