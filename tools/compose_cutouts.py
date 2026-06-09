#!/usr/bin/env python3
"""
compose_cutouts.py: turn transparent-PNG animal cutouts into slot-ready art.

Input:  assets/final_assets/<animal>/cutouts/*.png   (transparent background)
Output: img/<animal>/{square,wide,tall}/*.jpg         (composited on cream)

  square : one cutout centered           (for 300x250 / 336x280 / 250x250)
  wide   : a row of cutouts across        (for 728x90 / 970x90 leaderboards)
  tall   : a stack of cutouts             (for 160x600 / 300x600 skyscrapers)

Everything sits on the warm cream background, full animal always visible, never
cropped. Run after dropping cutouts in; then rebuild animals.js.

Usage:  python3 tools/compose_cutouts.py capybara [duck puppy ...]
"""
import glob, os, random, sys
from PIL import Image
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CREAM = (243, 226, 190, 255)

def despill(img, cap_px=1000):
    """Neutralize green-screen spill on cutout edges: wherever the green channel
    exceeds both red and blue (the tell-tale of green fringe), pull it down to
    max(r,b). Turns a green halo into a neutral one that vanishes on cream."""
    img = img.convert("RGBA")
    w, h = img.size
    if max(w, h) > cap_px:  # de-spill at a sane size; placements are small anyway
        k = cap_px / max(w, h)
        img = img.resize((int(w * k), int(h * k)), Image.LANCZOS)
    a = np.asarray(img).astype(np.int16)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    m = np.maximum(r, b)
    over = (g > m) & (al > 0)
    g[over] = m[over]
    a[..., 1] = g
    return Image.fromarray(a.astype(np.uint8), "RGBA")

def fit(img, mw, mh, pad=1.0):
    w, h = img.size
    k = min(mw * pad / w, mh * pad / h)
    return img.resize((max(1, int(w * k)), max(1, int(h * k))), Image.LANCZOS)

def trim(img):
    bb = img.getbbox()
    return img.crop(bb) if bb else img

def square(cut, W=640, H=540):
    c = Image.new("RGBA", (W, H), CREAM)
    r = fit(cut, W, H, 0.88)
    c.alpha_composite(r, ((W - r.width) // 2, (H - r.height) // 2))
    return c.convert("RGB")

def row(cuts, n, W=1600, H=200):
    c = Image.new("RGBA", (W, H), CREAM)
    cell = W // n
    for i in range(n):
        r = fit(random.choice(cuts), cell, H, 0.9)
        c.alpha_composite(r, (i * cell + (cell - r.width) // 2, (H - r.height) // 2))
    return c.convert("RGB")

def stack(cuts, n, W=320, H=1180):
    c = Image.new("RGBA", (W, H), CREAM)
    cell = H // n
    for i in range(n):
        r = fit(random.choice(cuts), W, cell, 0.9)
        c.alpha_composite(r, ((W - r.width) // 2, i * cell + (cell - r.height) // 2))
    return c.convert("RGB")

def process(animal):
    src = os.path.join(ROOT, "assets/final_assets", animal, "cutouts")
    cuts = [trim(despill(Image.open(f).convert("RGBA"))) for f in sorted(glob.glob(src + "/*.png"))]
    if not cuts:
        print(f"  {animal}: no cutouts in {src}")
        return
    for b in ("square", "wide", "tall"):
        d = os.path.join(ROOT, "img", animal, b)
        os.makedirs(d, exist_ok=True)
        for f in glob.glob(d + "/*.jpg"):
            try:
                os.remove(f)
            except OSError:
                pass  # some sandboxes block deletes; overwrite below is fine
    # square: one per cutout
    for i, cut in enumerate(cuts, 1):
        square(cut).save(os.path.join(ROOT, "img", animal, "square", f"square_{i:02d}.jpg"), quality=85)
    # wide + tall: several composed combos
    random.seed(7)
    combos = max(4, len(cuts))
    for i in range(1, combos + 1):
        row(cuts, n=3 if len(cuts) >= 3 else len(cuts)).save(
            os.path.join(ROOT, "img", animal, "wide", f"wide_{i:02d}.jpg"), quality=85)
        stack(cuts, n=3 if len(cuts) >= 3 else len(cuts)).save(
            os.path.join(ROOT, "img", animal, "tall", f"tall_{i:02d}.jpg"), quality=85)
    print(f"  {animal}: {len(cuts)} cutouts -> {len(cuts)} square, {combos} wide, {combos} tall")

if __name__ == "__main__":
    animals = sys.argv[1:] or ["capybara"]
    print("composing:", ", ".join(animals))
    for a in animals:
        process(a)
