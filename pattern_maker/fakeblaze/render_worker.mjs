#!/usr/bin/env node
// fakeblaze render worker: runs pattern JS through the emulator's VM.
//
// JSON-lines RPC over stdin/stdout — one JSON object per line in, one per
// line out, every reply echoing the request's `id`. stdout is the protocol
// channel; all diagnostics go to stderr. Driven by renderworker.py.
//
// Commands: loadMap, loadPattern, frame, getVars, setVars, setControls, ping.
// A failing command replies {id, ok:false, error} — it never kills the
// process (crash recovery lives on the Python side).

import { readFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createInterface } from 'node:readline'

const EMU = process.env.PB_EMU_ROOT || join(homedir(), 'code/pb/pixelblaze-pattern-emulator')
if (!existsSync(join(EMU, 'src/vm/index.js'))) {
  process.stderr.write(`emulator not found at ${EMU} (set PB_EMU_ROOT)\n`)
  process.exit(2)
}

const imp = (rel) => import(pathToFileURL(join(EMU, rel)).href)
const { parseMapContent, prepareMap, selectRenderFnInfo } = await imp('src/map/index.js')
const { createVM } = await imp('src/vm/index.js')

// ---------------------------------------------------------------------------
// `export var` accessor shims.
//
// The emulator's classifyExports drops non-function exports, but the real
// device exposes exported *variables* through getVars/setVars (pb.py vars
// depends on that). So we scan the source for `export var` declarations and
// append generated accessor *functions*, which survive classification and
// land in classified.misc. Appended at the END so pattern line numbers in
// error messages stay correct (the emulator's PATTERN_LINE_OFFSET only
// accounts for its own header lines).

// Blank out comments and string/template contents (preserving newlines) so
// the declaration scan can't pick up names from a `// export var x` comment.
function stripCommentsAndStrings(src) {
  let out = ''
  let i = 0
  const n = src.length
  while (i < n) {
    const c = src[i]
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') { out += ' '; i++ }
    } else if (c === '/' && src[i + 1] === '*') {
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        out += src[i] === '\n' ? '\n' : ' '
        i++
      }
      if (i < n) { out += '  '; i += 2 }
    } else if (c === '"' || c === "'" || c === '`') {
      const quote = c
      out += ' '; i++
      while (i < n && src[i] !== quote) {
        if (src[i] === '\\') { out += '  '; i += 2 }
        else { out += src[i] === '\n' ? '\n' : ' '; i++ }
      }
      if (i < n) { out += ' '; i++ }
    } else {
      out += c; i++
    }
  }
  return out
}

// Trailing chars after which a newline does NOT end the statement (the
// initializer expression continues on the next line).
const CONTINUATION = /[=+\-*/%&|^<>?:.(,\[!~]/

export function scanExportVars(source) {
  const clean = stripCommentsAndStrings(source)
  const names = []
  const seen = new Set()
  const decl = /(^|\n|;)\s*export\s+var\s+/g
  let m
  while ((m = decl.exec(clean)) !== null) {
    let i = m.index + m[0].length
    declarators: for (;;) {
      while (i < clean.length && (clean[i] === ' ' || clean[i] === '\t')) i++
      const id = /^[A-Za-z_$][\w$]*/.exec(clean.slice(i))
      if (!id) break
      if (!seen.has(id[0])) { seen.add(id[0]); names.push(id[0]) }
      i += id[0].length
      while (i < clean.length && (clean[i] === ' ' || clean[i] === '\t')) i++
      if (clean[i] === ',') { i++; continue }       // export var a, b
      if (clean[i] !== '=') break                    // bare `export var x`
      i++ // past '='
      // Consume the initializer up to a top-level `,` (next declarator),
      // `;`, or a newline that terminates the statement.
      let depth = 0
      let last = '='
      while (i < clean.length) {
        const c = clean[i]
        if (c === '(' || c === '[' || c === '{') depth++
        else if (c === ')' || c === ']' || c === '}') depth--
        else if (c === ',' && depth === 0) { i++; continue declarators }
        else if (c === ';' && depth === 0) break declarators
        else if (c === '\n' && depth === 0 && !CONTINUATION.test(last)) break declarators
        if (!/\s/.test(c)) last = c
        i++
      }
      break
    }
    decl.lastIndex = i
  }
  return names
}

export function buildVarShims(names) {
  // `typeof` guards make a mis-scanned name yield `undefined` (dropped by
  // JSON.stringify) instead of a ReferenceError inside the accessor.
  const gets = names
    .map(n => `${JSON.stringify(n)}: (typeof ${n} !== 'undefined') ? ${n} : undefined`)
    .join(', ')
  const sets = names
    .map(n => `if (o[${JSON.stringify(n)}] !== undefined) ${n} = o[${JSON.stringify(n)}];`)
    .join(' ')
  return `\nfunction __fbGetVars() { return { ${gets} } }` +
         `\nfunction __fbSetVars(o) { ${sets} }\n`
}

// ---------------------------------------------------------------------------
// Worker state + command handlers.

const state = {
  map: null,        // prepared map: { pixelCount, dim, normalized, ... }
  vm: null,
  info: null,       // selectRenderFnInfo result for the current map dim
  getVarsFn: null,
  setVarsFn: null,
  rgbFloat: null,   // Float32Array(pixelCount*3), VM output 0..1
  rgbBytes: null    // Buffer(pixelCount*3), clamped 0..255
}

function findMisc(classified, name) {
  const entry = classified.misc.find(e => e.name === name)
  return entry ? entry.fn : null
}

function currentVars() {
  if (!state.getVarsFn) return {}
  const raw = state.getVarsFn()
  const vars = {}
  for (const [k, v] of Object.entries(raw)) {
    if (v === undefined || typeof v === 'function') continue
    vars[k] = (typeof v === 'number' && !Number.isFinite(v)) ? null : v
  }
  return vars
}

const handlers = {
  loadMap({ path }) {
    const parsed = parseMapContent(readFileSync(path, 'utf8'))
    const map = prepareMap(parsed, { normalizeMode: 'fill' })
    state.map = map
    state.rgbFloat = new Float32Array(map.pixelCount * 3)
    state.rgbBytes = Buffer.alloc(map.pixelCount * 3)
    // A previously loaded pattern was built for the old map's pixelCount/dim.
    state.vm = state.info = state.getVarsFn = state.setVarsFn = null
    return { ok: true, pixelCount: map.pixelCount, dim: map.dim }
  },

  loadPattern({ source, name }) {
    if (!state.map) return { ok: false, error: 'no map loaded (send loadMap first)' }
    const shimmed = source + buildVarShims(scanExportVars(source))
    // Build everything into locals first: a throwing pattern must leave the
    // previous pattern fully in place.
    const vm = createVM({
      source: shimmed,
      pixelCount: state.map.pixelCount,
      mapDim: state.map.dim,
      mapCoords: state.map.normalized
    })
    const info = selectRenderFnInfo(state.map.dim, vm.classified)
    state.vm = vm
    state.info = info
    state.getVarsFn = findMisc(vm.classified, '__fbGetVars')
    state.setVarsFn = findMisc(vm.classified, '__fbSetVars')
    const controls = vm.classified.controls.map(({ kind, name, label }) => ({ kind, name, label }))
    process.stderr.write(`loaded pattern ${name || '(unnamed)'}: ${info.picked}\n`)
    return { ok: true, renderPicked: info.picked, vars: currentVars(), controls }
  },

  frame({ deltaMs }) {
    if (!state.map) return { ok: false, error: 'no map loaded' }
    if (!state.vm) return { ok: false, error: 'no pattern loaded' }
    const { vm, info, rgbFloat, rgbBytes } = state
    const { nx, ny, nz } = state.map.normalized
    const pc = state.map.pixelCount
    vm.beforeRender(deltaMs == null ? 16.7 : deltaMs)
    for (let i = 0; i < pc; i++) {
      vm.resetPixel()
      info.fn(i, nx, ny, nz, pc)
      vm.readPixel(rgbFloat, i)
    }
    for (let i = 0; i < rgbFloat.length; i++) {
      const v = rgbFloat[i]
      // NaN fails both comparisons and lands on 0.
      rgbBytes[i] = v >= 1 ? 255 : v > 0 ? (v * 255 + 0.5) | 0 : 0
    }
    return { ok: true, rgb: rgbBytes.toString('base64') }
  },

  getVars() {
    return { ok: true, vars: currentVars() }
  },

  setVars({ vars }) {
    if (state.setVarsFn && vars) state.setVarsFn(vars)
    return { ok: true }
  },

  setControls({ controls }) {
    if (state.vm && controls) {
      for (const [name, value] of Object.entries(controls)) {
        const control = state.vm.classified.controls.find(c => c.name === name)
        if (!control) {
          process.stderr.write(`setControls: no such control ${name}\n`)
          continue
        }
        if (Array.isArray(value)) control.fn(...value)
        else control.fn(value)
      }
    }
    return { ok: true }
  },

  ping() {
    return { ok: true }
  }
}

function send(reply) {
  process.stdout.write(JSON.stringify(reply) + '\n')
}

const rl = createInterface({ input: process.stdin, terminal: false })
rl.on('line', (line) => {
  if (!line.trim()) return
  let msg
  try {
    msg = JSON.parse(line)
  } catch (err) {
    send({ id: null, ok: false, error: `bad request json: ${err.message}` })
    return
  }
  const handler = handlers[msg.cmd]
  let reply
  if (!handler) {
    reply = { ok: false, error: `unknown command: ${msg.cmd}` }
  } else {
    try {
      reply = handler(msg)
    } catch (err) {
      reply = { ok: false, error: String((err && err.message) || err) }
    }
  }
  reply.id = msg.id
  send(reply)
})
rl.on('close', () => process.exit(0))
