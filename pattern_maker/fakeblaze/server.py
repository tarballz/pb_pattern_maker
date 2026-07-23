"""The fakeblaze server: makes pixelblaze-client believe it is on the LAN.

Two layers:

- ``FakeBlazeServer`` — pure asyncio. Owns the websocket (:81 ``/``) and HTTP
  (:80 file API) aiohttp apps, the render/stats/discovery background tasks,
  and the protocol dispatch. Testable on arbitrary ports with aiohttp's test
  utilities; never blocks its loop on the render worker (all RenderWorker
  calls — which are synchronous but bounded at ~500 ms — go through a
  single-thread executor, matching RenderWorker's one-caller-thread contract).
- ``FakeBlaze`` — synchronous facade running that loop in a daemon thread.
  ``start()`` returns only once both listeners are bound (tests never race),
  ``stop()`` shuts down cleanly, and ``with FakeBlaze(...) as fb`` works.

The wire behavior here follows the protocol contract verified against real
hardware (firmware 3.51) on 2026-07-21 — see
docs/superpowers/plans/2026-07-21-fakeblaze-hardware-optional-plan.md, Part 2
"Protocol musts". Contract points that are easy to get wrong:

- ``getConfig`` answers with THREE frames (config JSON, sequencer JSON, binary
  type-9 expander) — omitting the third costs the client a 1 s timeout on
  every config call.
- Incoming putSourceCode/putByteCode binary is acked per CHUNK, not per
  message — the client blocks on each chunk's ack.
- ``setVars`` and ``deleteProgram`` get NO reply (the client never waits).
- putByteCode stores nothing: bytecode is firmware-executable only, so the
  last source-bearing pattern keeps rendering and the served config JSON
  carries a note instead.
"""

from __future__ import annotations

import asyncio
import json
import logging
import socket
import struct
import threading
import time
import urllib.parse
import zlib
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from aiohttp import WSMsgType, web

from . import protocol
from .renderworker import RenderWorker, RenderWorkerError
from .storage import PathSecurityError, Storage

logger = logging.getLogger("fakeblaze")

DEFAULT_DATA_DIR = Path(__file__).resolve().parent.parent / ".fakeblaze"
PLACEHOLDER_JPEG = Path(__file__).resolve().parent / "assets" / "preview.jpg"
DEFAULT_VERSION = "3.51"

ACK = '{"ack":1}'
ACTIVE_FPS = 40.0  # while any connection has sendUpdates on
IDLE_FPS = 5.0     # keeps pattern time advancing between viewers
STORAGE_SIZE = 2 * 1024 * 1024  # flash size reported in stats, like a PB3


def _pbp_source_region(pbp_bytes: bytes) -> bytes:
    """The raw lzstring source blob inside a PBP — exactly what a real device
    answers ``getSources`` with (the client decompresses it itself)."""
    if len(pbp_bytes) < 36:
        return b""
    offsets = struct.unpack("<9I", pbp_bytes[:36])
    return pbp_bytes[offsets[7]:offsets[7] + offsets[8]]


class _Connection:
    """Per-websocket state: preview streaming flag, chunk reassembly, and the
    setCode header announced before a putByteCode upload."""

    def __init__(self, ws: web.WebSocketResponse):
        self.ws = ws
        # Preview streaming defaults ON, like real firmware: the client's
        # getPreviewFrame() never sends {"sendUpdates":true} first, and its
        # receive loop can't time out while the 1 Hz stats push keeps the
        # socket chatty — so frames-off-by-default would hang it forever.
        # {"sendUpdates":false} opts a connection out.
        self.send_updates = True
        self.reassemblers: dict[int, protocol.Reassembler] = {}
        self.pending_setcode: dict | None = None


class FakeBlazeServer:
    def __init__(self, storage: Storage, worker: RenderWorker, *,
                 ver: str = DEFAULT_VERSION, name: str = "fakeblaze",
                 chip_id: int | None = None):
        self.storage = storage
        self.worker = worker
        self.ver = ver
        self.name = name
        self.chip_id = chip_id if chip_id is not None else (
            zlib.crc32(str(storage.root).encode()) & 0xFFFFFFFF)
        self.connections: set[_Connection] = set()
        self.active_id = ""
        self.active_name = ""
        self.bytecode_note: str | None = None  # last putByteCode id (not rendered)
        try:
            self.placeholder_jpeg = PLACEHOLDER_JPEG.read_bytes()
        except OSError:
            self.placeholder_jpeg = b""
        # RenderWorker supports exactly one caller thread -> one-lane executor.
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="fakeblaze-worker")
        self._tasks: list[asyncio.Task] = []
        self._started_at = time.monotonic()
        self._frames_rendered = 0
        self._fps = 0.0
        self._last_frame_at: float | None = None

    async def _call(self, fn, *args):
        """Run a RenderWorker call off-loop (bounded at ~500 ms internally)."""
        return await asyncio.get_running_loop().run_in_executor(self._executor, fn, *args)

    # -- aiohttp apps --------------------------------------------------------

    def ws_app(self) -> web.Application:
        app = web.Application()
        app.router.add_get("/", self._ws_handler)
        return app

    def http_app(self) -> web.Application:
        app = web.Application()
        app.router.add_get("/list", self._http_list)
        app.router.add_post("/edit", self._http_edit)
        app.router.add_get("/delete", self._http_delete)
        app.router.add_get("/{tail:.*}", self._http_get_file)
        return app

    # -- background tasks ----------------------------------------------------

    def start_background(self, *, discovery: bool = True) -> None:
        loop = asyncio.get_running_loop()
        self._started_at = time.monotonic()
        self._tasks = [
            loop.create_task(self._render_loop(), name="fakeblaze-render"),
            loop.create_task(self._stats_loop(), name="fakeblaze-stats"),
        ]
        if discovery:
            self._tasks.append(loop.create_task(self._beacon_loop(), name="fakeblaze-beacon"))

    async def stop_background(self) -> None:
        for task in self._tasks:
            task.cancel()
        for task in self._tasks:
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass
        self._tasks = []
        for conn in list(self.connections):
            try:
                await conn.ws.close()
            except Exception:
                pass
        self._executor.shutdown(wait=False)

    async def _render_frame(self) -> bytes:
        now = time.monotonic()
        delta_ms = 16.7 if self._last_frame_at is None else (now - self._last_frame_at) * 1000.0
        self._last_frame_at = now
        rgb = await self._call(self.worker.frame, delta_ms)
        self._frames_rendered += 1
        return rgb

    async def _render_loop(self) -> None:
        while True:
            watchers = [c for c in self.connections if c.send_updates]
            interval = 1.0 / (ACTIVE_FPS if watchers else IDLE_FPS)
            started = time.monotonic()
            rgb = await self._render_frame()
            if watchers:
                frame = protocol.build_preview_frame(rgb)
                for conn in watchers:
                    try:
                        await conn.ws.send_bytes(frame)
                    except (ConnectionError, RuntimeError):
                        pass  # connection is closing; the ws handler cleans up
            await asyncio.sleep(max(0.0, interval - (time.monotonic() - started)))

    async def _stats_loop(self) -> None:
        previous = self._frames_rendered
        while True:
            await asyncio.sleep(1.0)
            self._fps = float(self._frames_rendered - previous)
            previous = self._frames_rendered
            text = self.stats_json()
            for conn in list(self.connections):
                try:
                    await conn.ws.send_str(text)
                except (ConnectionError, RuntimeError):
                    pass

    async def _beacon_loop(self) -> None:
        """Discovery beacon, unicast to loopback (broadcast doesn't reach
        listeners bound on 0.0.0.0:1889 on macOS)."""
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            while True:
                now_ms = int(time.time() * 1000) % 0xFFFFFFFF
                packet = struct.pack("<LLL", 42, self.chip_id, now_ms)
                try:
                    sock.sendto(packet, ("127.0.0.1", 1889))
                except OSError:
                    pass  # nobody listening is fine
                await asyncio.sleep(1.0)
        finally:
            sock.close()

    # -- JSON documents ------------------------------------------------------

    def config_json(self) -> str:
        extra = {}
        if self.bytecode_note:
            extra["fbBytecodeOnly"] = self.bytecode_note
        return protocol.build_config_json(
            name=self.name, pixel_count=self.worker.pixel_count,
            version=self.ver, chip_id=self.chip_id, **extra)

    def sequencer_json(self) -> str:
        controls = self.storage.load_controls(self.active_id) or {} if self.active_id else {}
        return protocol.build_sequencer_json(
            active_program_id=self.active_id, name=self.active_name, controls=controls)

    def stats_json(self) -> str:
        used = sum(size for _path, size in self.storage.list_files())
        return protocol.build_stats_json(
            fps=self._fps, vmerr=1 if self.worker.degraded else 0,
            uptime=int((time.monotonic() - self._started_at) * 1000),
            storage_used=used, storage_size=STORAGE_SIZE)

    # -- pattern activation --------------------------------------------------

    async def activate_pattern(self, pattern_id: str) -> bool:
        """Load a stored pattern into the render worker and make it active."""
        pbp = self.storage.load_pattern(pattern_id)
        if pbp is None:
            logger.warning("activeProgramId %r: no such stored pattern", pattern_id)
            return False
        try:
            source = json.loads(pbp.sourceCode).get("main", "")
        except (ValueError, AttributeError):
            logger.warning("pattern %r has no parseable source; not switching", pattern_id)
            return False
        name = pbp.name
        result = await self._call(self.worker.load_pattern, source, name)
        if not result.get("ok"):
            logger.warning("render worker rejected pattern %r: %s", pattern_id, result.get("error"))
        controls = self.storage.load_controls(pattern_id)
        if controls:
            await self._call(self.worker.set_controls, controls)
        self.active_id, self.active_name = pattern_id, name
        return True

    # -- websocket -----------------------------------------------------------

    async def _ws_handler(self, request: web.Request) -> web.WebSocketResponse:
        ws = web.WebSocketResponse()
        await ws.prepare(request)
        conn = _Connection(ws)
        self.connections.add(conn)
        try:
            async for msg in ws:
                if msg.type == WSMsgType.TEXT:
                    await self._handle_text(conn, msg.data)
                elif msg.type == WSMsgType.BINARY:
                    await self._handle_binary(conn, msg.data)
        finally:
            self.connections.discard(conn)
        return ws

    async def _handle_text(self, conn: _Connection, text: str) -> None:
        try:
            msg = json.loads(text)
        except ValueError:
            logger.warning("ignoring unparseable text frame: %.80s", text)
            return
        if not isinstance(msg, dict):
            return

        if "getConfig" in msg:
            # THREE frames, verified order: config, sequencer, expander.
            await conn.ws.send_str(self.config_json())
            await conn.ws.send_str(self.sequencer_json())
            await conn.ws.send_bytes(protocol.build_expander_frame())
        elif "ping" in msg:
            await conn.ws.send_str(ACK)
        elif "getVars" in msg:
            variables = await self._call(self.worker.get_vars)
            await conn.ws.send_str(json.dumps({"vars": variables}, separators=(",", ":")))
        elif "setVars" in msg:
            await self._call(self.worker.set_vars, dict(msg["setVars"]))  # no reply
        elif "deleteProgram" in msg:
            self.storage.delete_pattern(str(msg["deleteProgram"]))  # no reply
        elif "listPrograms" in msg:
            patterns = sorted(self.storage.list_patterns().items())
            for frame in protocol.build_program_list_frames(patterns):
                await conn.ws.send_bytes(frame)
        elif "getSources" in msg:
            blob = self.storage.load_pattern_bytes(str(msg["getSources"])) or b""
            for frame in protocol.build_source_code_frames(_pbp_source_region(blob)):
                await conn.ws.send_bytes(frame)
        elif "getPreviewImg" in msg:
            pbp = self.storage.load_pattern(str(msg["getPreviewImg"]))
            jpeg = (pbp.jpeg if pbp is not None else b"") or self.placeholder_jpeg
            for frame in protocol.build_preview_image_frames(jpeg):
                await conn.ws.send_bytes(frame)
        elif "activeProgramId" in msg:
            await self.activate_pattern(str(msg["activeProgramId"]))
            # The client blocks on the sequencer JSON even if the switch failed.
            await conn.ws.send_str(self.sequencer_json())
        elif "setControls" in msg:
            controls = dict(msg["setControls"])
            await self._call(self.worker.set_controls, controls)
            if msg.get("save") and self.active_id:
                self.storage.save_controls(self.active_id, controls)
            await conn.ws.send_str(ACK)
        elif "sendUpdates" in msg:
            conn.send_updates = bool(msg["sendUpdates"])
            if conn.send_updates:
                # The client blocks until the first frame arrives.
                rgb = await self._render_frame()
                await conn.ws.send_bytes(protocol.build_preview_frame(rgb))
        elif "setCode" in msg:
            # {"pause":true,"setCode":{size,crc,name,id}} — one ack for the pair.
            conn.pending_setcode = dict(msg["setCode"])
            await conn.ws.send_str(ACK)
        elif "pause" in msg:
            await conn.ws.send_str(ACK)
        # Anything else (brightness, sequencer knobs, ...) is fire-and-forget.

    async def _handle_binary(self, conn: _Connection, data: bytes) -> None:
        if not data:
            return
        frame_type = data[0]
        if frame_type not in (protocol.MessageType.PUT_SOURCE_CODE,
                              protocol.MessageType.PUT_BYTE_CODE):
            logger.warning("ignoring unexpected binary frame type %d", frame_type)
            return
        reassembler = conn.reassemblers.setdefault(
            frame_type, protocol.Reassembler(protocol.MessageType(frame_type)))
        try:
            complete = reassembler.feed(data)
        except protocol.FrameReassemblyError as err:
            logger.warning("dropping malformed binary sequence: %s", err)
            conn.reassemblers.pop(frame_type, None)
            return
        # The client blocks per chunk — ack EVERY one, not just the last.
        await conn.ws.send_str(ACK)
        if complete is None:
            return
        conn.reassemblers.pop(frame_type, None)
        if frame_type == protocol.MessageType.PUT_SOURCE_CODE:
            await self._finish_put_source(complete)
        else:
            self._finish_put_bytecode(conn, complete)

    async def _finish_put_source(self, payload: bytes) -> None:
        """putSourceCode payload: 17-byte pattern id + PBP blob. Store it and
        make it the active rendered pattern."""
        if len(payload) < 17 + 36:
            logger.warning("putSourceCode payload too short (%d bytes); dropped", len(payload))
            return
        pattern_id = payload[:17].decode("utf-8", "replace")
        self.storage.save_pattern(pattern_id, payload[17:])
        self.bytecode_note = None  # a source-bearing pattern is rendering again
        await self.activate_pattern(pattern_id)
        logger.info("putSourceCode: saved and activated %s (%s)", pattern_id, self.active_name)

    def _finish_put_bytecode(self, conn: _Connection, payload: bytes) -> None:
        """putByteCode is firmware-executable only — verify, log, store NOTHING;
        the last source-bearing pattern keeps rendering (noted in config JSON)."""
        expected = conn.pending_setcode or {}
        conn.pending_setcode = None
        crc = zlib.crc32(payload) & 0xFFFFFFFF
        if "crc" in expected and expected["crc"] != crc:
            logger.warning("putByteCode crc mismatch: announced %s, computed %s",
                           expected["crc"], crc)
        if "size" in expected and expected["size"] != len(payload):
            logger.warning("putByteCode size mismatch: announced %s, received %d",
                           expected["size"], len(payload))
        self.bytecode_note = str(expected.get("id") or "unidentified")
        logger.info(
            "putByteCode: %d bytes accepted but not rendered (fakeblaze runs source, "
            "not bytecode); still rendering %s", len(payload), self.active_id or "<nothing>")

    # -- HTTP file API -------------------------------------------------------

    async def _http_list(self, request: web.Request) -> web.Response:
        lines = "".join(f"{path}\t{size}\n" for path, size in self.storage.list_files())
        return web.Response(text=lines, content_type="text/plain")

    async def _http_get_file(self, request: web.Request) -> web.Response:
        virtual_path = "/" + request.match_info["tail"]
        try:
            data = self.storage.read_file(virtual_path)
        except PathSecurityError:
            raise web.HTTPNotFound
        if data is None:
            raise web.HTTPNotFound
        # Verbatim bytes — pixelblaze-client gunzips /index.html.gz itself.
        return web.Response(body=data, content_type="application/octet-stream")

    async def _http_edit(self, request: web.Request) -> web.Response:
        reader = await request.multipart()
        wrote = False
        async for part in reader:
            if part.name != "data":
                continue
            # pixelblaze-client (via requests) sends the target path raw;
            # some clients percent-encode it. Device paths never contain a
            # literal '%', so unquoting handles both.
            target = urllib.parse.unquote(part.filename or "")
            body = await part.read(decode=False)
            try:
                self.storage.write_file(target, body)
                wrote = True
            except PathSecurityError:
                raise web.HTTPBadRequest(text=f"bad path: {target}")
        if not wrote:
            raise web.HTTPBadRequest(text="no 'data' part in form")
        return web.Response(text="OK")

    async def _http_delete(self, request: web.Request) -> web.Response:
        virtual_path = request.query.get("path", "")
        try:
            deleted = self.storage.delete_file(virtual_path)
        except PathSecurityError:
            raise web.HTTPNotFound
        if not deleted:
            raise web.HTTPNotFound
        return web.Response(text="OK")


class FakeBlaze:
    """Synchronous facade: the whole simulator behind start()/stop().

    ``start()`` spawns the render worker, binds both listeners on a loop in a
    daemon thread, and only returns once everything is actually bound (pass
    port 0 to get an ephemeral port; the real one is readable from
    ``ws_port``/``http_port`` afterwards).
    """

    def __init__(self, map_path: str | Path, *, data_dir: str | Path | None = None,
                 ws_port: int = 81, http_port: int = 80,
                 emulator_root: str | Path | None = None, ver: str | None = None,
                 no_discovery: bool = False, require_render: bool = False,
                 name: str = "fakeblaze", host: str = "0.0.0.0",
                 worker: RenderWorker | None = None):
        # Default host is the wildcard, not 127.0.0.1: macOS permits
        # unprivileged binds to ports <1024 only on INADDR_ANY.
        self.map_path = Path(map_path)
        self.data_dir = Path(data_dir) if data_dir is not None else DEFAULT_DATA_DIR
        self.ws_port = ws_port
        self.http_port = http_port
        self.emulator_root = emulator_root
        self.host = host
        self.name = name
        self.no_discovery = no_discovery
        self.require_render = require_render
        self._requested_ver = ver
        self._injected_worker = worker  # tests substitute a stub here
        self.storage: Storage | None = None
        self.worker: RenderWorker | None = None
        self.server: FakeBlazeServer | None = None
        self._loop: asyncio.AbstractEventLoop | None = None
        self._thread: threading.Thread | None = None
        self._ws_runner: web.AppRunner | None = None
        self._http_runner: web.AppRunner | None = None

    # -- lifecycle -----------------------------------------------------------

    def start(self) -> "FakeBlaze":
        self.storage = Storage(self.data_dir)
        self.worker = self._injected_worker or RenderWorker(
            self.map_path, emulator_root=self.emulator_root)
        if self._injected_worker is None:
            self.worker.start()
        if self.worker.degraded:
            if self.require_render:
                error = self.worker.last_error
                self.worker.stop()
                raise RenderWorkerError(f"--require-render: {error}")
            logger.warning("render worker degraded (%s); serving black frames",
                           self.worker.last_error)
        ver = self._requested_ver or self.storage.seeded_version() or DEFAULT_VERSION
        self.server = FakeBlazeServer(self.storage, self.worker, ver=ver, name=self.name)

        self._loop = asyncio.new_event_loop()
        self._thread = threading.Thread(target=self._run_loop, daemon=True,
                                        name="fakeblaze-loop")
        self._thread.start()
        try:
            asyncio.run_coroutine_threadsafe(self._startup(), self._loop).result(timeout=30)
        except BaseException:
            self._teardown_loop()
            self.worker.stop()
            raise
        return self

    def stop(self) -> None:
        if self._loop is not None and self._thread is not None and self._thread.is_alive():
            try:
                asyncio.run_coroutine_threadsafe(self._shutdown(), self._loop).result(timeout=10)
            except Exception:
                pass
            self._teardown_loop()
        if self.worker is not None:
            self.worker.stop()

    def __enter__(self) -> "FakeBlaze":
        return self.start()

    def __exit__(self, *exc) -> None:
        self.stop()

    def _run_loop(self) -> None:
        asyncio.set_event_loop(self._loop)
        self._loop.run_forever()

    def _teardown_loop(self) -> None:
        self._loop.call_soon_threadsafe(self._loop.stop)
        self._thread.join(timeout=5)
        if not self._thread.is_alive():
            self._loop.close()
        self._loop = None
        self._thread = None

    # -- loop-side setup/teardown --------------------------------------------

    async def _startup(self) -> None:
        self._ws_runner = web.AppRunner(self.server.ws_app(), access_log=None)
        await self._ws_runner.setup()
        ws_site = web.TCPSite(self._ws_runner, self.host, self.ws_port)
        await ws_site.start()
        self.ws_port = self._ws_runner.addresses[0][1]

        self._http_runner = web.AppRunner(self.server.http_app(), access_log=None)
        await self._http_runner.setup()
        http_site = web.TCPSite(self._http_runner, self.host, self.http_port)
        await http_site.start()
        self.http_port = self._http_runner.addresses[0][1]

        # Give a restarted fakeblaze something to render: the first stored
        # pattern by name, if any (matches a real device resuming after boot).
        patterns = self.storage.list_patterns()
        if patterns:
            first_id = min(patterns, key=lambda pid: (patterns[pid].lower(), pid))
            await self.server.activate_pattern(first_id)

        self.server.start_background(discovery=not self.no_discovery)

    async def _shutdown(self) -> None:
        await self.server.stop_background()
        if self._ws_runner is not None:
            await self._ws_runner.cleanup()
        if self._http_runner is not None:
            await self._http_runner.cleanup()
