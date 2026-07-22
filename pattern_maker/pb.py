#!/usr/bin/env python3
"""CLI for a Pixelblaze on the LAN: compile, push, and manage patterns.

Wraps pixelblaze-client. Compilation runs locally in an embedded JS engine
using the device's own compiler, which is downloaded from the device on first
use and cached under ~/.config/pixelblaze/compiler_cache — so the device must
be reachable.

The device address comes from --server, the PB_SERVER env var, or network
discovery, in that order.
"""

import argparse
import os
import sys
from pathlib import Path

from pixelblaze import PBB, Pixelblaze


def resolve_server(server: str | None) -> str:
    if server:
        return server
    env = os.environ.get("PB_SERVER")
    if env:
        return env
    print("No --server or PB_SERVER set; discovering...", file=sys.stderr)
    for addr in Pixelblaze.EnumerateAddresses(timeout=3000):
        print(f"Found Pixelblaze at {addr}", file=sys.stderr)
        return addr
    sys.exit("No Pixelblaze found on the network. Pass --server <ip> or set PB_SERVER.")


def connect(args) -> Pixelblaze:
    addr = resolve_server(args.server)
    try:
        return Pixelblaze(addr)
    except Exception as e:
        sys.exit(f"Could not connect to Pixelblaze at {addr}: {e}")


def cmd_devices(args):
    found = False
    for addr in Pixelblaze.EnumerateAddresses(timeout=3000):
        found = True
        try:
            with Pixelblaze(addr) as pb:
                print(f"{addr}\t{pb.getDeviceName()}\tv{pb.getVersion()}\t{pb.getPixelCount()} pixels")
        except Exception:
            print(addr)
    if not found:
        sys.exit("No Pixelblaze found on the network.")


def cmd_list(args):
    with connect(args) as pb:
        for pattern_id, name in sorted(pb.getPatternList().items(), key=lambda kv: kv[1].lower()):
            print(f"{pattern_id}\t{name}")


def cmd_compile(args):
    failed = False
    with connect(args) as pb:
        for path in args.files:
            source = Path(path).read_text()
            try:
                bytecode = pb.compilePattern(source, allow_cache=True)
                print(f"OK   {path} ({len(bytecode)} bytes of bytecode)")
            except Exception as e:
                failed = True
                print(f"FAIL {path}: {e}")
    sys.exit(1 if failed else 0)


def cmd_push(args):
    path = Path(args.file)
    source = path.read_text()
    name = args.name or path.stem
    with connect(args) as pb:
        if args.save:
            pattern_id = pb.savePattern(previewImage=b"", sourceCode=source, name=name, allowCache=True)
            print(f"Saved '{name}' to {pb.ipAddress} (id {pattern_id})")
        else:
            bytecode = pb.compilePattern(source, allow_cache=True)
            pb.sendPatternToRenderer(bytecode)
            print(f"Running '{name}' live on {pb.ipAddress} (not saved — re-run with --save to keep it)")


def cmd_vars(args):
    with connect(args) as pb:
        if args.assignments:
            updates = {}
            for assignment in args.assignments:
                key, sep, value = assignment.partition("=")
                if not sep:
                    sys.exit(f"Expected name=value, got '{assignment}'")
                updates[key] = float(value)
            pb.setActiveVariables(updates)
        for key, value in sorted(pb.getActiveVariables().items()):
            print(f"{key} = {value}")


def cmd_backup(args):
    with connect(args) as pb:
        pb.saveBackup(args.output)
        print(f"Backup of {pb.getDeviceName()} written to {args.output}")


def cmd_frame(args):
    with connect(args) as pb:
        frame = pb.getPreviewFrame()
    if not frame:
        sys.exit("No preview frame received (is the pattern rendering?)")
    pixels = len(frame) // 3
    out = Path(args.output)
    with out.open("wb") as f:
        f.write(f"P6\n{pixels} {args.height}\n255\n".encode())
        for _ in range(args.height):
            f.write(frame[: pixels * 3])
    print(f"{pixels}-pixel frame written to {out} ({pixels}x{args.height} PPM)")


def main():
    parser = argparse.ArgumentParser(prog="pb", description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("-s", "--server", help="Pixelblaze IP address (default: $PB_SERVER, then discovery)")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("devices", help="discover Pixelblazes on the network").set_defaults(fn=cmd_devices)
    sub.add_parser("list", help="list patterns stored on the device").set_defaults(fn=cmd_list)

    p = sub.add_parser("compile", help="compile pattern files to bytecode (definitive syntax check)")
    p.add_argument("files", nargs="+")
    p.set_defaults(fn=cmd_compile)

    p = sub.add_parser("push", help="compile and run a pattern on the device")
    p.add_argument("file")
    p.add_argument("--save", action="store_true", help="save to the device's pattern list instead of a live trial")
    p.add_argument("--name", help="pattern name (default: file stem)")
    p.set_defaults(fn=cmd_push)

    p = sub.add_parser("vars", help="show (and optionally set) the active pattern's exported vars")
    p.add_argument("assignments", nargs="*", metavar="name=value")
    p.set_defaults(fn=cmd_vars)

    p = sub.add_parser("backup", help="save a full device backup (.pbb)")
    p.add_argument("output")
    p.set_defaults(fn=cmd_backup)

    p = sub.add_parser("frame", help="grab the current preview frame as a PPM image")
    p.add_argument("-o", "--output", default="frame.ppm")
    p.add_argument("--height", type=int, default=16, help="image height in repeated rows (default 16)")
    p.set_defaults(fn=cmd_frame)

    args = parser.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
