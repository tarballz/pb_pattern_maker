# 2D Parity

Every pattern here is 3D-first — designed for the egg — but every pattern must
ship a `render2D` of **equal visual quality**, not a lazy degraded slice. This
governs how to choose a projection strategy; for palette/timing/layering
inside either renderer, see
[`color-craft.md`](./color-craft.md), [`motion-design.md`](./motion-design.md),
[`composition.md`](./composition.md). Judge the result against
[`visual-rubric.md`](./visual-rubric.md), independently for each domain.

## The rule and why

PixelBlaze auto-selects the render function that matches the connected map's
dimension, preferring the highest-dimension match when there's no exact one
and defaulting missing coordinates to 0.5. That fallback has a reported
firmware bug (coordinate-garbage since 3.66) — **always export an explicit
`render2D` and `render()`**, never rely on the fallback to do the right thing.

Beyond correctness, 2D is a first-class design target: a lot of people will
preview a pattern in the emulator's 2D/panel mode, or run it on a flat map,
before it ever ships on the egg. A 2D view that reads as "the broken version"
is a shipped defect, not an acceptable trade-off.

## The five strategies

Pick one *before* writing `render2D`. In order of how often the repo actually
needs them (27 of 30 dual-renderer patterns slice; only 1 re-parameterizes;
project and re-compose are currently unused but are the right fix for
several failing patterns):

### a. Slice — constant K, when the field is planar-honest

`render2D(index, x, y) { render3D(index, x, y, K) }`. Correct whenever a 2D
cut of the 3D field has the same statistical character as the field itself
(noise, thin films) or when its level sets have a natural lower-D analog
(spheres→circles, planes→lines, shells→rings).

```js
// oil_slick.js — thin-film interference is intrinsically 2D; the perlin
// field slices perfectly. This IS the honest rendering of the concept.
export function render2D(index, x, y) {
  render3D(index, x, y, 0.5)
}
```

### b. Project — computed third coordinate

For volume-only structure (labyrinths, TPMS, true 3D orbits) a *constant* K
never finds a plane with structure — pass a **computed** z instead. See
"the curved-cut insight" below for the dome variant, and the metaball case
for the drop-a-term variant (`lava_lamp.js`: sum the blob falloffs with
`dz = 0` instead of slicing, so all 8 blobs stay visible and traveling
instead of dimming as they cross the plane — untested hypothesis, needs an
emulator pass to confirm the look).

### c. Re-parameterize — rewrite the math in 2D-native coordinates

For azimuthal concepts (atan2 around an axis, N-fold folds, spirals), don't
slice — re-derive the angle around the *2D panel's own center*. This is the
one strategy already proven in the repo:

```js
// examples/geometric/kaleidoscope.js
// render3D wraps polar around Y using (x,z):
var angle = atan2(cz, cx) / PI2 + 0.5
// render2D re-derives polar around the panel center using (x,y) instead —
// same fold, correct axis for the new domain:
var angle = atan2(cy, cx) / PI2 + 0.5
```

### d. Re-compose — a different, equally-budgeted 2D design

When nothing above yields comparable interest (the concept *is* "3D-ness
itself" — parallax showpieces, mapper-proof demos), write a genuinely
different 2D piece sharing palette, tempo, and theme. Budget it like a real
pattern, not a stub. `hc_pat.js` is the repo's existing proof that one
concept can have two domain-native realizations: its `render2D` is primary
and its `render3D` is itself a projection (z folded into (x,y) as a helical
offset) — re-composition running in the opposite direction.

### e. The curved-cut insight — dome/curved-slice projection

The egg's shell is not a flat plane through the volume — it's a *curved* 2D
surface, and that curvature is what makes volumetric fields like the gyroid
read as a structured labyrinth instead of stripes on the physical sculpture.
A flat panel can borrow the same trick: project through a virtual dome
instead of a flat plane, so the cut crosses cells at varying depth.

```js
// gyroid.js — flat z=0 slice is a known failure (see below); a curved cut
// crosses the field at varying depth, closer to what the egg shell does:
export function render2D(index, x, y) {
  var rr = (x - .5) * (x - .5) + (y - .5) * (y - .5)
  var zDome = 0.5 + sqrt(max(0.09, 0.25 - rr)) - 0.3
  render3D(index, x, y, zDome)
}
```
Untested hypothesis — grounded in why the egg's curved surface works, but
this exact dome shape needs an emulator pass before shipping.

## The decision tree

Ask in order; take the first branch that fits.

- **Q1 — Is the concept a surface/field phenomenon** (noise, thin film, fBm —
  a 2D cut has the same statistics as the 3D field)?
  - Yes → **Slice at K=0.5.** Full parity for free. (`oil_slick.js`)
  - No → Q2
- **Q2 — Are the level sets separable/linear/radial** (spheres, planes,
  plane-waves, shells, Voronoi cells)?
  - Yes → **Slice, but choose K where the action is** — the plane must cross
    the support of the moving elements, not just world-center by default.
    (`cube_fire.js` at K=0 works because the sphere lattice fills the whole
    volume; audit any K=0 against clamps — see pulsars below.)
  - No → Q3
- **Q3 — Does the concept have an axis of rotational symmetry** (atan2
  around an axis, N-fold folds, spirals, hemisphere splits)?
  - Yes → **Re-parameterize.** Re-derive the angle around the 2D panel
    center; never slice — any plane either contains the axis (angle
    collapses) or sits perpendicular to it (the axial structure vanishes).
    (`kaleidoscope.js`)
  - No → Q4
- **Q4 — Is the structure volume-only** (labyrinths, TPMS, true 3D orbits —
  nothing planar in any flat cut)?
  - Yes → **Project** — computed third coordinate: curved-cut/dome (e),
    drop-a-term (metaballs), or time-as-depth as a sweetener only (it changes
    *which* slice you see per frame, not whether that slice has structure —
    doesn't rescue a field whose instantaneous slices are already flat).
  - No → Q5
- **Q5 — Nothing above yields comparable interest** (the concept is "3D-ness"
  itself)?
  - → **Re-compose.** Different 2D design, shared palette/tempo/theme.

## Known failure classes

**1. Azimuth collapse: slicing through the symmetry axis.**
`theta = atan2(z - 0.5, x - 0.5)` — at a z=0.5 slice this is
`atan2(0, x - 0.5)`, which only ever evaluates to `0` or `π`. Every
angle-driven term becomes a two-valued step function of `sign(x - 0.5)`.
This single bug class killed the entire fibonacci family (`fibonacci_bloom.js`,
`_plain`, `_rotate`, `fibonacci_dream.js`, plus the duplicate
`orbital_cloud.js`) and `cosmic_bloom.js` — five shipped files, 100% of the
angle-dependent content gone, leaving only depth-driven terms.
*Fix:* re-parameterize — recompute the azimuth from the 2D domain itself
(`atan2(y - 0.5, x - 0.5)`), as `kaleidoscope.js` already does. **Audit every
`atan2` in `render3D`: if its two arguments can't both vary once the third
coordinate is fixed, the 2D variant is degenerate.**

**2. Slice plane outside the pattern's active volume.**
`pulsars.js` clamps both orbit centers to `[0.2, 0.8]` per axis, so nothing
in the pattern ever comes within 0.2 of `z = 0`. Its `render2D` slices at
`render3D(index, x, y, 0)` — a plane that never intersects a source: cores
cap at half brightness and shells only ever arrive as stale off-center arcs,
never as a fresh ring at its origin.
*Fix:* slice through the action — `render3D(index, x, y, 0.5)` passes through
the orbit box for free; a one-constant change.

**3. Volumetric fields whose flat slice loses all structure.**
`gyroid.js`'s own header states it plainly: "a 2D slice of the gyroid is just
wiggly stripes." The interpenetrating-labyrinth read only exists because the
egg's shell curves *through* the volume; a flat `z = 0` cut samples a single
depth and shows parallel sine bands.
*Fix:* curved-cut/dome projection (strategy e) so the cut crosses cells at
varying depth, or re-compose as an honestly-2D piece with the same "ordered
labyrinth" character (e.g. a 2D quasi-periodic interference field with a
chiral rotation term).

## Workflow

1. Pick the strategy from the decision tree **before** writing `render2D` —
   don't default to slice-and-see.
2. Preview both renderers in the emulator (Force dim 2D/3D toggle) and judge
   each against [`visual-rubric.md`](./visual-rubric.md) independently — a
   passing 3D score does not imply a passing 2D score, and vice versa.
3. `uv run python pb.py frame -o frame.ppm` against real hardware when it's
   available, to confirm the emulator's read matches the device.
4. Document the choice in the pattern header: `2D strategy: <slice
   K/project/re-param/re-compose> because <where the structure lives>` — the
   frank per-pattern comments already in this repo (`gyroid.js`, `slicer.js`,
   `3d_roto.js`) were the most useful signal in the audit that produced this
   doc; keep writing them.
5. Elements pinned to an off-plane 3D point (a pole beacon, wandering
   particles) either need re-anchoring into the 2D domain or an explicit note
   that they'll pop in/out — don't let it be a silent surprise.

## Sources

- ElectroMage forum — render-function fallback rules, dimension preference: https://forum.electromage.com/t/i-cannot-render-2d-patterns-on-my-3d-pixelmap/4228/2
- ElectroMage forum — fallback coordinate-garbage bug since firmware 3.66: https://forum.electromage.com/t/possible-issue-missing-coordinates-during-cross-dimensional-rendering-since-3-66/4716
- PixelBlaze mapper README — world-unit coordinates as the portability mechanism: https://github.com/simap/pixelblaze/blob/master/README.mapper.md
- PixelBlaze expressions README — render function auto-selection: https://github.com/simap/pixelblaze/blob/v3/README.expressions.md
- zranger1, PixelblazePatterns Toolkit — 2D SDF primitives as a first-class design space: https://github.com/zranger1/PixelblazePatterns/blob/master/Toolkit/sdf2d.md
- Shadertoy — "Evolving Gyroid" (time-as-depth slicing): https://www.shadertoy.com/view/ssBGDG
- Shadertoy — "2D Metaballs" (drop-a-term projection): https://www.shadertoy.com/view/MtKXRt
- john-wigg.dev — 2D metaball math: https://john-wigg.dev/2DMetaballs/
