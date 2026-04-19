#!/usr/bin/env python3
"""Regenerate DSKY image assets from splash.png.

Outputs:
  - splash.png              : metadata stripped, same pixels
  - patch.png               : transparent circular patch only
  - next-dsky favicon.ico   : multi-size favicon from transparent patch
  - watermark.png           : Plymouth theme watermark — the actual boot
                              logo shown on Orange Pi. Pre-rotated 90° CCW
                              to appear upright on the physically-portrait
                              panel (Plymouth draws at native landscape
                              before X rotates).
"""

from pathlib import Path
from PIL import Image, PngImagePlugin
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
UTIL = ROOT / "Programs" / "orangepi-utilities"
SPLASH = UTIL / "splash.png"
PATCH = UTIL / "patch.png"
WATERMARK = UTIL / "watermark.png"
FAVICON = ROOT / "Programs" / "next-dsky" / "src" / "app" / "favicon.ico"

# -- 1. Load once, strip metadata, re-save splash --
src = Image.open(SPLASH)
src.load()
clean = Image.new(src.mode, src.size)
clean.putdata(list(src.getdata()))
clean.save(SPLASH, format="PNG", optimize=True, pnginfo=PngImagePlugin.PngInfo())
print(f"[1/4] wrote {SPLASH.relative_to(ROOT)} (metadata stripped)")

# -- 2. Extract transparent circular patch --
rgba = clean.convert("RGBA")
arr = np.array(rgba)
lum = arr[..., 0] * 0.299 + arr[..., 1] * 0.587 + arr[..., 2] * 0.114
content = lum > 15
ys, xs = np.where(content)
x0, x1 = int(xs.min()), int(xs.max())
y0, y1 = int(ys.min()), int(ys.max())
cx = (x0 + x1) / 2.0
cy = (y0 + y1) / 2.0
# Circumscribing radius (max of half-widths) — the patch is round
r = max(x1 - x0, y1 - y0) / 2.0

h, w = arr.shape[:2]
yy, xx = np.ogrid[:h, :w]
dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
# Soft 1px edge
alpha = np.clip((r + 1 - dist), 0, 1) * 255
arr[..., 3] = alpha.astype(np.uint8)

pad = 4
bl = max(0, int(cx - r) - pad)
bt = max(0, int(cy - r) - pad)
br = min(w, int(cx + r) + pad + 1)
bb = min(h, int(cy + r) + pad + 1)
patch = Image.fromarray(arr).crop((bl, bt, br, bb))
patch.save(PATCH, format="PNG", optimize=True, pnginfo=PngImagePlugin.PngInfo())
print(f"[2/4] wrote {PATCH.relative_to(ROOT)}  ({patch.size[0]}x{patch.size[1]})")

# -- 3. Favicon (multi-size .ico from square-padded patch) --
pw, ph = patch.size
psz = max(pw, ph)
sq = Image.new("RGBA", (psz, psz), (0, 0, 0, 0))
sq.paste(patch, ((psz - pw) // 2, (psz - ph) // 2), patch)
ico_sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
sq.save(FAVICON, format="ICO", sizes=ico_sizes)
print(f"[3/4] wrote {FAVICON.relative_to(ROOT)}  (sizes: {ico_sizes})")

# -- 4. Plymouth watermark (transparent PNG, pre-rotated 90° CCW) --
# The orangepi Plymouth theme centers the watermark and draws the progress
# throbber at y = 0.8 * screen_height. On a 544-tall framebuffer that's
# y ≈ 435, so a centered watermark must be under ~260px tall to clear it.
WM_SIZE = 260
wm = patch.rotate(90, expand=True, resample=Image.BICUBIC).resize(
    (WM_SIZE, WM_SIZE), Image.LANCZOS
)
wm.save(WATERMARK, format="PNG", optimize=True, pnginfo=PngImagePlugin.PngInfo())
print(f"[4/4] wrote {WATERMARK.relative_to(ROOT)}  ({WM_SIZE}x{WM_SIZE}, rotated 90° CCW)")

print("Done.")
