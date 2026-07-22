# Visual Rubric

Run this before delivering any pattern, against the 3D **and** 2D renders
**independently** — a passing 3D score does not imply a passing 2D score
([`2d-parity.md`](./2d-parity.md)). Pass bar: every item passes, or a failure
is a documented, intentional choice (noted in the pattern header) — an
undocumented failure is a defect.

**Does black mean off?**
Pass: background floor is a low, colored `v` (or a documented intentional
dark void — fire's un-lit gaps, sparse negative space), never accidental
true `(0,0,0)`.
Fix: [color-craft.md#background-is-a-color-decision](./color-craft.md#background-is-a-color-decision)

**Is there a focal rhythm — does anything reward sustained watching?**
Pass: a wandering hotspot, axial gradient, or other temporal/positional
focus exists; the eye has somewhere to return to, not just ambient wash.
Fix: [composition.md#focal-interest-without-a-frame](./composition.md#focal-interest-without-a-frame)

**Readable from 10 ft / sculpture-viewing distance?**
Pass: at most two-to-three spatial octaves, minimum feature size ~3 LED
spacings; detail doesn't alias into shimmer at real viewing range.
Fix: [composition.md#scale-contrast-two-octaves-not-five](./composition.md#scale-contrast-two-octaves-not-five)

**At least two independent timescales, and every `time()` use wrap-safe?**
Pass: slow/medium/fast layers are 4–15x apart in period; every quantity
built from `time()` passes through `wave`/`triangle`/`sin` or is used as
pure phase, never a raw position.
Fix: [motion-design.md#timescale-layering](./motion-design.md#timescale-layering), [motion-design.md#wrap-safety](./motion-design.md#wrap-safety)

**Does the pattern breathe or otherwise idle alive, without visible looping?**
Pass: a slow global modulation (breathing) and/or a sparse event/decay layer
keeps the pattern from reading as a static texture or an obvious repeat.
Fix: [motion-design.md#breathing](./motion-design.md#breathing), [motion-design.md#drift-vs-events](./motion-design.md#drift-vs-events)

**Was the 2D strategy chosen deliberately, and does render2D pass this rubric on its own merits?**
Pass: the pattern header states which of the five strategies (slice/project/
re-parameterize/re-compose/curved-cut) and why; the 2D render is judged
against this whole rubric independently, not waved through on 3D's strength.
Fix: [2d-parity.md#the-decision-tree](./2d-parity.md#the-decision-tree)

**Palette: designed value-shape, no muddy midpoints, a few saturated hue families?**
Pass: luminance shape (ambient → valley → ramp → highlight) is art-directed,
not a leftover RGB lerp; hue-path or cosine-palette interpolation used where
an RGB lerp would cut through the cube's gray core.
Fix: [color-craft.md#palette-craft](./color-craft.md#palette-craft)

**Highlights: headroom behavior at peaks, no unintentional channel clipping?**
Pass: peaks resolve via white-hot desaturation or crest hue-shift (with a
saturation floor), not an unclamped `v` blowing a channel to accidental
white; `paint()` values clamped before calling.
Fix: [color-craft.md#white-hot-highlights](./color-craft.md#white-hot-highlights)

**Restraint: does the pattern stay dim enough to have contrast?**
Pass: average fill lands near ~20%, foreground accents under ~5% of pixels
at any instant — mostly-lit reads as glare, not a scene.
Fix: [composition.md#the-layer-stack](./composition.md#the-layer-stack)

**Are the exported sliders present and each end a usable, named look?**
Pass: Speed and Brightness exist at minimum; every slider's two extremes are
both intentional aesthetics (not a broken end), and `v=0` on load is
usable.
Fix: [motion-design.md](./motion-design.md), [color-craft.md](./color-craft.md)

House register: the default is organic, palette-driven, slow-evolving
(lava_lamp / oil_slick / fibonacci_bloom). High-energy or geometric patterns
may deliberately fail specific items — full rainbows, hard edges, fast
crossings — as long as the pattern header names which item and why.
Accidental deviation is a defect; documented deviation is a style choice.
