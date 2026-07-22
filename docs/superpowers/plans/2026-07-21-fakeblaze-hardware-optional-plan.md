# Hardware-Optional Workflow + Fakeblaze Device Simulator

> **Status: planned, not started** (2026-07-21). Scope approved: "full fake device."
> Protocol research is done and verified against pixelblaze-client 1.1.7 source;
> design was reviewed. Pick up by following the implementation order below.
>
> **2026-07-21 update — verified against real hardware.** Device "Payton PB"
> (v3.51, 200 pixels, chipId 35311) was on the LAN at connect time. Ran a full
> protocol capture (`pattern_maker/tools/capture_protocol.py`, committed) —
> raw frames saved to scratchpad (not committed; includes the user's own saved
> pattern source, not yet reviewed for what's safe to turn into public
> fixtures). Findings:
> - `getConfig` 3-frame sequence, config/sequencer JSON key-order invariants,
>   and the type-9 expander frame (`flags=5, len=3, payload=bytes([5])`) all
>   confirmed exactly as designed below.
> - `getProgramList` (type 7) confirmed as single-chunk `id\tname\n` text.
> - **Type-5 preview frame format was WRONG in the original design** — see
>   corrected description in Part 2 below (no 18-byte header; real capture on
>   a 200-pixel device was exactly `1 + pixelCount*3 = 601` bytes, RGB triples
>   starting immediately after the type byte, verified byte-for-byte).
> - Compiler v3.51 is now cached at `~/.config/pixelblaze/compiler_cache/3.51.js`
>   (local machine, gitignored/out-of-repo) and the raw `/index.html.gz` + `ver`
>   are stashed at `pattern_maker/.fakeblaze/` (gitignored) for future
>   `--seed-fakeblaze` use — no need to re-fetch from hardware for that.
> - A full device backup was taken to scratchpad before any of this (device
>   was never written to — everything above is read-only).
>
> **`protocol.py` is now implemented** (`pattern_maker/fakeblaze/protocol.py` +
> `pattern_maker/test_protocol.py`, 16 tests, all passing): chunker/reassembler,
> `build_expander_frame`/`build_preview_frame` (corrected format, both asserted
> against literal verified bytes), `build_program_list_frames`,
> `build_preview_image_frames`, `build_source_code_frames` (round-tripped
> through `pixelblaze-client`'s own LZString compress/decompress as the oracle,
> per the Part 3 testing guidance below), and the config/sequencer/stats JSON
> builders with their key-order invariants. **Deviation from the original
> design: PBP build/parse is NOT reimplemented in protocol.py** — discovered
> that `pixelblaze-client` already ships a complete `pixelblaze.PBP` class
> (`fromComponents` to build, property accessors to parse, header layout
> matches the 9×uint32 LE design exactly) — `storage.py` should use that
> directly instead of duplicating it. Next up per the implementation order:
> `storage.py`.

## Context

Prior session delivered the AST validator, `pb.py` device CLI, and palette integration — but `pb compile`/`push` require a live PixelBlaze. The user won't always have hardware. Approved scope (user picked "Full fake device"):

- **A** — every workflow step must work without hardware; device commands degrade gracefully.
- **B** — reverse-engineer the device: a local **fakeblaze** simulator that pixelblaze-client (and `pb.py`, unmodified) talks to as if it were real hardware, backed by the user's emulator VM (`~/code/pb/pixelblaze-pattern-emulator`, DO NOT modify) for actual rendering.

Key facts established by research:
- The websocket/HTTP/UDP protocol is fully reverse-engineered from pixelblaze-client 1.1.7 source (protocol spec below).
- The pattern **compiler is proprietary**, ships only inside the device web UI (`/index.html.gz`), is cacheable at `~/.config/pixelblaze/compiler_cache/<ver>.js` — obtainable ONLY from a real device, once. **This repo is PUBLIC: never commit the compiler; local cache + gitignored data dir only.**
- `sendPatternToRenderer` ships bytecode only (firmware-executable only); `savePattern` ships source — fakeblaze renders source-bearing patterns, acks + notes bytecode-only pushes.
- macOS allows unprivileged binding of ports 80/81; Linux needs sudo/CAP_NET_BIND_SERVICE (document).
- pixelblaze-client hardcodes `ws://<ip>:81` and `http://<ip>/` — fake must own those ports; tests skip if unavailable.

## Part 1 — `pb.py` hardware-optional (A)

Files: `pattern_maker/pb.py` (extend), new `pattern_maker/compiler.py`, new `pattern_maker/tools/render_headless.mjs`, `pattern_maker/AGENTS.md`, `pattern_maker/CLAUDE.md`.

1. **Offline compile** — `compiler.py`: locate newest cached compiler JS (`~/.config/pixelblaze/compiler_cache/`), eval in `py_mini_racer.MiniRacer`, call `compilePattern(src)`, replicate pixelblaze-client's bytecode packing (two size DWORDs + int32-LE opcodes + exports table of address+name+NUL — see `pixelblaze.py` compilePattern tail, lines ~8000-11000 region already read). `pb compile` order: offline cache → live device fallback → clear error naming `pb fetch-compiler` and the validate/emulator alternative.
2. **`pb fetch-compiler [-s ip] [--seed-fakeblaze]`** — one-time with real hardware: triggers `compilePattern(trivial, allow_cache=True)` to populate the cache; `--seed-fakeblaze` also saves the device's `/index.html.gz` + real `ver` string into fakeblaze's data dir so fakeblaze can serve the compiler to pixelblaze-client later (fakeblaze `--ver` must match the cached version string).
3. **`pb render <pattern.js> [--map csv] [--frames N] [-o dir]`** — headless emulator execution, zero hardware: `tools/render_headless.mjs` (node, imports emulator src from `$PB_EMU_ROOT` default `~/code/pb/pixelblaze-pattern-emulator`; same frame loop as the emulator's `test/integration.test.js:28-35` and the already-proven differential runner in scratchpad). Outputs PPM frame(s) + JSON summary (maxRGB, NaN check, exported vars). `pb frame` gains `--sim` using the same path.
4. Unreachable-device errors for `push/vars/backup/list` mention fakeblaze and `pb render`.
5. `AGENTS.md` workflow rewrite: validate → **render (offline, always)** → compile (if cache/device) → push (if device or fakeblaze).

## Part 2 — fakeblaze simulator (B)

New package `pattern_maker/fakeblaze/` + dep `aiohttp>=3.9`. Single asyncio loop in a daemon thread behind a synchronous `FakeBlaze` facade (start blocks until listeners bound; context manager for tests). Modules per design review:

- `protocol.py` — **DONE** (`pattern_maker/fakeblaze/protocol.py` + `pattern_maker/test_protocol.py`, verified on real hardware 2026-07-21, see update note above). Pure, no I/O: binary chunker/reassembler (byte0=type, byte1=flags 1/2/4, 1280-byte chunks for incoming putSourceCode/putByteCode, 8192-byte for outgoing types), `build_preview_frame` (type 5: NO flags byte and **no header at all** — `bytes([5]) + RGB*pixelCount`, RGB triples starting immediately after the type byte), config/sequencer/stats JSON builders (**key-order invariants: sequencer starts `{"activeProgram":`, stats starts `{"fps":` — unit-tested with `startswith`**), program-list payload (`id\tname\n`), expander frame. PBP blob build/parse is deliberately NOT here — see storage.py below.
- `storage.py`: device-filesystem-mirror data dir (default `pattern_maker/.fakeblaze/`, **gitignored**): `p/<17-char-id>` raw PBP, `p/<id>.c` saved controls, `config.json`, optional seeded `index.html.gz`. Path sanitization. Use `pixelblaze.PBP` (already in the `pixelblaze-client` dependency — `fromComponents` to build, property accessors to parse; header layout matches the originally-planned 9×uint32 LE design exactly) for PBP build/parse instead of reimplementing it. This makes HTTP `/list`+`GET` — and therefore `pb backup` — a passthrough.
- `renderworker.py` + `render_worker.mjs`: long-lived node child, JSON-lines RPC (loadPattern/frame/getVars/setVars/setControls/ping). Worker imports emulator `createVM` + map loaders by absolute URL; **generates `export var` accessor shims** (scan source for `export var` decls, append `__fbGetVars`/`__fbSetVars` functions) because the emulator's `classifyExports` drops non-function exports. Crash → restart, reload last good pattern; >3 restarts/30s → degraded mode (black frames, `vmerr:1`, protocol still served). Never await worker inline >500ms — serve cached last frame/vars (client timeout is 1s).
- `server.py` (aiohttp): WS on :81 `/`, HTTP on :80 (`/list`, `GET /<file>`, `POST /edit` multipart field `data`, `GET /delete?path=`), UDP beacon task → `struct.pack("<LLL", 42, id, t)` to `127.0.0.1:1889` @1Hz (unicast, not broadcast — macOS loopback). Dispatch table for text commands; render tick task (~40 FPS when a connection has `sendUpdates`, ~5 idle); stats push @1Hz.
- `__main__.py`: `uv run python -m fakeblaze --map maps/egg_mapping/led_map_3d.csv --data-dir .fakeblaze --ws-port 81 --http-port 80 --emulator <path> --ver <str> [--no-discovery] [--require-render]`.
- `assets/preview.jpg`: tiny placeholder for type-4 replies + PBP jpeg regions.

**Protocol musts (from verified client source — pixelblaze.py line refs in design review):**
- `{"getConfig":true}` → THREE frames: config JSON (`ver` numeric-string, `name`, `pixelCount` from map, `maxBrightness`, `ledType`, …) → sequencer JSON (first key `activeProgram`) → **binary type 9 expander frame, flags 5, payload `bytes([5])`** (omitting it costs 1s on every config call).
- **Ack every chunk** of incoming binary types 1 & 3, not just completion (client blocks per chunk).
- `{"ping":true}`→`{"ack":1}`; `{"getVars":true}`→`{"vars":{…}}`; `{"setVars":…}` and `{"deleteProgram":…}` → NO reply; `{"listPrograms":true}`→type 7; `{"getSources":id}`→type 6 (bare lzstring blob); `{"getPreviewImg":id}`→type 4 JPEG; `{"activeProgramId":…}`→sequencer JSON; `{"setControls":…}`→ack (persist to `<id>.c` when `"save":true`); `{"sendUpdates":true}`→start pushing type-5 frames immediately (client blocks until first).
- putByteCode sequence: `{"pause":true,"setCode":{size,crc,name,id}}`→ack, chunks→acks (verify crc32, log mismatch), `{"setControls":…}` no-wait, `{"pause":false}`→ack. Store nothing; keep rendering last source-bearing pattern; surface note in config/sequencer JSON.
- Serve seeded `index.html.gz` verbatim if present (enables pixelblaze-client `compilePattern` against fakeblaze); 404 otherwise.

## Part 3 — Tests

- **Unit tier** (always runs): protocol round-trips **using real pixelblaze-client classes as oracle** (`PBP.fromComponents` ↔ our parser; lzstring vs client's decompressor), chunk/reassemble fuzz, JSON `startswith` invariants, storage CRUD, RenderWorker against real node worker incl. crash/restart (skip-if-no-node).
- **E2E tier** (`pytest.mark.e2e`, skip if :80/:81 busy): real `Pixelblaze("127.0.0.1")` → getConfigSettings/getPixelCount/getPatternList/putSourceCode-save/setActivePattern/get+setActiveVariables/getPreviewFrame (1449×3 bytes, non-black for a real egg pattern)/getPatternSourceCode/deletePattern/file ops; UDP discovery test; `pb.py` smoke: `devices`, `list`, `vars`, `frame`, `backup`, `push --save` (with seeded compiler if cache present, else skip).
- `pb render` smoke over a corpus sample (already proven pattern via differential runner).
- Degraded-mode test: no node on PATH → protocol still serves, black frames.

## Part 4 — Docs

- `pattern_maker/CLAUDE.md` + root `CLAUDE.md` + README: fakeblaze quickstart, `pb render`, `pb fetch-compiler` seeding story, Linux low-port note.
- Explicit note: compiler JS is Electromage's — local cache only, never committed (repo is public); `.fakeblaze/` gitignored.
- Memory update: fakeblaze exists; compiler-seeding pending until egg next powered.

## Implementation order

protocol.py (+tests) → storage.py → render_worker.mjs + renderworker.py → server.py → __main__ → pb.py additions (render / offline compile / fetch-compiler / error text) → e2e tier → docs. Sizes per design review: ~250/130/400/80 loc Python core, ~220 loc JS worker, ~450 loc tests.

## Verification

1. `uv run pytest` in pattern_maker (unit + e2e tiers; e2e exercises the REAL pixelblaze-client against fakeblaze on 127.0.0.1).
2. Terminal A: `uv run python -m fakeblaze`; Terminal B: `uv run python pb.py devices` (discovers 127.0.0.1), `list`, `push patterns/egg/lava_lamp.js --save`, `vars`, `frame -o f.ppm` (verify non-black PPM), `backup egg.pbb`.
3. `uv run python pb.py render patterns/egg/gyroid.js --frames 10` with no server running.
4. When the egg is next powered (optional, later): `pb fetch-compiler --seed-fakeblaze`, then repeat step 2's `push` to confirm compile-against-fakeblaze; snapshot real getConfig JSONs as fixtures.
