# Color Craft

Color is the highest-leverage decision in a pattern. LEDs are an emissive,
additive medium with their own physics — rules tuned on a monitor mislead.
House style is organic, palette-driven, slow-evolving (lava_lamp,
oil_slick, fibonacci_bloom); notes flag high-energy/geometric differences.

## Why LED color ≠ screen color

LEDs emit light directly and additively — no backlight, no ambient
reflectance, no gamma-corrected framebuffer between your numbers and the
photons. WS2812 channels are unbalanced (datasheet luminous intensity: red
550–700 mcd, green 1100–1400 mcd, blue 200–400 mcd — green ~2x red, 3–7x
blue), so naive hue-cycling at constant `v` reads "too green" and blue needs
extra `v` to register. And two-channel colors (yellow = red+green, magenta =
red+blue, cyan = green+blue) are intrinsically brighter than single-channel
ones at equal `v` — two diodes lit instead of one — so a raw rainbow sweep
blows out at yellow/cyan and goes dim at pure red/green/blue.

```js
// cheap per-channel rebalance toward WS2812 reality (tune on hardware)
rgb(r * 1.0, g * 0.7, b * 1.0)   // knock green down ~30% as a starting point
```

Don't assume equal brightness across hues: cap multi-channel hues' `v` when
hue-cycling, and budget more `v` for blue than intuition suggests.

## Gamma as aesthetics

LED PWM output is linear in duty cycle; human brightness perception is not —
we're far more sensitive to small changes near black than near full. Skipping
gamma makes patterns look washed out with mushy midtones. `v*v` is the
standard fast default (~γ2); `v*v*v` for dark-room installs or deep, punchy
blacks. Gamma goes **last**, applied to `v` right before
`hsv()`/`rgb()`/`paint()` — not to intermediate fields, and not baked into a
palette that's also getting per-pixel `v` modulation (double-correction).

```js
hsv(h, s, v * v)       // default — crisp, keeps ambient floors visible
hsv(h, s, v * v * v)   // dark room / long fades — deeper blacks, more punch
```

**The low-`v` stairstep.** After gamma, very low values collapse toward the
dark quantization floor — slow fades near black visibly step, and mixed
hues drift as channels quantize apart. Keep sustained low ends above
roughly `v ≈ 0.1` pre-gamma, or land dark fades on a
[colored floor](#background-is-a-color-decision) instead of riding the
bottom steps to true black (see `visual-rubric.md` for the hard-snap
dithering deadband — the one exception to "never bottom out").

## Palette craft

**Why RGB-lerp midpoints go muddy.** Linearly blending two saturated RGB
endpoints cuts through the *interior* of the RGB cube: red→cyan's midpoint
is (0.5,0.5,0.5), gray; red→green's midpoint is (0.5,0.5,0), dim olive. Any
lerp across the cube desaturates at the middle — on additive,
linear-in-duty-cycle LEDs this reads as a dim smear, not a subtle blend.

**Fix 1 — hue-path lerp, with the wraparound trap.** Interpolate `h` instead
of `r,g,b`: saturation stays pinned, no gray midpoint. But hue is circular —
if the two hues are numerically more than 0.5 apart, a naive lerp sweeps the
*long* way around through unrelated colors. Rotate one hue by ±1 first so
the numeric distance is ≤ 0.5:

```js
// shortest-path hue lerp — hsv() wraps hue for free, h can go outside 0..1
var d = h2 - h1
if (d > 0.5) d = d - 1
if (d < -0.5) d = d + 1
hsv(h1 + d * t, 1, v)
```

Flip side: a hue-path lerp *never* desaturates, so sometimes the RGB-cube
shortcut is wanted — treat "which axis" as a deliberate per-transition choice.

**Fix 2 — cosine palettes (Inigo Quilez).** `color(t) = a + b·cos(2π(c·t+d))`
per channel — bias `a`, amplitude `b`, frequency `c`, phase `d`. Each
channel traces a smooth curve, hugging the cube surface instead of cutting
through its gray core, so midpoints stay colorful. No vec3 in PixelBlaze —
compute each channel separately:

```js
function cosPal(t) {
  var r = 0.5 + 0.5 * cos(PI2 * (1.0 * t + 0.00))
  var g = 0.5 + 0.5 * cos(PI2 * (1.0 * t + 0.33))
  var b = 0.5 + 0.5 * cos(PI2 * (1.0 * t + 0.67))
  rgb(clamp(r, 0, 1) * r, clamp(g, 0, 1) * g, clamp(b, 0, 1) * b)  // *self ~= gamma
}
```

Keep frequency at integers so the palette loops over `t` in 0..1. Random
phases in `[-π, π]` almost always produce a usable palette — fast variety
without an array (Scruffynerf's PixelBlaze-forum trick; formula MIT, IQ).

**Fix 3 — anchor-designed palettes (the house default).** Hand-place color
stops so every segment stays in-gamut — what `setPalette()` arrays and the
`palette_maker` toolchain are for. **Palettes are the preferred default in
this repo** over live `hsv()` math whenever color is art-directed:
`palette_maker/palette.py url <cpt-city-url>` or `palette.py show <slug>`
pulls a curated stop list, `palette.py insert <slug> <pattern.js>` drops it
into a pattern's `palettes` array. `setPalette([pos,r,g,b,...])` +
`paint(pos, v)` puts interpolation in firmware, separating structure from
dynamics.

```js
var lava_classic = [
  0.00, 0.060, 0.010, 0.180,  // dim violet ambient — NOT pure black
  0.15, 0.010, 0.000, 0.020,  // near-black valley
  0.48, 0.600, 0.060, 0.000,  // saturated ramp
  1.00, 1.000, 0.950, 0.520,  // bright highlight, desaturating (see white-hot)
]
setPalette(lava_classic)
```

The luminance *shape* (dark ambient → near-black valley → saturated ramp →
bright highlight) is what sells an effect, independent of hue — design the
value curve first, then pick hues. A grab-bag of found palettes with
mismatched shapes reads worse than a few built for the pattern's mapping.

**Palette vs. `hsv()` — decision guide.** Palette array when color is
art-directed or per-pixel budget is tight (firmware interpolates; JS-space
math costs FPS). Direct `hsv()`/`rgb()` when hue is the animated quantity
itself, or independent per-pixel s/v fields are needed that a 1-D palette
can't carry.

## Hue relationships on LEDs

**Limit to ~2-3 saturated hues at once.** Overlapping saturated colors add
toward white rather than a blended third hue, and two-channel hues (yellow,
magenta, cyan) are inherently brighter than single-channel ones at equal
`v` — three competing saturated hues can't be balanced by one global `v`;
one dominates. Curated palettes (this repo's `palettes` arrays included)
stick to one or two hue families plus a neutral pole.

**Complementary pairs (red+cyan, orange+blue, magenta+green) read well:**
opposite wheel sides sum toward white, not a muddy third hue, so edges stay
crisp. **Pairs that merge:** anything adjacent to green — louder in every
mix, so green+cyan or green+yellow-green fuse unless the weaker partner
gets extra `v` and spatial separation.

**Sign-split / complementary structure encoding.** When two entities or two
regions of a field need to read as distinct, offset their palette position
by 0.5 instead of choosing two arbitrary hues — the cheapest strong
differentiator, turning a mathematical boundary (sign change, plane
crossing) into a visible color border instead of just darkness. Standing
practice for two-body orbits, tumbling-plane slices, nodal-surface fields —
see `composition.md` for the layering vocabulary it feeds into.

```js
if (psi < 0) pos = pos + 0.5   // opposite lobes of a field get opposite palette halves
```

## Background is a color decision

Pure black backgrounds read as **broken or off LEDs**, not "nothing there"
— an unlit pixel next to lit ones on a physical sculpture looks like a dead
diode, not empty space. Give the background a low-`v`, *colored* floor
instead: anchor palette position 0 near-black-but-tinted (0.02–0.06 of the
dominant hue family), and clamp a brightness floor so nothing emits true
(0,0,0) in an ambient pattern.

```js
v = max(v, 0.09)                      // never fully off — see visual-rubric.md deadband
hsv(hBg, 1, 0.09 + vFg * 0.91)        // or fold the floor directly into the ramp
```

Background hue sets the mood (cool violet/teal = ambient/night, warm dim =
ember/dusk) — pick it deliberately, not as a leftover from `v = 0`.
**Exception:** some phenomena *want* real gaps (fire's un-lit voids, sparse
geometric negative space) — reserve pure black for those intentional cases
only.

## White-hot highlights

Once a channel hits `v = 1.0` there's no headroom left for "brighter" — the
only way to keep a ramp going past saturation is to add the *other*
channels, which is exactly saturation going to zero. This is why fire/ember
palettes universally end black→red→orange→yellow→white: white-hot isn't a
style choice, it's the only physically available way past channel clipping
— and it matches blackbody physics, which is why it instantly reads "hot."

The house idiom couples three things to one energy scalar: `v` (gamma'd),
`s` (inverted), and a small hue lift, so color visibly heats:

```js
// heat in 0..1 — v up, s down, hue drifts warmer, all from one scalar
var s = clamp(2 - 2 * heat, 0, 1)   // fully saturated below 0.5, white by 1.0
hsv(0.02 + 0.06 * heat, s, heat * heat)   // red -> orange drift; v gamma'd
```

**Alternative for anti-white palettes** (jewel tones, bioluminescence,
oil-slick iridescence): shift *hue* at the crest instead of desaturating,
holding a saturation floor so the peak reads hot without clipping white:

```js
// crest hue-shift instead of desaturation (0.92 -> 1.08 wraps through red into gold)
h = mix(0.92, 1.08, tt)
if (s < 0.35) s = 0.35   // saturation floor — clipping fix, not a dimmer
```

Either way, `paint()` does **not** clamp `v` like `hsv()` — an unclamped `v`
past 1.0 multiplies every palette channel toward white, so clamp before
`paint()` unless that clip is deliberate:

```js
paint(pos, min(v, 1))
```

## Sources

- Inigo Quilez, Procedural palettes — https://iquilezles.org/articles/palettes/
- FastLED Color Correction wiki — https://github.com/FastLED/FastLED/wiki/FastLED-Color-Correction
- FastLED Pixel Reference wiki (rainbow vs spectrum, video dimming) — https://github.com/FastLED/FastLED/wiki/Pixel-reference
- Adafruit LED Tricks: Gamma Correction — https://learn.adafruit.com/led-tricks-gamma-correction/the-issue
- WS2812 datasheet (luminous intensity per channel) — https://cdn-shop.adafruit.com/datasheets/WS2812.pdf
- PixelBlaze forum: Working with Hues — https://forum.electromage.com/t/working-with-hues-in-pixelblaze-color-ranges-blending/687
- PixelBlaze forum: Color palette support? (Scruffynerf's cosine-palette adoption; setPalette/paint) — https://forum.electromage.com/t/color-palette-support/192
- PixelBlaze forum: HSV gives varying brightness — https://forum.electromage.com/t/hsv-gives-varying-brightness/1230
- This repo: `patterns/egg/lava_lamp.js`, `patterns/egg/cosmic_bloom.js`, `patterns/egg/cube_fire.js` — shipped-on-hardware color idioms
