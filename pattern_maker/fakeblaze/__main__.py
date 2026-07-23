"""CLI entry point: ``uv run python -m fakeblaze --map maps/egg_mapping/led_map_3d.csv``.

Binds ws://:81 and http://:80 by default — the ports pixelblaze-client
hardcodes — so an unmodified ``pb.py`` (or any pixelblaze-client user) can
target ``127.0.0.1`` as if it were real hardware.
"""

from __future__ import annotations

import argparse
import logging
import sys
import time

from .server import DEFAULT_DATA_DIR, FakeBlaze


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="fakeblaze",
        description="Hardware-optional PixelBlaze simulator for pixelblaze-client/pb.py.")
    parser.add_argument("--map", required=True,
                        help="LED map (marimapper CSV or JSON array) the render worker executes against")
    parser.add_argument("--data-dir", default=None,
                        help=f"device-filesystem mirror (default {DEFAULT_DATA_DIR})")
    parser.add_argument("--ws-port", type=int, default=81,
                        help="websocket port (default 81, what pixelblaze-client dials)")
    parser.add_argument("--http-port", type=int, default=80,
                        help="HTTP file-API port (default 80)")
    parser.add_argument("--emulator", default=None,
                        help="pixelblaze-pattern-emulator checkout (default $PB_EMU_ROOT or ~/code/pb/pixelblaze-pattern-emulator)")
    parser.add_argument("--ver", default=None,
                        help="firmware version string to report (default: seeded ver.txt, else 3.51)")
    parser.add_argument("--name", default="fakeblaze", help="device name to report")
    parser.add_argument("--no-discovery", action="store_true",
                        help="don't send the UDP discovery beacon to 127.0.0.1:1889")
    parser.add_argument("--require-render", action="store_true",
                        help="fail at startup if the render worker can't run (instead of serving black frames)")
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

    fb = FakeBlaze(args.map, data_dir=args.data_dir, ws_port=args.ws_port,
                   http_port=args.http_port, emulator_root=args.emulator,
                   ver=args.ver, no_discovery=args.no_discovery,
                   require_render=args.require_render, name=args.name)
    try:
        fb.start()
    except OSError as err:
        print(f"fakeblaze: could not bind listeners: {err}", file=sys.stderr)
        return 1

    try:
        print(f"fakeblaze '{fb.name}' up: ws://127.0.0.1:{fb.ws_port}/  "
              f"http://127.0.0.1:{fb.http_port}/  ({fb.worker.pixel_count} pixels, "
              f"ver {fb.server.ver}, data dir {fb.data_dir})")
        if fb.worker.degraded:
            print(f"WARNING: render worker degraded — {fb.worker.last_error}; "
                  "protocol is served but frames are black", file=sys.stderr)
        if not fb.no_discovery:
            print("discovery beacon -> 127.0.0.1:1889 (pb.py devices will find it)")
        print("Ctrl-C to stop.")
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        print("\nfakeblaze: shutting down")
    finally:
        fb.stop()
    return 0


if __name__ == "__main__":
    sys.exit(main())
