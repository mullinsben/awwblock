#!/usr/bin/env python3
"""
extract_marked.py: crop images to a magenta box you draw in Preview.

Draw a clean magenta (#FF00FF) rectangle on each image around the crop you want
(exclude the Gemini watermark corner and it's gone for free). Save the marked
images to assets/final_assets/<animal>/marked/ and run this. Each crop is filed
into img/<animal>/<bucket>/ where bucket is inferred from the box's shape:
  wide  (w/h >= 2.2)   leaderboards
  tall  (w/h <= 0.45)  skinny skyscrapers
  portrait (<= 0.7)    300x600
  rect  (else)         300x250 / 336x280

Usage:  python3 tools/extract_marked.py capybara [duck ...]
"""
import glob, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def magenta_mask(a):
    r, g, b = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)
    return (r > 170) & (b > 170) & (g < 110)

def bucket_for(w, h):
    ar = w / h
    if ar >= 2.2: return "wide"
    if ar <= 0.45: return "tall"
    if ar <= 0.7: return "portrait"
    return "rect"

def shrink_past_line(mask, x0, y0, x1, y1):
    # pull each edge inward while it's mostly magenta (the drawn line)
    def frac_row(y, xa, xb): return mask[y, xa:xb].mean() if xb > xa else 0
    def frac_col(x, ya, yb): return mask[ya:yb, x].mean() if yb > ya else 0
    while y0 < y1 and frac_row(y0, x0, x1) > 0.25: y0 += 1
    while y1 > y0 and frac_row(y1 - 1, x0, x1) > 0.25: y1 -= 1
    while x0 < x1 and frac_col(x0, y0, y1) > 0.25: x0 += 1
    while x1 > x0 and frac_col(x1 - 1, y0, y1) > 0.25: x1 -= 1
    return x0, y0, x1, y1

def process(animal):
    src = os.path.join(ROOT, "assets/final_assets", animal, "marked")
    files = sorted(glob.glob(src + "/*.png") + glob.glob(src + "/*.jpg") + glob.glob(src + "/*.jpeg"))
    if not files:
        print(f"  {animal}: no marked images in {src}"); return
    counts = {}
    for f in files:
        im = Image.open(f).convert("RGB")
        a = np.asarray(im)
        m = magenta_mask(a)
        if m.sum() < 50:
            print(f"  skip (no magenta box): {os.path.basename(f)}"); continue
        ys, xs = np.where(m)
        x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
        x0, y0, x1, y1 = shrink_past_line(m, x0, y0, x1, y1)
        crop = im.crop((x0, y0, x1, y1))
        w, h = crop.size
        bucket = bucket_for(w, h)
        # downscale for web (cap longest side ~1000)
        k = min(1.0, 1000 / max(w, h))
        if k < 1.0: crop = crop.resize((int(w * k), int(h * k)), Image.LANCZOS)
        d = os.path.join(ROOT, "img", animal, bucket); os.makedirs(d, exist_ok=True)
        n = counts.get(bucket, 0) + 1; counts[bucket] = n
        crop.save(os.path.join(d, f"{bucket}_{n:02d}.jpg"), quality=86)
        print(f"  {os.path.basename(f)} -> {bucket} {w}x{h}")
    print(f"  {animal}:", ", ".join(f"{k}={v}" for k, v in counts.items()) or "nothing")

if __name__ == "__main__":
    for a in (sys.argv[1:] or ["capybara"]):
        process(a)
