#!/usr/bin/env bash
# File Crop Studio exports for ONE animal into photos/<animal>/ by exact size.
# Usage:  bash tools/file_crops.sh duck      (then run build_animals.js)
set -e
animal="${1:?usage: bash tools/file_crops.sh <capybara|duck|puppy|kitten>}"
cd "$(dirname "$0")/.."
mkdir -p "photos/$animal"
n=0
for f in assets/crop_outcomes/${animal}_*; do
  [ -e "$f" ] || continue
  wh=$(basename "$f" | grep -oE '[0-9]+x[0-9]+' | head -1)
  [ -z "$wh" ] && continue
  n=$((n+1))
  convert "$f" -resize 1000x1000\> -quality 85 "photos/$animal/${wh}_$(printf '%03d' $n).jpg"
done
echo "$animal: filed $n crops into photos/$animal/"
echo "next:  node tools/build_animals.js && node tools/gen_demo.js"
