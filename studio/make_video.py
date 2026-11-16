"""Fabrique une vidéo verticale à partir d'un script JSON.

Usage :
  python3 studio/make_video.py studio/scripts/<id>.json            # vidéo complète
  python3 studio/make_video.py studio/scripts/<id>.json --stills    # images de contrôle seulement

Sortie : studio/videos/<id>/<id>.mp4, caption.txt, cover.jpg, timeline.json
"""
import sys, os, json, subprocess, zlib
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "engine"))
import voice, audio  # noqa: E402

spec_path = sys.argv[1]
stills = "--stills" in sys.argv
spec = json.load(open(spec_path, encoding="utf-8"))
out = os.path.join(HERE, "videos", spec["id"]); os.makedirs(out, exist_ok=True)
json.dump(spec, open(out + "/spec.json", "w"), ensure_ascii=False)

tl_path = out + "/timeline.json"
if os.path.exists(tl_path) and json.load(open(tl_path)).get("text_key") == zlib.crc32(" ".join(s["say"] for s in spec["segments"]).encode()):
    tl = json.load(open(tl_path)); print("voix : réutilisée")
else:
    tl = voice.make(spec, out); tl["text_key"] = zlib.crc32(" ".join(s["say"] for s in spec["segments"]).encode())
    json.dump(tl, open(tl_path, "w"), ensure_ascii=False); print("voix :", tl["voice_engine"])
print("durée", tl["duration"], "s")

render = os.path.join(HERE, "engine", "render.js")
RENV = dict(os.environ)
if spec.get("format") == "calme": RENV["STUDIO_TEMPLATE"] = os.path.join(HERE, "engine", "calme.html")
if spec.get("format") == "film": RENV["STUDIO_TEMPLATE"] = os.path.join(HERE, "engine", "film.html")
punch = out + "/punch.json"
if stills:
    ts = [str(round(s["start"] + .9 * (s["end"] - s["start"]), 2)) for s in tl["segs"]] + [str(round(tl["duration"] - .3, 2))]
    subprocess.run(["node", render, out + "/spec.json", tl_path, out + "/still", punch, "stills", *ts], check=True, env=RENV)
    print("images :", ", ".join(out + "/still-" + t + ".jpg" for t in ts)); sys.exit(0)

subprocess.run(["node", render, out + "/spec.json", tl_path, out + "/silent.mp4", punch], check=True, env=RENV)
cta = next((s for s in spec["segments"] if (s.get("scene") or {}).get("type") == "cta"), None)
cta_t = None
if cta:
    seg = next(s for s in tl["segs"] if s["id"] == cta["id"]); cta_t = seg["start"] + .5
audio.mix(out, zlib.crc32(spec["id"].encode()) % 1000, json.load(open(punch)), [s["start"] for s in tl["segs"]], cta_t, calm=spec.get("format") in ("calme", "film"))
mp4 = f"{out}/{spec['id']}.mp4"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", out + "/silent.mp4", "-i", out + "/mix.wav", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                "-ar", "44100", "-shortest", "-movflags", "+faststart", mp4], check=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(round(tl["segs"][0]["end"], 2)), "-i", mp4, "-frames:v", "1", "-q:v", "3", out + "/cover.jpg"], check=True)
caption = spec.get("caption", "").strip() + "\n\n" + " ".join(spec.get("hashtags", []))
open(out + "/caption.txt", "w", encoding="utf-8").write(caption.strip() + "\n")
for f in ("silent.mp4", "voice.mp3", "voice_raw.wav", "voice_piper.wav", "mix.wav"):
    if os.path.exists(out + "/" + f): os.remove(out + "/" + f)
print("OK", mp4)
