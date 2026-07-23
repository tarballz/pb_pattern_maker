"""Synchronous facade over the node render worker child process.

`RenderWorker` drives ``render_worker.mjs`` (JSON-lines RPC over stdin/stdout)
and shields the caller from every failure mode of the child:

- **Bounded latency**: no call blocks longer than its timeout (default 0.5 s
  — the real pixelblaze-client times out at 1 s). On timeout the cached
  last-good value is returned (last frame, last vars) instead of raising.
- **Crash recovery**: a dead child is restarted in a *background* thread —
  the interrupted call returns its cached value immediately — and the map
  plus the last-good pattern (and its vars/controls) are replayed before the
  new child is put back into service.
- **Degraded mode**: more than 3 restarts within 30 s, or node/emulator
  missing at start(), flips ``degraded`` — no more restarts, black frames of
  the right length, so the fakeblaze protocol stays serveable with no
  rendering at all (the server reports ``vmerr:1`` from the flag).

Threading model: designed for ONE caller thread (fakeblaze's asyncio loop
calls it via an executor). The only internal concurrency is the stdout
reader thread and the background restart thread; state handed between them
is guarded by ``_proc_lock``. Multiple concurrent *caller* threads are not
supported — replies would be delivered to the wrong caller.
"""

from __future__ import annotations

import itertools
import json
import os
import shutil
import subprocess
import threading
import time
from base64 import b64decode
from collections import deque
from pathlib import Path
from queue import Empty, Queue

WORKER_MJS = Path(__file__).resolve().parent / "render_worker.mjs"
DEFAULT_EMULATOR_ROOT = Path.home() / "code/pb/pixelblaze-pattern-emulator"

_EOF = object()  # reader-thread sentinel: child's stdout closed


class RenderWorkerError(RuntimeError):
    pass


def _fallback_pixel_count(map_path: str | Path) -> int | None:
    """Best-effort pixel count without node, so degraded mode can serve black
    frames of the right length. Mirrors the emulator's parsers: marimapper
    CSV -> max(index)+1 (indices are sparse in real scans, so row-counting
    would undercount), JSON array -> len. JS mapper functions need node."""
    try:
        text = Path(map_path).read_text()
    except OSError:
        return None
    stripped = text.strip()
    if stripped.startswith("["):
        try:
            return len(json.loads(stripped))
        except ValueError:
            return None
    lines = stripped.splitlines()
    if lines and lines[0].lower().replace(" ", "").startswith("index,"):
        max_index = -1
        for line in lines[1:]:
            head = line.split(",", 1)[0].strip()
            try:
                index = int(head)
            except ValueError:
                continue
            max_index = max(max_index, index)
        return max_index + 1 if max_index >= 0 else None
    return None


class RenderWorker:
    RESTART_WINDOW_S = 30.0
    MAX_RESTARTS_IN_WINDOW = 3

    def __init__(self, map_path: str | Path, emulator_root: str | Path | None = None,
                 node: str = "node", timeout: float = 0.5, start_timeout: float = 15.0):
        self.map_path = Path(map_path)
        self.node = node
        self.emulator_root = Path(
            emulator_root or os.environ.get("PB_EMU_ROOT") or DEFAULT_EMULATOR_ROOT
        )
        self.timeout = timeout
        self.start_timeout = start_timeout
        self.pixel_count = _fallback_pixel_count(self.map_path) or 0
        self.map_dim: int | None = None
        self.degraded = False
        self.last_error: str | None = None

        self._proc: subprocess.Popen | None = None
        self._responses: Queue | None = None
        self._proc_lock = threading.Lock()
        self._restart_lock = threading.Lock()
        self._restarting = False
        self._restart_times: deque[float] = deque()
        self._ids = itertools.count(1)
        self._started = False

        self.last_frame_nan = 0  # NaN channel-values in the most recent frame

        self._last_frame: bytes | None = None
        self._last_vars: dict = {}
        self._last_pattern: tuple[str, str] | None = None  # (source, name)
        self._last_set_vars: dict = {}
        self._last_controls: dict = {}

    # -- lifecycle -----------------------------------------------------------

    def start(self) -> "RenderWorker":
        self._started = True
        if shutil.which(self.node) is None:
            self._degrade(f"node executable not found: {self.node!r}")
            return self
        if not (self.emulator_root / "src/vm/index.js").exists():
            self._degrade(
                f"emulator checkout not found at {self.emulator_root} (set PB_EMU_ROOT)"
            )
            return self
        try:
            proc, responses = self._spawn()
        except OSError as err:
            self._degrade(f"could not start render worker: {err}")
            return self
        resp = self._rpc_on(proc, responses,
                            {"cmd": "loadMap", "path": str(self.map_path)},
                            self.start_timeout)
        if resp is None:
            proc.kill()
            self._degrade("render worker did not answer loadMap")
            return self
        if not resp.get("ok"):
            proc.kill()
            raise RenderWorkerError(f"loadMap failed: {resp.get('error')}")
        self.pixel_count = resp["pixelCount"]
        self.map_dim = resp.get("dim")
        with self._proc_lock:
            self._proc, self._responses = proc, responses
        return self

    def stop(self) -> None:
        self._started = False
        with self._proc_lock:
            proc, self._proc = self._proc, None
            self._responses = None
        if proc is not None:
            try:
                proc.stdin.close()  # worker exits cleanly on stdin EOF
            except OSError:
                pass
            try:
                proc.wait(timeout=2)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()

    def __enter__(self) -> "RenderWorker":
        return self.start()

    def __exit__(self, *exc) -> None:
        self.stop()

    # -- RPC methods ---------------------------------------------------------

    def load_pattern(self, source: str, name: str = "", timeout: float | None = None) -> dict:
        if self.degraded:
            return {"ok": False, "error": self.last_error or "render worker degraded"}
        resp = self._rpc({"cmd": "loadPattern", "source": source, "name": name}, timeout)
        if resp is None:
            return {"ok": False, "error": "render worker timed out loading pattern"}
        if resp.get("ok"):
            self._last_pattern = (source, name)
            self._last_vars = dict(resp.get("vars", {}))
            self._last_set_vars = {}
            self._last_controls = {}
        return resp

    def frame(self, delta_ms: float = 16.7, timeout: float | None = None) -> bytes:
        if not self.degraded:
            resp = self._rpc({"cmd": "frame", "deltaMs": delta_ms}, timeout)
            if resp is not None and resp.get("ok"):
                rgb = b64decode(resp["rgb"])
                self._last_frame = rgb
                self.last_frame_nan = int(resp.get("nan", 0))
                return rgb
            if self._last_frame is not None:
                return self._last_frame
        return bytes(self.pixel_count * 3)

    def get_vars(self, timeout: float | None = None) -> dict:
        if not self.degraded:
            resp = self._rpc({"cmd": "getVars"}, timeout)
            if resp is not None and resp.get("ok"):
                self._last_vars = dict(resp.get("vars", {}))
        return dict(self._last_vars)

    def set_vars(self, variables: dict, timeout: float | None = None) -> bool:
        self._last_set_vars.update(variables)
        self._last_vars.update(variables)  # keep the cache honest on timeout
        if self.degraded:
            return False
        resp = self._rpc({"cmd": "setVars", "vars": variables}, timeout)
        return bool(resp and resp.get("ok"))

    def set_controls(self, controls: dict, timeout: float | None = None) -> bool:
        self._last_controls.update(controls)
        if self.degraded:
            return False
        resp = self._rpc({"cmd": "setControls", "controls": controls}, timeout)
        return bool(resp and resp.get("ok"))

    def ping(self, timeout: float | None = None) -> bool:
        if self.degraded:
            return False
        resp = self._rpc({"cmd": "ping"}, timeout)
        return bool(resp and resp.get("ok"))

    # -- child process plumbing ----------------------------------------------

    def _spawn(self) -> tuple[subprocess.Popen, Queue]:
        env = dict(os.environ, PB_EMU_ROOT=str(self.emulator_root))
        proc = subprocess.Popen(
            [self.node, str(WORKER_MJS)],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=None,
            env=env,
        )
        responses: Queue = Queue()
        threading.Thread(target=self._read_loop, args=(proc, responses),
                         daemon=True, name="renderworker-reader").start()
        return proc, responses

    def _read_loop(self, proc: subprocess.Popen, responses: Queue) -> None:
        for line in proc.stdout:
            try:
                responses.put(json.loads(line))
            except ValueError:
                continue  # not protocol json; ignore
        responses.put(_EOF)

    def _rpc(self, request: dict, timeout: float | None = None) -> dict | None:
        """Send on the *published* child; None on timeout/crash (never raises)."""
        with self._proc_lock:
            proc, responses = self._proc, self._responses
        if proc is None or proc.poll() is not None:
            self._schedule_restart()
            return None
        return self._rpc_on(proc, responses, request, timeout)

    def _rpc_on(self, proc: subprocess.Popen, responses: Queue,
                request: dict, timeout: float | None) -> dict | None:
        timeout = self.timeout if timeout is None else timeout
        rpc_id = next(self._ids)
        payload = dict(request, id=rpc_id)
        try:
            proc.stdin.write((json.dumps(payload) + "\n").encode())
            proc.stdin.flush()
        except OSError:
            self._schedule_restart()
            return None
        deadline = time.monotonic() + timeout
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                return None
            try:
                resp = responses.get(timeout=remaining)
            except Empty:
                return None
            if resp is _EOF:
                self._schedule_restart()
                return None
            if isinstance(resp, dict) and resp.get("id") == rpc_id:
                return resp
            # else: stale reply from an earlier timed-out request — drop it.

    # -- crash recovery ------------------------------------------------------

    def _degrade(self, reason: str) -> None:
        self.degraded = True
        self.last_error = reason

    def _schedule_restart(self) -> None:
        if self.degraded or not self._started:
            return
        with self._restart_lock:
            if self._restarting or self.degraded:
                return
            now = time.monotonic()
            while self._restart_times and now - self._restart_times[0] > self.RESTART_WINDOW_S:
                self._restart_times.popleft()
            if len(self._restart_times) >= self.MAX_RESTARTS_IN_WINDOW:
                self._degrade(
                    f"render worker crashed >{self.MAX_RESTARTS_IN_WINDOW} times in "
                    f"{self.RESTART_WINDOW_S:.0f}s; degraded to black frames"
                )
                return
            self._restart_times.append(now)
            self._restarting = True
        threading.Thread(target=self._restart, daemon=True,
                         name="renderworker-restart").start()

    def _restart(self) -> None:
        """Background restart: replace the dead child, replay map + last-good
        pattern state, and only then publish the new child for _rpc use. The
        caller thread keeps getting cached values in the meantime."""
        try:
            with self._proc_lock:
                old, self._proc = self._proc, None
                self._responses = None
            if old is not None:
                old.kill()
                try:
                    old.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    pass
            try:
                proc, responses = self._spawn()
            except OSError as err:
                self._degrade(f"could not restart render worker: {err}")
                return
            resp = self._rpc_on(proc, responses,
                                {"cmd": "loadMap", "path": str(self.map_path)},
                                self.start_timeout)
            if resp is None or not resp.get("ok"):
                proc.kill()
                # Try again (budget-limited by _schedule_restart) on the next
                # caller RPC, which will see _proc None.
                return
            if self._last_pattern is not None:
                source, name = self._last_pattern
                loaded = self._rpc_on(proc, responses,
                                      {"cmd": "loadPattern", "source": source, "name": name},
                                      self.start_timeout)
                if loaded is not None and loaded.get("ok"):
                    if self._last_controls:
                        self._rpc_on(proc, responses,
                                     {"cmd": "setControls", "controls": dict(self._last_controls)},
                                     self.timeout)
                    if self._last_set_vars:
                        self._rpc_on(proc, responses,
                                     {"cmd": "setVars", "vars": dict(self._last_set_vars)},
                                     self.timeout)
            with self._proc_lock:
                self._proc, self._responses = proc, responses
        finally:
            self._restarting = False
