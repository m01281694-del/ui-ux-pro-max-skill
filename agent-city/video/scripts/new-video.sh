#!/usr/bin/env bash
# Usage: scripts/new-video.sh v002   (content/v002/script.json must exist)
set -euo pipefail
cd "$(dirname "$0")/.."
ID=$1
export NODE_NO_WARNINGS=1 NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt
npx tsx scripts/voice.ts content/$ID
npx tsx scripts/render.ts $ID
python3 scripts/brandcheck.py out/$ID/$ID.mp4 content/$ID
mkdir -p ../public/media/videos
cp out/$ID/$ID.mp4 ../public/media/videos/$ID.mp4
ffmpeg -hide_banner -loglevel error -y -ss 1.2 -i out/$ID/$ID.mp4 -frames:v 1 -vf scale=540:960 ../public/media/videos/$ID-cover.jpg
echo "OK $ID"
