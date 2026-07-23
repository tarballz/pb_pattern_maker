"""Offline PixelBlaze pattern compilation from the cached device compiler.

pixelblaze-client caches the device's own compiler JS (extracted from the
webUI's ``/index.html.gz``) at ``~/.config/pixelblaze/compiler_cache/<ver>.js``
(``AppData/Local/pixelblaze/compiler_cache`` on Windows) the first time
``compilePattern(..., allow_cache=True)`` runs against real hardware — that's
what ``pb fetch-compiler`` triggers. Once cached, this module compiles
patterns to device bytecode with no device on the network at all: it evals the
cached compiler in an embedded V8 (py-mini-racer, already a pixelblaze-client
dependency) and packs the result exactly like pixelblaze-client's
``compilePattern`` tail, so the blob is ready for ``sendPatternToRenderer``.

The compiler JS is Electromage's proprietary code: it lives only in the local
cache, never in this (public) repo.
"""

from __future__ import annotations

import sys
from pathlib import Path


class CompileError(Exception):
    """Compilation failed. When the cached compiler itself rejected the
    source, the message is the compiler's own, in the form
    ``"<description> at line N column M"``."""


def compiler_cache_dir() -> Path:
    """Where pixelblaze-client caches device compilers (platform-dependent)."""
    if sys.platform == "win32":
        return Path.home() / "AppData" / "Local" / "pixelblaze" / "compiler_cache"
    return Path.home() / ".config" / "pixelblaze" / "compiler_cache"


def find_cached_compiler(version: str | None = None) -> Path | None:
    """Path to a cached compiler JS, or None if not cached.

    With ``version`` (e.g. ``"3.51"``), only that exact version qualifies.
    Otherwise the newest cached version wins, compared numerically the way
    the firmware does (versions are decimal floats: 3.51 > 3.40).
    """
    cache_dir = compiler_cache_dir()
    if version is not None:
        path = cache_dir / f"{version}.js"
        return path if path.is_file() else None
    if not cache_dir.is_dir():
        return None
    candidates = []
    for path in cache_dir.glob("*.js"):
        try:
            candidates.append((float(path.stem), path))
        except ValueError:
            continue  # not a version-named file; ignore
    if not candidates:
        return None
    return max(candidates)[1]


def compile_pattern(source: str, version: str | None = None) -> bytes:
    """Compile pattern source offline; return packed bytecode ready for
    ``Pixelblaze.sendPatternToRenderer``.

    Raises CompileError if no compiler is cached (naming ``pb
    fetch-compiler``) or if the compiler rejects the source (carrying the
    compiler's own line/column message).
    """
    compiler_path = find_cached_compiler(version)
    if compiler_path is None:
        wanted = f"version {version} of the compiler" if version else "a compiler"
        raise CompileError(
            f"no cached PixelBlaze compiler: {wanted} was not found in "
            f"{compiler_cache_dir()}. Run `pb fetch-compiler` once with a real "
            "device on the LAN to populate it."
        )

    from py_mini_racer import MiniRacer

    ctx = MiniRacer()
    ctx.eval(compiler_path.read_text())
    result = ctx.call("compilePattern", source)
    if result["status"] != "OK":
        raise CompileError(result["status"])

    program = result["program"]

    # Pack the blob exactly like pixelblaze-client's compilePattern tail:
    # uint32-LE opcodes-section size, uint32-LE exports-section size, then the
    # int32-LE opcodes, then the exports table (uint32-LE address + ASCII
    # name + NUL per entry).
    export_size = 0
    for symbol in program["exports"]:
        export_size += 4 + len(symbol["name"]) + 1

    bytecode = int.to_bytes(4 * len(program["compiled"]), 4, "little")
    bytecode += int.to_bytes(export_size, 4, "little")
    for opcode in program["compiled"]:
        bytecode += int.to_bytes(int(opcode), 4, "little", signed=True)
    for symbol in program["exports"]:
        bytecode += int.to_bytes(int(symbol["address"]), 4, "little")
        bytecode += bytes(symbol["name"], "ascii") + b"\x00"
    return bytecode
