"""Fabrique une comptine (Short vertical) : mélodie générée, paroles en karaoké, décor 3D et animal 3D.

Usage :
  python3 studio/comptines/make_comptine.py studio/comptines/chansons/<id>.json [--stills]

Format de la chanson (voir chansons/frere-jacques.json) :
  lignes : [{"texte": "Frè|re Jac|ques,", "notes": [["C4",1],["D4",1],["E4",1],["C4",1]]}, ...]
  - les syllabes d'un même mot sont séparées par "|", les mots par des espaces ;
  - une note [nom, durée en temps] par syllabe.
"""
import sys, os, json, subprocess, urllib.request, base64, re
import numpy as np, soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SR = 44100
spec_path = sys.argv[1]; stills = "--stills" in sys.argv
spec = json.load(open(spec_path, encoding="utf-8"))
out = os.path.join(HERE, "videos", spec["id"]); os.makedirs(out, exist_ok=True)
json.dump(spec, open(out + "/spec.json", "w"), ensure_ascii=False)

NOTE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
def midi(n):
    m = re.fullmatch(r"([A-G])([#b]?)(-?\d)", n)
    v = NOTE[m.group(1)] + (1 if m.group(2) == "#" else -1 if m.group(2) == "b" else 0) + 12 * (int(m.group(3)) + 1)
    return v + spec.get("transpose", 0)
hz = lambda m: 440 * 2 ** ((m - 69) / 12)

# ---------- minutage ----------
bpm = spec.get("bpm", 100); beat = 60 / bpm
INTRO = 3.4
reps = spec.get("repetitions", 2)
t = INTRO; lines = []; notes = []; syl_all = []; idx = 0
for r in range(reps):
    for li, L in enumerate(spec["lignes"]):
        words = re.sub(r" ([?!:;])", "\u00a0\\1", L["texte"]).split(" ")
        syls = []
        for w in words:
            parts = w.split("|")
            for k, p in enumerate(parts):
                syls.append({"text": p, "w": k == len(parts) - 1})
        if len(syls) != len(L["notes"]):
            raise SystemExit(f"Ligne {li+1} : {len(syls)} syllabes mais {len(L['notes'])} notes -> {L['texte']}")
        start = t
        for s, (n, d) in zip(syls, L["notes"]):
            dur = d * beat
            s.update({"t": round(t, 3), "d": round(dur * .92, 3), "i": idx}); idx += 1
            if n != "-": notes.append((t, dur, midi(n)))
            t += dur
        lines.append({"rep": r, "text": L["texte"].replace("|", ""), "start": round(start, 3), "end": round(t, 3), "syl": syls})
        syl_all += syls
    t += beat * spec.get("pause_beats", 2)
OUTRO = t + .2
DUR = round(OUTRO + 3.6, 2)
TL = {"duration": DUR, "intro": INTRO, "outro": round(OUTRO, 3), "lines": lines, "syl": syl_all,
      "segs": [{"id": "song", "start": INTRO, "end": OUTRO}], "words": [], "vis": [], "mouth": []}
json.dump(TL, open(out + "/timeline.json", "w"), ensure_ascii=False)
print("durée", DUR, "s,", len(lines), "lignes")

render = os.path.join(ROOT, "engine", "render.js")
RENV = dict(os.environ, STUDIO_TEMPLATE=os.path.join(HERE, "comptine.html"))
if stills:
    ts = [1.2, INTRO + .5] + [round(L["start"] + (L["end"] - L["start"]) * .6, 2) for L in lines[:4]] + [round(OUTRO + 1.5, 2)]
    subprocess.run(["node", render, out + "/spec.json", out + "/timeline.json", out + "/still", out + "/punch.json", "stills", *map(str, ts)], check=True, env=RENV)
    print("images :", ", ".join(f"{out}/still-{x}.jpg" for x in ts)); sys.exit(0)

# ---------- musique ----------
N = int(DUR * SR); mix = np.zeros(N, dtype=np.float32)
def add(at, sig, g=1.0):
    s = int(at * SR); e = min(N, s + len(sig))
    if e > s: mix[s:e] += sig[:e - s] * g
def bell(f, d):
    n = int((d + .6) * SR); x = np.arange(n) / SR
    env = np.exp(-x * 4.5) * np.minimum(1, x / .004)
    return ((np.sin(2*np.pi*f*x) + .35*np.sin(2*np.pi*2*f*x) + .12*np.sin(2*np.pi*3*f*x) + .08*np.sin(2*np.pi*4.2*f*x)) * env).astype(np.float32)
def flute(f, d):
    n = int(d * SR); x = np.arange(n) / SR
    vib = 1 + .004 * np.sin(2*np.pi*5.5*x) * np.minimum(1, x / .25)
    env = np.minimum(1, x / .04) * np.minimum(1, (d - x) / .06).clip(0, 1)
    ph = 2*np.pi*np.cumsum(f * vib) / SR
    return ((np.sin(ph) + .18*np.sin(2*ph) + .06*np.sin(3*ph)) * env).astype(np.float32)
for (at, d, m) in notes:
    add(at, bell(hz(m + 12), d), .32); add(at, flute(hz(m), d), .30)
# accords : choisis par fenêtre de 2 temps parmi I, IV, V, vi de la tonalité
key = spec.get("transpose", 0)
CH = {"I": [0, 4, 7], "IV": [5, 9, 12], "V": [7, 11, 14], "vi": [9, 12, 16]}
w = 2 * beat; tt = INTRO - 2 * w
while tt < OUTRO + w:
    pcs = [((m - key) % 12) for (a, d, m) in notes if tt <= a < tt + w]
    best = max(CH, key=lambda c: sum(1 for p in pcs if p in [x % 12 for x in CH[c]]) + (.5 if c == "I" else 0))
    if tt < INTRO or tt >= OUTRO: best = "I" if tt >= OUTRO or int((tt - INTRO) / w) % 2 else "V"
    root = 48 + key
    n = int(w * SR); x = np.arange(n) / SR; env = np.minimum(1, x / .12) * np.minimum(1, (w - x) / .12)
    pad = sum(np.sin(2*np.pi*hz(root + 12 + iv)*x) for iv in CH[best]) / 3 * env
    bass = np.sin(2*np.pi*hz(root - 12 + CH[best][0])*x) * np.exp(-x * 2.5)
    add(tt, pad.astype(np.float32), .12); add(tt, bass.astype(np.float32), .28)
    tt += w
rng = np.random.default_rng(3)
b = INTRO - 4 * beat
while b < OUTRO:
    n = int(.25 * SR); x = np.arange(n) / SR
    add(b, (np.sin(2*np.pi*np.cumsum(55 + 70*np.exp(-x*30))/SR) * np.exp(-x*12)).astype(np.float32), .35)
    for h in (0, .5):
        m = int(.05 * SR); add(b + h * beat, (rng.standard_normal(m) * np.exp(-np.arange(m) / (.012 * SR))).astype(np.float32), .05)
    b += beat
# étincelles intro / fin
for k, iv in enumerate([0, 4, 7, 12, 16]):
    add(.3 + k * .12, bell(hz(72 + key + iv), .3), .22); add(OUTRO + .3 + k * .1, bell(hz(72 + key + iv), .4), .25)

# ---------- voix (ElevenLabs, facultative) ----------
def say(text, path):
    body = {"text": text, "model_id": "eleven_multilingual_v2", "voice_settings": {"stability": .45, "similarity_boost": .8, "style": .5, "speed": 1.0}}
    req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{spec.get('voix', 'EXAVITQu4vr4xnSDxMaL')}?output_format=mp3_44100_128",
        data=json.dumps(body).encode(), headers={"xi-api-key": "proxy-injected", "Content-Type": "application/json"})
    open(path + ".mp3", "wb").write(urllib.request.urlopen(req, timeout=120).read())
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", path + ".mp3", "-ac", "1", "-ar", str(SR), path + ".wav"], check=True)
    a, _ = sf.read(path + ".wav", dtype="float32"); return a
try:
    v1 = say(spec.get("intro_parlee", f"Chantons ensemble : {spec['titre']} !"), out + "/v_intro")
    add(.5, v1 / max(1e-6, np.abs(v1).max()), .9)
    v2 = say(spec.get("fin_parlee", "Bravo ! À bientôt pour une nouvelle comptine !"), out + "/v_fin")
    add(OUTRO + .5, v2 / max(1e-6, np.abs(v2).max()), .9)
except Exception as e:
    print("voix ignorée :", str(e)[:160])
mix = np.tanh(mix * 1.2) / np.tanh(1.2); mix *= .95 / max(1e-6, np.abs(mix).max())
fn = int(.8 * SR); mix[-fn:] *= np.linspace(1, 0, fn)
sf.write(out + "/mix.wav", mix, SR)

subprocess.run(["node", render, out + "/spec.json", out + "/timeline.json", out + "/silent.mp4", out + "/punch.json"], check=True, env=RENV)
mp4 = f"{out}/{spec['id']}.mp4"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", out + "/silent.mp4", "-i", out + "/mix.wav", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", mp4], check=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "1.5", "-i", mp4, "-frames:v", "1", "-q:v", "3", out + "/cover.jpg"], check=True)
for f in os.listdir(out):
    if f.startswith(("v_", "silent", "mix", "still-")): os.remove(os.path.join(out, f))
print("OK", mp4)
