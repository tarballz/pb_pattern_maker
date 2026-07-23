"""Unit tier for fakeblaze's server: drives the aiohttp apps on ephemeral test
ports (never 80/81) with a stub render worker, plus one facade round trip and
one degraded-mode run using the real RenderWorker with node deliberately
missing. The e2e tier against the real pixelblaze-client lives elsewhere.
"""

import asyncio
import json
import struct
import tempfile
import urllib.request
import zlib
from pathlib import Path

import pytest
from aiohttp import FormData, WSMsgType
from aiohttp.test_utils import TestClient, TestServer
from pixelblaze.pixelblaze import PBP

from fakeblaze import protocol
from fakeblaze.renderworker import RenderWorker
from fakeblaze.server import FakeBlaze, FakeBlazeServer, _pbp_source_region
from fakeblaze.storage import Storage

PATTERN_ID = "abcdefghijklmnopq"  # 17 chars, like a real client-generated id
RECV_TIMEOUT = 5.0


class StubWorker:
    """Duck-typed RenderWorker: synchronous, instant, no node required."""

    def __init__(self, pixel_count=4, degraded=False):
        self.pixel_count = pixel_count
        self.degraded = degraded
        self.last_error = "stub degraded" if degraded else None
        self.vars = {"speed": 0.5}
        self.controls = {}
        self.loaded = []

    def start(self):
        return self

    def stop(self):
        pass

    def frame(self, delta_ms=16.7):
        if self.degraded:
            return bytes(self.pixel_count * 3)
        return bytes([10, 20, 30]) * self.pixel_count

    def get_vars(self):
        return dict(self.vars)

    def set_vars(self, variables):
        self.vars.update(variables)
        return True

    def set_controls(self, controls):
        self.controls.update(controls)
        return True

    def load_pattern(self, source, name=""):
        self.loaded.append((source, name))
        return {"ok": True, "vars": dict(self.vars)}


def make_pbp_bytes(pattern_id: str, name: str, source: str) -> bytes:
    # Oracle: bytes exactly as pixelblaze-client's own PBP class produces them.
    pbp = PBP.fromComponents(pattern_id, name=name, previewImage=b"\xff\xd8\xff\xd9",
                             byteCode=b"\x00" * 8, sourceCode=source)
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "pattern"
        pbp.toFile(out)
        return out.with_suffix(".pbp").read_bytes()


def client_chunks(message_type: int, blob: bytes) -> list[bytes]:
    """Chunk exactly as pixelblaze-client's wsSendBinary does (1280 bytes)."""
    chunks = []
    for i in range(0, len(blob), 1280):
        flags = protocol.FRAME_FIRST if i == 0 else 0
        flags |= protocol.FRAME_LAST if len(blob) - i <= 1280 else protocol.FRAME_MIDDLE
        chunks.append(bytes([message_type, flags]) + blob[i:i + 1280])
    return chunks


def make_server(tmp_path, worker=None):
    storage = Storage(tmp_path / "data")
    return FakeBlazeServer(storage, worker or StubWorker(), ver="3.51", name="testblaze")


async def open_ws(server):
    client = TestClient(TestServer(server.ws_app()))
    await client.start_server()
    ws = await client.ws_connect("/")
    return client, ws


async def open_http(server):
    client = TestClient(TestServer(server.http_app()))
    await client.start_server()
    return client


def run(coro):
    return asyncio.run(coro)


# -- websocket: getConfig and key-order invariants ---------------------------

def test_get_config_sends_three_frames_in_order(tmp_path):
    async def scenario():
        server = make_server(tmp_path)
        client, ws = await open_ws(server)
        await ws.send_str('{"getConfig":true}')

        first = await ws.receive(timeout=RECV_TIMEOUT)
        assert first.type == WSMsgType.TEXT
        config = json.loads(first.data)
        assert config["name"] == "testblaze"
        assert config["pixelCount"] == 4
        assert config["ver"] == "3.51"

        second = await ws.receive(timeout=RECV_TIMEOUT)
        assert second.type == WSMsgType.TEXT
        assert second.data.startswith('{"activeProgram":')  # client keys off this prefix

        third = await ws.receive(timeout=RECV_TIMEOUT)
        assert third.type == WSMsgType.BINARY
        assert third.data == protocol.build_expander_frame()

        await client.close()
    run(scenario())


def test_stats_json_key_order_and_shape(tmp_path):
    server = make_server(tmp_path)
    stats = server.stats_json()
    assert stats.startswith('{"fps":')  # client keys off this prefix
    assert json.loads(stats)["vmerr"] == 0


def test_ping_acks_and_get_vars_round_trip(tmp_path):
    async def scenario():
        server = make_server(tmp_path)
        client, ws = await open_ws(server)

        await ws.send_str('{"ping":true}')
        reply = await ws.receive(timeout=RECV_TIMEOUT)
        assert reply.data == '{"ack":1}'

        await ws.send_str('{"getVars":true}')
        reply = await ws.receive(timeout=RECV_TIMEOUT)
        assert reply.data.startswith('{"vars":')
        assert json.loads(reply.data)["vars"] == {"speed": 0.5}

        await client.close()
    run(scenario())


# -- websocket: silent commands ----------------------------------------------

def test_set_vars_and_delete_program_produce_no_reply(tmp_path):
    async def scenario():
        worker = StubWorker()
        server = make_server(tmp_path, worker)
        server.storage.save_pattern("doomed", make_pbp_bytes("doomed", "Doomed", "x=1"))
        client, ws = await open_ws(server)

        await ws.send_str('{"setVars":{"speed":0.9}}')
        await ws.send_str('{"deleteProgram":"doomed"}')
        # A ping right after must be answered by the ping ack — nothing else
        # may be queued ahead of it.
        await ws.send_str('{"ping":true}')
        reply = await ws.receive(timeout=RECV_TIMEOUT)
        assert reply.data == '{"ack":1}'
        with pytest.raises(asyncio.TimeoutError):
            await ws.receive(timeout=0.2)

        assert worker.vars["speed"] == 0.9
        assert server.storage.load_pattern_bytes("doomed") is None
        await client.close()
    run(scenario())


# -- websocket: pattern store/fetch ------------------------------------------

def test_put_source_code_acks_every_chunk_and_activates(tmp_path):
    async def scenario():
        worker = StubWorker()
        server = make_server(tmp_path, worker)
        client, ws = await open_ws(server)

        # Incompressible comment payload so the lzstring-compressed PBP still
        # spans several 1280-byte chunks.
        import random
        rng = random.Random(42)
        noise = "".join(rng.choice("0123456789abcdefghijklmnopqrstuvwxyz") for _ in range(12000))
        source = "export function render(index) { hsv(0,0,0) } // " + noise
        blob = make_pbp_bytes(PATTERN_ID, "Big Pattern", source)
        payload = PATTERN_ID.encode() + blob  # client sends id + PBP
        chunks = client_chunks(protocol.MessageType.PUT_SOURCE_CODE, payload)
        assert len(chunks) >= 3  # the point of this test is multi-chunk

        for chunk in chunks:  # the real client blocks on an ack per chunk
            await ws.send_bytes(chunk)
            reply = await ws.receive(timeout=RECV_TIMEOUT)
            assert reply.type == WSMsgType.TEXT
            assert reply.data == '{"ack":1}'

        assert server.storage.load_pattern_bytes(PATTERN_ID) == blob
        assert server.active_id == PATTERN_ID
        assert worker.loaded[-1][1] == "Big Pattern"
        assert worker.loaded[-1][0] == source

        # listPrograms now includes it (type-7 id\tname\n payload).
        await ws.send_str('{"listPrograms":true}')
        listing = await ws.receive(timeout=RECV_TIMEOUT)
        assert listing.type == WSMsgType.BINARY
        assert listing.data[0] == protocol.MessageType.PROGRAM_LIST
        assert listing.data[2:].decode() == f"{PATTERN_ID}\tBig Pattern\n"

        # getSources returns the bare lzstring source region of the PBP
        # (possibly chunked — reassemble like the client does).
        await ws.send_str(json.dumps({"getSources": PATTERN_ID}))
        reassembler = protocol.Reassembler(protocol.MessageType.GET_SOURCE_CODE)
        region = None
        while region is None:
            sources = await ws.receive(timeout=RECV_TIMEOUT)
            assert sources.type == WSMsgType.BINARY
            assert sources.data[0] == protocol.MessageType.GET_SOURCE_CODE
            region = reassembler.feed(sources.data)
        assert region == _pbp_source_region(blob)

        await client.close()
    run(scenario())


def test_put_byte_code_acks_sequence_but_stores_nothing(tmp_path):
    async def scenario():
        server = make_server(tmp_path)
        client, ws = await open_ws(server)
        files_before = server.storage.list_files()

        bytecode = bytes(range(256)) * 12  # 3072 bytes -> 3 chunks
        crc = zlib.crc32(bytecode) & 0xFFFFFFFF
        set_code = {"pause": True,
                    "setCode": {"size": len(bytecode), "crc": crc, "name": "", "id": PATTERN_ID}}
        await ws.send_str(json.dumps(set_code))
        reply = await ws.receive(timeout=RECV_TIMEOUT)
        assert reply.data == '{"ack":1}'

        for chunk in client_chunks(protocol.MessageType.PUT_BYTE_CODE, bytecode):
            await ws.send_bytes(chunk)
            reply = await ws.receive(timeout=RECV_TIMEOUT)
            assert reply.data == '{"ack":1}'

        await ws.send_str('{"setControls":{}}')  # client fires and forgets
        await ws.send_str('{"pause":false}')
        # The pause:false ack arrives after any setControls ack; drain until it.
        reply = await ws.receive(timeout=RECV_TIMEOUT)
        assert reply.data == '{"ack":1}'

        assert server.storage.list_files() == files_before  # bytecode stored NOWHERE
        assert server.bytecode_note == PATTERN_ID
        assert json.loads(server.config_json())["fbBytecodeOnly"] == PATTERN_ID
        await client.close()
    run(scenario())


def test_active_program_id_switches_pattern_and_answers_sequencer(tmp_path):
    async def scenario():
        worker = StubWorker()
        server = make_server(tmp_path, worker)
        server.storage.save_pattern(PATTERN_ID, make_pbp_bytes(PATTERN_ID, "Lava", "x=2"))
        client, ws = await open_ws(server)

        await ws.send_str(json.dumps({"activeProgramId": PATTERN_ID, "save": False}))
        reply = await ws.receive(timeout=RECV_TIMEOUT)
        assert reply.data.startswith('{"activeProgram":')
        sequencer = json.loads(reply.data)
        assert sequencer["activeProgram"]["activeProgramId"] == PATTERN_ID
        assert sequencer["activeProgram"]["name"] == "Lava"
        assert worker.loaded[-1] == ("x=2", "Lava")

        # setControls with save:true persists to /p/<id>.c
        await ws.send_str('{"setControls":{"speed":0.25},"save":true}')
        reply = await ws.receive(timeout=RECV_TIMEOUT)
        assert reply.data == '{"ack":1}'
        assert server.storage.load_controls(PATTERN_ID) == {"speed": 0.25}

        await client.close()
    run(scenario())


def test_send_updates_pushes_first_preview_frame_immediately(tmp_path):
    async def scenario():
        server = make_server(tmp_path)  # no background tasks: the immediate
        client, ws = await open_ws(server)  # frame must come from the handler

        # Streaming defaults ON (getPreviewFrame never asks first), and
        # {"sendUpdates":false} opts out.
        conn = next(iter(server.connections))
        assert conn.send_updates is True
        await ws.send_str('{"sendUpdates":false}')

        await ws.send_str('{"sendUpdates":true}')
        frame = await ws.receive(timeout=RECV_TIMEOUT)
        assert frame.type == WSMsgType.BINARY
        assert frame.data == bytes([protocol.MessageType.PREVIEW_FRAME]) + bytes([10, 20, 30]) * 4

        await client.close()
    run(scenario())


def test_get_preview_img_serves_pattern_jpeg_or_placeholder(tmp_path):
    async def scenario():
        server = make_server(tmp_path)
        server.storage.save_pattern(PATTERN_ID, make_pbp_bytes(PATTERN_ID, "P", "x=1"))
        client, ws = await open_ws(server)

        await ws.send_str(json.dumps({"getPreviewImg": PATTERN_ID}))
        reply = await ws.receive(timeout=RECV_TIMEOUT)
        assert reply.data[0] == protocol.MessageType.PREVIEW_IMAGE
        assert reply.data[2:] == b"\xff\xd8\xff\xd9"  # the PBP's own jpeg region

        await ws.send_str('{"getPreviewImg":"nonexistent"}')
        reply = await ws.receive(timeout=RECV_TIMEOUT)
        assert reply.data[2:] == server.placeholder_jpeg  # fallback asset
        assert reply.data[2:4] == b"\xff\xd8"

        await client.close()
    run(scenario())


# -- HTTP file API -----------------------------------------------------------

def test_http_file_api_round_trip(tmp_path):
    async def scenario():
        server = make_server(tmp_path)
        client = await open_http(server)

        # POST /edit (multipart field 'data', filename = target path)
        form = FormData()
        form.add_field("data", b'{"pixelCount":4}', filename="/config.json")
        resp = await client.post("/edit", data=form)
        assert resp.status == 200

        # GET /list -> filename\tsize\n
        resp = await client.get("/list")
        assert resp.status == 200
        assert "/config.json\t16\n" in await resp.text()

        # GET file -> verbatim bytes
        resp = await client.get("/config.json")
        assert resp.status == 200
        assert await resp.read() == b'{"pixelCount":4}'

        # GET /delete?path=...
        resp = await client.get("/delete", params={"path": "/config.json"})
        assert resp.status == 200
        resp = await client.get("/config.json")
        assert resp.status == 404
        assert server.storage.read_file("/config.json") is None

        await client.close()
    run(scenario())


def test_http_serves_seeded_webui_verbatim_else_404(tmp_path):
    async def scenario():
        server = make_server(tmp_path)
        client = await open_http(server)

        resp = await client.get("/index.html.gz")
        assert resp.status == 404  # nothing seeded yet

        seeded = b"\x1f\x8b\x08\x00" + bytes(range(256)) * 4  # opaque bytes
        server.storage.seed_webui(seeded)
        resp = await client.get("/index.html.gz")
        assert resp.status == 200
        assert await resp.read() == seeded  # byte-identical, no re-encoding

        await client.close()
    run(scenario())


def test_http_rejects_traversal_with_404(tmp_path):
    async def scenario():
        server = make_server(tmp_path)
        client = await open_http(server)
        resp = await client.get("/p/../../etc/passwd")
        assert resp.status == 404
        await client.close()
    run(scenario())


# -- degraded render worker ---------------------------------------------------

def test_degraded_worker_still_serves_protocol_with_black_frames(tmp_path):
    map_csv = tmp_path / "led_map_3d.csv"
    map_csv.write_text("index,x,y,z,xn,yn,zn,error\n0,0,0,0,0,0,1,0\n1,1,0,0,0,0,1,0\n2,2,0,0,0,0,1,0\n")
    worker = RenderWorker(map_csv, node="fakeblaze-no-such-node")
    worker.start()  # degrades: node binary doesn't exist
    assert worker.degraded
    assert worker.pixel_count == 3

    async def scenario():
        server = make_server(tmp_path, worker)
        client, ws = await open_ws(server)

        await ws.send_str('{"getConfig":true}')
        first = await ws.receive(timeout=RECV_TIMEOUT)
        assert json.loads(first.data)["pixelCount"] == 3
        assert (await ws.receive(timeout=RECV_TIMEOUT)).data.startswith('{"activeProgram":')
        assert (await ws.receive(timeout=RECV_TIMEOUT)).type == WSMsgType.BINARY

        await ws.send_str('{"sendUpdates":true}')
        frame = await ws.receive(timeout=RECV_TIMEOUT)
        assert frame.data == bytes([protocol.MessageType.PREVIEW_FRAME]) + bytes(9)  # black

        stats = server.stats_json()
        assert stats.startswith('{"fps":')
        assert json.loads(stats)["vmerr"] == 1

        await client.close()
    try:
        run(scenario())
    finally:
        worker.stop()


# -- FakeBlaze facade ---------------------------------------------------------

def test_facade_binds_ephemeral_ports_and_serves_both_listeners(tmp_path):
    map_csv = tmp_path / "led_map_3d.csv"
    map_csv.write_text("index,x,y,z,xn,yn,zn,error\n0,0,0,0,0,0,1,0\n1,1,0,0,0,0,1,0\n")
    with FakeBlaze(map_csv, data_dir=tmp_path / "data", ws_port=0, http_port=0,
                   host="127.0.0.1", no_discovery=True,
                   worker=StubWorker(pixel_count=2)) as fb:
        assert fb.ws_port not in (0, 81) and fb.http_port not in (0, 80)

        # HTTP listener answers /list.
        with urllib.request.urlopen(f"http://127.0.0.1:{fb.http_port}/list", timeout=5) as resp:
            assert resp.status == 200

        # Websocket listener answers a ping with an ack (via the same
        # websocket-client library pixelblaze-client uses).
        import websocket
        ws = websocket.create_connection(f"ws://127.0.0.1:{fb.ws_port}/", timeout=5)
        try:
            ws.send('{"ping":true}')
            assert ws.recv() == '{"ack":1}'
        finally:
            ws.close()
    # stop() is idempotent enough to call again.
    fb.stop()
