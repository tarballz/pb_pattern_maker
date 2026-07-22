"""Device-filesystem mirror for fakeblaze.

Everything lives under one data directory (default `pattern_maker/.fakeblaze/`,
gitignored — never commit its contents, see the top-level module docstring in
protocol.py for why), addressed with the same virtual path scheme PixelBlaze's
HTTP filesystem API uses: paths always start with "/", e.g. "/p/<id>",
"/p/<id>.c", "/config.json", "/index.html.gz". That symmetry is deliberate —
server.py's HTTP handlers for `/list`, `GET /<path>`, `POST /edit`, and
`GET /delete` can be thin passthroughs onto this class.

PBP (Pixelblaze Binary Pattern) parsing reuses pixelblaze-client's own PBP
class rather than reimplementing it — see protocol.py's module docstring for
why that class was deemed sufficient as-is.
"""

from __future__ import annotations

import json
from pathlib import Path, PurePosixPath

from pixelblaze.pixelblaze import PBP


class PathSecurityError(ValueError):
    pass


class Storage:
    def __init__(self, data_dir: str | Path):
        self.root = Path(data_dir)
        self.root.mkdir(parents=True, exist_ok=True)
        (self.root / "p").mkdir(exist_ok=True)

    def _resolve(self, virtual_path: str) -> Path:
        if not virtual_path.startswith("/"):
            raise PathSecurityError(f"virtual path must start with '/': {virtual_path!r}")
        relative = PurePosixPath(virtual_path.lstrip("/"))
        if ".." in relative.parts:
            raise PathSecurityError(f"path traversal not allowed: {virtual_path!r}")
        root = self.root.resolve()
        resolved = (root / relative).resolve()
        if resolved != root and root not in resolved.parents:
            raise PathSecurityError(f"path escapes data dir: {virtual_path!r}")
        return resolved

    # --- generic virtual filesystem, mirrors the device's HTTP file API ---

    def list_files(self) -> list[tuple[str, int]]:
        """``[(virtual_path, size_bytes), ...]`` sorted by path — matches the
        device's ``/list`` response shape (tab-separated lines)."""
        entries = []
        for path in self.root.rglob("*"):
            if path.is_file():
                virtual = "/" + path.relative_to(self.root).as_posix()
                entries.append((virtual, path.stat().st_size))
        entries.sort()
        return entries

    def read_file(self, virtual_path: str) -> bytes | None:
        path = self._resolve(virtual_path)
        if not path.is_file():
            return None
        return path.read_bytes()

    def write_file(self, virtual_path: str, data: bytes) -> None:
        path = self._resolve(virtual_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def delete_file(self, virtual_path: str) -> bool:
        path = self._resolve(virtual_path)
        if not path.is_file():
            return False
        path.unlink()
        return True

    # --- pattern-specific helpers (websocket commands work in pattern IDs) ---

    def save_pattern(self, pattern_id: str, pbp_bytes: bytes) -> None:
        self.write_file(f"/p/{pattern_id}", pbp_bytes)

    def load_pattern_bytes(self, pattern_id: str) -> bytes | None:
        return self.read_file(f"/p/{pattern_id}")

    def load_pattern(self, pattern_id: str) -> PBP | None:
        data = self.load_pattern_bytes(pattern_id)
        if data is None:
            return None
        return PBP.fromBytes(pattern_id, data)

    def delete_pattern(self, pattern_id: str) -> bool:
        deleted = self.delete_file(f"/p/{pattern_id}")
        self.delete_file(f"/p/{pattern_id}.c")  # controls file is optional
        return deleted

    def save_controls(self, pattern_id: str, controls: dict) -> None:
        self.write_file(f"/p/{pattern_id}.c", json.dumps(controls).encode("utf-8"))

    def load_controls(self, pattern_id: str) -> dict | None:
        data = self.read_file(f"/p/{pattern_id}.c")
        if data is None:
            return None
        return json.loads(data)

    def list_patterns(self) -> dict[str, str]:
        """``{patternId: name}`` for every stored pattern. Entries that fail to
        parse as a PBP blob are skipped rather than raising."""
        patterns = {}
        for virtual_path, _size in self.list_files():
            if not virtual_path.startswith("/p/") or virtual_path.endswith(".c"):
                continue
            pattern_id = virtual_path.removeprefix("/p/")
            data = self.read_file(virtual_path)
            try:
                patterns[pattern_id] = PBP.fromBytes(pattern_id, data).name
            except Exception:
                continue
        return patterns

    # --- device config ---

    def get_config(self, default: dict) -> dict:
        data = self.read_file("/config.json")
        if data is None:
            return dict(default)
        return json.loads(data)

    def save_config(self, config: dict) -> None:
        self.write_file("/config.json", json.dumps(config).encode("utf-8"))

    # --- optional seeded compiler webUI (for `pb fetch-compiler --seed-fakeblaze`) ---

    def seeded_webui(self) -> bytes | None:
        return self.read_file("/index.html.gz")

    def seed_webui(self, gz_bytes: bytes) -> None:
        self.write_file("/index.html.gz", gz_bytes)

    def seeded_version(self) -> str | None:
        """The firmware version string the seeded webUI compiler was pulled
        from (`ver.txt`, written alongside it) — NOT part of the device's own
        virtual filesystem, so it lives outside `_resolve`'s address space."""
        ver_file = self.root / "ver.txt"
        if not ver_file.is_file():
            return None
        return ver_file.read_text().strip()
