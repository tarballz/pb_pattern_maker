#!/usr/bin/env python3
"""CLI for Pixelblaze patterns: compile, render, push, and manage — with or
without hardware.

Wraps pixelblaze-client. Compilation runs locally in an embedded JS engine
using the device's own compiler, cached under
~/.config/pixelblaze/compiler_cache by a one-time `pb fetch-compiler` against
real hardware — after that, `pb compile` needs no device at all. `pb render`
executes a pattern headlessly through the emulator VM (no device, no server).
Device commands (push/vars/backup/list/frame) need a reachable Pixelblaze —
real, or a local `uv run python -m fakeblaze`.

The device address comes from --server, the PB_SERVER env var, or network
discovery, in that order.
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

from pixelblaze import PBB, Pixelblaze

import compiler

OFFLINE_HINT = (
    "No hardware? Run `uv run python -m fakeblaze --map <csv>` for a local fake "
    "device, or `pb render` for a hardware-free render."
)


def resolve_server(server: str | None) -> str:
    addr = resolve_server_or_none(server)
    if addr is None:
        sys.exit("No Pixelblaze found on the network. Pass --server <ip> or set "
                 f"PB_SERVER. {OFFLINE_HINT}")
    return addr


def resolve_server_or_none(server: str | None) -> str | None:
    if server:
        return server
    env = os.environ.get("PB_SERVER")
    if env:
        return env
    print("No --server or PB_SERVER set; discovering...", file=sys.stderr)
    for addr in Pixelblaze.EnumerateAddresses(timeout=3000):
        print(f"Found Pixelblaze at {addr}", file=sys.stderr)
        return addr
    return None


def connect(args) -> Pixelblaze:
    addr = resolve_server(args.server)
    # pixelblaze-client dials with no timeout, so a powered-off device hangs
    # for the OS's ~75s TCP timeout. Bound the dial; the client sets its own
    # recv timeout on the socket once connected.
    import websocket
    previous = websocket.getdefaulttimeout()
    websocket.setdefaulttimeout(10)
    try:
        return Pixelblaze(addr)
    except Exception as e:
        sys.exit(f"Could not connect to Pixelblaze at {addr}: {e}\n{OFFLINE_HINT}")
    finally:
        websocket.setdefaulttimeout(previous)


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
    # Offline first: a cached device compiler needs no device, no --server,
    # no discovery. Fall back to a live device only when nothing is cached.
    cached = compiler.find_cached_compiler(args.version)
    if cached is not None:
        failed = False
        for path in args.files:
            try:
                bytecode = compiler.compile_pattern(Path(path).read_text(), args.version)
                print(f"OK   {path} ({len(bytecode)} bytes of bytecode, "
                      f"offline compiler v{cached.stem})")
            except compiler.CompileError as e:
                failed = True
                print(f"FAIL {path}: {e}")
        sys.exit(1 if failed else 0)

    if args.version is not None:
        sys.exit(f"Compiler version {args.version} is not cached in "
                 f"{compiler.compiler_cache_dir()}. Drop --version to use a live "
                 "device, or run `pb fetch-compiler` against one.")

    addr = resolve_server_or_none(args.server)
    if addr is None:
        sys.exit(
            "No cached compiler and no reachable Pixelblaze.\n"
            "Run `pb fetch-compiler` once with a device on the LAN to enable "
            "offline compiles forever after.\n"
            "Until then, `validate.py` and the emulator (`pb render`) still work "
            "without any compiler."
        )
    try:
        pb = Pixelblaze(addr)
    except Exception as e:
        sys.exit(f"Could not connect to Pixelblaze at {addr}: {e}\n"
                 "Run `pb fetch-compiler` once with a reachable device to enable "
                 "offline compiles; `validate.py` and `pb render` work without one.")
    failed = False
    with pb:
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


def write_ppm(frame: bytes, out: Path, height: int = 16) -> int:
    pixels = len(frame) // 3
    with out.open("wb") as f:
        f.write(f"P6\n{pixels} {height}\n255\n".encode())
        for _ in range(height):
            f.write(frame[: pixels * 3])
    return pixels


def sim_render(pattern_path: str, map_path: str | None, frames: int = 1,
               delta_ms: float = 16.7) -> tuple[list[bytes], dict]:
    """Render a pattern headlessly through the emulator VM (no device, no
    server). Returns (frames, summary). Exits with a named message on any
    failure."""
    if not map_path:
        sys.exit("Simulated rendering needs --map <csv> to know the LED layout "
                 "(e.g. --map maps/egg_mapping/led_map_3d.csv).")
    if not Path(map_path).exists():
        sys.exit(f"Map not found: {map_path}")
    from fakeblaze.renderworker import RenderWorker

    source = Path(pattern_path).read_text()
    worker = RenderWorker(map_path, timeout=30.0)
    worker.start()
    try:
        if worker.degraded:
            sys.exit(f"Render worker unavailable: {worker.last_error}")
        loaded = worker.load_pattern(source, Path(pattern_path).stem, timeout=30.0)
        if not loaded.get("ok"):
            sys.exit(f"{pattern_path}: {loaded.get('error')}")
        rendered = []
        nan_seen = False
        for _ in range(frames):
            rendered.append(worker.frame(delta_ms, timeout=30.0))
            nan_seen = nan_seen or worker.last_frame_nan > 0
        exported_vars = worker.get_vars(timeout=10.0)
        pixel_count = worker.pixel_count
    finally:
        worker.stop()

    last = rendered[-1]
    black = sum(1 for i in range(0, len(last) - 2, 3)
                if last[i] == 0 and last[i + 1] == 0 and last[i + 2] == 0)
    summary = {
        "pattern": str(pattern_path),
        "map": str(map_path),
        "pixelCount": pixel_count,
        "renderPicked": loaded.get("renderPicked"),
        "frames": frames,
        "maxRGB": max((max(rgb) for rgb in rendered if rgb), default=0),
        "nan": nan_seen,
        "blackFraction": round(black / pixel_count, 4) if pixel_count else 1.0,
        "vars": exported_vars,
    }
    return rendered, summary


def cmd_render(args):
    frames, summary = sim_render(args.file, args.map, args.frames)
    ppm_paths = []
    if args.output:
        outdir = Path(args.output)
        outdir.mkdir(parents=True, exist_ok=True)
        stem = Path(args.file).stem
        for i, rgb in enumerate(frames):
            out = outdir / f"{stem}_{i:03d}.ppm"
            write_ppm(rgb, out)
            ppm_paths.append(str(out))
        summary["ppm"] = ppm_paths
    if args.json:
        print(json.dumps(summary, indent=2))
        return
    print(args.file)
    print(f"  {summary['pixelCount']} pixels ({summary['map']}) -> {summary['renderPicked']}")
    print(f"  {summary['frames']} frame(s): maxRGB {summary['maxRGB']}, "
          f"{summary['blackFraction']:.1%} black pixels, "
          + ("NaN detected!" if summary["nan"] else "no NaN"))
    for key, value in sorted(summary["vars"].items()):
        print(f"  var {key} = {value}")
    for ppm in ppm_paths:
        print(f"  wrote {ppm}")


def cmd_frame(args):
    if args.sim:
        if not args.pattern:
            sys.exit("--sim needs --pattern <file.js> (there is no device to have "
                     "a current pattern).")
        frames, _ = sim_render(args.pattern, args.map, frames=1)
        frame = frames[0]
    else:
        with connect(args) as pb:
            frame = pb.getPreviewFrame()
        if not frame:
            sys.exit("No preview frame received (is the pattern rendering?)")
    out = Path(args.output)
    pixels = write_ppm(frame, out, args.height)
    print(f"{pixels}-pixel frame written to {out} ({pixels}x{args.height} PPM)")


TRIVIAL_PATTERN = "export function render(index) { hsv(0, 0, 1) }"


def cmd_fetch_compiler(args):
    with connect(args) as pb:
        version = pb.getVersion()
        pb.compilePattern(TRIVIAL_PATTERN, allow_cache=True)
        cached = compiler.find_cached_compiler(str(version))
        if cached is None:
            sys.exit(f"Compile against the device ran, but v{version} never appeared "
                     f"in {compiler.compiler_cache_dir()}.")
        print(f"Compiler v{version} cached at {cached} — `pb compile` now works offline.")
        if args.seed_fakeblaze:
            from fakeblaze.storage import Storage
            webui = pb.getFile("/index.html.gz")
            if not webui:
                sys.exit("Could not download /index.html.gz from the device.")
            storage = Storage(Path(__file__).parent / ".fakeblaze")
            # The webUI is Electromage's proprietary code and this repo is
            # public: make sure the data dir ignores itself before writing.
            gitignore = storage.root / ".gitignore"
            if not gitignore.exists():
                gitignore.write_text("*\n")
            storage.seed_webui(webui)
            (storage.root / "ver.txt").write_text(str(version))
            print(f"Seeded fakeblaze webUI ({len(webui)} bytes, ver {version}) "
                  f"into {storage.root}")


HARNESS = Path(__file__).parent / "tools" / "perf_estimate.mjs"


def run_perf_estimate(pattern: str, map_path: str | None = None,
                      pixel_count: int | None = None,
                      output_method: str = "ws2812") -> dict:
    """Estimate hardware FPS by shelling to the node harness. Exits with a
    named message rather than a traceback on any failure."""
    if not map_path and not pixel_count:
        sys.exit("Need --map or --pixel-count to know how many LEDs to model.")
    if shutil.which("node") is None:
        sys.exit("node not found on PATH — required for the perf estimate.")

    cmd = ["node", str(HARNESS), "--pattern", pattern, "--output-method", output_method]
    if map_path:
        cmd += ["--map", map_path]
    if pixel_count:
        cmd += ["--pixel-count", str(pixel_count)]

    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        sys.exit(proc.stderr.strip() or f"perf estimate failed (exit {proc.returncode})")
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError:
        sys.exit(f"perf estimate returned unreadable output: {proc.stdout[:200]}")


def cmd_perf(args):
    result = run_perf_estimate(args.file, args.map, args.pixel_count, args.output_method)
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        fps = result["estFps"]
        print(f"{args.file}")
        print(f"  {result['pixelCount']} pixels ({result['dim']}D map) -> {result['renderPicked']}")
        print(f"  {result['expensiveOpCount']} expensive op(s) in the rendered function")
        print(f"  est. {fps:.1f} FPS on V3 / {result['outputMethod']} ({result['bound']}-bound)")
    if args.min_fps is not None and result["estFps"] < args.min_fps:
        sys.exit(f"FAIL: {result['estFps']:.1f} FPS is below --min-fps {args.min_fps}")


def main():
    parser = argparse.ArgumentParser(prog="pb", description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("-s", "--server", help="Pixelblaze IP address (default: $PB_SERVER, then discovery)")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("devices", help="discover Pixelblazes on the network").set_defaults(fn=cmd_devices)
    sub.add_parser("list", help="list patterns stored on the device").set_defaults(fn=cmd_list)

    p = sub.add_parser("compile", help="compile pattern files to bytecode (definitive "
                       "syntax check; offline once `pb fetch-compiler` has run)")
    p.add_argument("files", nargs="+")
    p.add_argument("--version", help="pin a cached compiler version (e.g. 3.51)")
    p.set_defaults(fn=cmd_compile)

    p = sub.add_parser("render", help="render a pattern headlessly through the "
                       "emulator VM (no device, no server)")
    p.add_argument("file")
    p.add_argument("--map", help="LED map CSV/JSON to render against (required)")
    p.add_argument("--frames", type=int, default=1, help="number of frames to render (default 1)")
    p.add_argument("-o", "--output", metavar="DIR", help="write each frame as a PPM into this directory")
    p.add_argument("--json", action="store_true", help="print the machine-readable summary")
    p.set_defaults(fn=cmd_render)

    p = sub.add_parser("fetch-compiler", help="one-time: cache the device's compiler "
                       "for offline `pb compile` (needs real hardware)")
    p.add_argument("--seed-fakeblaze", action="store_true",
                   help="also save the device webUI + version into pattern_maker/.fakeblaze/ "
                        "so fakeblaze can serve the compiler")
    p.set_defaults(fn=cmd_fetch_compiler)

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
    p.add_argument("--sim", action="store_true",
                   help="render via the emulator VM instead of a device (needs --pattern and --map)")
    p.add_argument("--pattern", help="pattern file to render (--sim only)")
    p.add_argument("--map", help="LED map CSV/JSON (--sim only)")
    p.set_defaults(fn=cmd_frame)

    p = sub.add_parser("perf", help="estimate hardware FPS for a pattern (no device needed)")
    p.add_argument("file")
    p.add_argument("--map", help="map CSV/JSON to take the pixel count and dimensionality from")
    p.add_argument("--pixel-count", type=int, help="model this many pixels instead of reading a map")
    p.add_argument("--output-method", default="ws2812", choices=["ws2812", "expander", "apa102"])
    p.add_argument("--min-fps", type=float, help="exit non-zero if the estimate falls below this")
    p.add_argument("--json", action="store_true", help="print the raw JSON result")
    p.set_defaults(fn=cmd_perf)

    args = parser.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
