#!/usr/bin/env node
// Headless estimated-hardware-FPS check for a PixelBlaze pattern.
//
// Imports the emulator's own analysis + hardware model (via $PB_EMU_ROOT) so
// this can never disagree with the FPS shown in the emulator's HUD. Emits one
// JSON object on stdout; all diagnostics go to stderr.
//
// Usage:
//   node perf_estimate.mjs --pattern <file.js> [--map <file.csv>]
//                          [--pixel-count N] [--output-method ws2812|expander|apa102]

import { readFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

function fail(msg) {
  process.stderr.write(msg + '\n')
  process.exit(2)
}

function parseArgs(argv) {
  const args = { outputMethod: 'ws2812' }
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i], v = argv[i + 1]
    if (k === '--pattern') args.pattern = v
    else if (k === '--map') args.map = v
    else if (k === '--pixel-count') args.pixelCount = parseInt(v, 10)
    else if (k === '--output-method') args.outputMethod = v
    else fail(`unknown argument: ${k}`)
  }
  return args
}

const args = parseArgs(process.argv.slice(2))
if (!args.pattern) fail('missing --pattern')
if (!args.map && !args.pixelCount) fail('need --map or --pixel-count')

const EMU = process.env.PB_EMU_ROOT || join(homedir(), 'code/pb/pixelblaze-pattern-emulator')
if (!existsSync(join(EMU, 'src/vm/hwmodel.js'))) {
  fail(`emulator not found at ${EMU} (set PB_EMU_ROOT). ` +
       `If it is present, it may predate the shared hardware model — pull it.`)
}

const imp = (rel) => import(pathToFileURL(join(EMU, rel)).href)
const { estimateHardware } = await imp('src/vm/hwmodel.js')
const { countExpensiveRenderOps } = await imp('src/vm/lint.js')
const { parseMapContent, prepareMap, selectRenderFnInfo } = await imp('src/map/index.js')
const { createVM } = await imp('src/vm/index.js')

const source = readFileSync(args.pattern, 'utf8')

let pixelCount = args.pixelCount
let dim = 3
if (args.map) {
  const parsed = parseMapContent(readFileSync(args.map, 'utf8'))
  const map = prepareMap(parsed, { normalizeMode: 'fill' })
  pixelCount = map.pixelCount
  dim = map.dim
}

// Build the VM only to learn which render function the firmware would pick.
let renderPicked
try {
  const vm = createVM({ source, pixelCount, mapDim: dim })
  renderPicked = selectRenderFnInfo(dim, vm.classified).picked
} catch (err) {
  fail(`could not load pattern: ${err.message || err}`)
}

const expensiveOpCount = countExpensiveRenderOps(source, renderPicked.split(' ')[0])
// estimateHardware is the same function backing the emulator's HUD, so
// `bound` here can never drift from what the HUD would show for this pattern.
const { fps: estFps, bound } = estimateHardware({ pixelCount, outputMethod: args.outputMethod, expensiveOpCount })

process.stdout.write(JSON.stringify({
  pixelCount, dim, renderPicked, expensiveOpCount,
  estFps, bound,
  outputMethod: args.outputMethod
}) + '\n')
