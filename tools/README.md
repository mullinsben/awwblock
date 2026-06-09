# Build tools: Awwblock

Pipeline to turn Crop Studio exports into live extension assets.

1. Crop in `crop-studio.html`; exports land named `<animal>_<bucket>_<WxH>_<seq>.png`.
2. Drop exports in `assets/crop_outcomes/`.
3. File them flat into `photos/<animal>/` (name carries WxH = aspect):
   ```
   for f in assets/crop_outcomes/*.png; do
     wh=$(basename "$f" | grep -oE '[0-9]+x[0-9]+' | head -1)
     convert "$f" -resize 1000x1000\> -quality 85 "photos/capybara/${wh}_$RANDOM.jpg"
   done
   ```
   (swap `capybara` for the animal; filename's WxH is what the matcher reads.)
4. Rebuild the asset manifest:  `node tools/build_animals.js`   → writes `animals.js`
5. Rebuild the demo page:        `node tools/gen_demo.js`        → writes `demo.html`

Photos are matched to ad slots by EXACT aspect ratio (±12%), so a 728x90 crop only
shows in ~8:1 slots, a 970x250 only in ~3.9:1 slots, etc. SVGs (assets/) are the
fallback for any animal/shape not yet photographed.

Other tools: `extract_marked.py` (crop to a magenta box), `compose_cutouts.py`
(green-screen cutout -> tiled/stacked composites, with de-spill). Crop Studio is the
primary path.
