# PixelBlaze LED Art Project

Uses [marimapper](https://github.com/TheMariday/marimapper) to scan LED positions with a webcam and upload 3D coordinate maps to a PixelBlaze controller.

## Setup

Install marimapper as a global tool from the local repo:

```bash
cd ~/code/marimapper
uv tool install .
```

To update after making changes to marimapper:

```bash
uv tool install . --reinstall
```

## One-time PixelBlaze setup

Upload the `marimapper.epe` pattern to the PixelBlaze via its web UI. This is required for marimapper to control individual LEDs during scanning.

## Workflow

### 1. Test the connection

```bash
marimapper_check_backend pixelblaze --server <ip>
```

### 2. Scan

Run from the mapping directory for your target (e.g. `egg_mapping/`):

```bash
cd ~/code/pb/egg_mapping
marimapper pixelblaze --server <ip>
```

- Confirm each scan when prompted with `y`
- Keep the camera still during each scan
- Move the camera between scans — aim for 3+ views, 6°–20° apart
- At least some LEDs should overlap between views

### 3. Upload to PixelBlaze

```bash
marimapper_upload_mapping_to_pixelblaze --server <ip>
```

Reads `led_map_3d.csv` from the current directory and sends coordinates to the controller.

## Output files

| File | Description |
|---|---|
| `led_map_2d_YYYYMMDD-HHMMSS.csv` | 2D pixel detections for one camera view (`index, u, v`) |
| `led_map_3d.csv` | Reconstructed 3D positions and normals (`index, x, y, z, xn, yn, zn, error`) |

## Projects

- `egg_mapping/` — LED mapping scans for the egg installation
- `pattern_maker/` — PixelBlaze patterns

## Tips

- Run `marimapper pixelblaze --help` for all options (exposure, threshold, LED range, etc.)
- Use `--exposure` (lower = darker image) and `--threshold` to tune LED detection
- Use `-v` for verbose output if something seems wrong
- If reconstruction fails, delete the `led_map_2d_*.csv` files and rescan
