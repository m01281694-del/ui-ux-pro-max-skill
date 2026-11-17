"""Voix off + minutage mot par mot + formes de bouche.

ElevenLabs (clé injectée par le proxy de l'environnement) avec repli automatique sur Piper (voix Tom, locale)
si ElevenLabs refuse (quota épuisé, clé absente...).
"""
import json, subprocess, urllib.request, urllib.error, base64, os, re
import numpy as np, soundfile as sf

ELEVEN_VOICE = os.environ.get("STUDIO_VOICE", "TX3LPaxmHKxFdv7VOQHJ")  # Liam
ELEVEN_MODEL = os.environ.get("STUDIO_MODEL", "eleven_v3")
CACHE = os.path.expanduser("~/.cache/studio")
FPS = 30
LEAD, TAIL = 0.35, 2.6


def eleven(text, out_dir):
    body = {"text": text, "model_id": ELEVEN_MODEL,
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.8} if ELEVEN_MODEL == "eleven_v3"
            else {"stability": 0.32, "similarity_boost": 0.8, "style": 0.45, "use_speaker_boost": True, "speed": 1.06}}
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVEN_VOICE}/with-timestamps?output_format=mp3_44100_128",
        data=json.dumps(body).encode(), headers={"xi-api-key": "proxy-injected", "Content-Type": "application/json"})
    r = json.loads(urllib.request.urlopen(req, timeout=240).read())
    open(out_dir + "/voice.mp3", "wb").write(base64.b64decode(r["audio_base64"]))
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", out_dir + "/voice.mp3", "-ac", "1", "-ar", "44100", out_dir + "/voice_raw.wav"], check=True)
    al = r.get("normalized_alignment") or r["alignment"]
    if "".join(al["characters"]) != text:
        al = r["alignment"]
    a, sr = sf.read(out_dir + "/voice_raw.wav", dtype="float32")
    return a, sr, al["characters"], al["character_start_times_seconds"], al["character_end_times_seconds"]


def piper(segs_text, out_dir):
    os.makedirs(CACHE, exist_ok=True)
    model = CACHE + "/fr_FR-tom-medium.onnx"
    base = "https://huggingface.co/rhasspy/piper-voices/resolve/main/fr/fr_FR/tom/medium/fr_FR-tom-medium.onnx"
    for suf in ("", ".json"):
        if not os.path.exists(model + suf):
            subprocess.run(["curl", "-sSL", "-m", "300", "-o", model + suf, base + suf], check=True)
    from piper import PiperVoice, SynthesisConfig
    pv = PiperVoice.load(model); sr = pv.config.sample_rate
    cfg = SynthesisConfig(length_scale=0.92, noise_scale=0.72, noise_w_scale=0.9)
    audio, chars, cs, ce, t = [], [], [], [], 0.0
    for k, txt in enumerate(segs_text):
        parts = [np.zeros(0, dtype=np.float32)]
        for ch in pv.synthesize(txt, syn_config=cfg):
            parts.append(ch.audio_float_array.astype(np.float32))
        s = np.concatenate(parts)
        nz = np.where(np.abs(s) > .01)[0]
        if len(nz): s = s[max(0, nz[0] - 400): nz[-1] + 800]
        d = len(s) / sr
        # minutage estimé : proportionnel au nombre de lettres
        n = max(1, len(txt))
        for i, c in enumerate(txt):
            chars.append(c); cs.append(t + d * i / n); ce.append(t + d * (i + 1) / n)
        audio.append(s); t += d
        if k < len(segs_text) - 1:
            chars.append(" "); cs.append(t); ce.append(t + .25)
            audio.append(np.zeros(int(.25 * sr), dtype=np.float32)); t += .25
    a = np.concatenate(audio)
    if sr != 44100:
        sf.write(out_dir + "/voice_piper.wav", a, sr)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", out_dir + "/voice_piper.wav", "-ar", "44100", out_dir + "/voice_raw.wav"], check=True)
        a, sr = sf.read(out_dir + "/voice_raw.wav", dtype="float32")
    return a, sr, chars, cs, ce


def shape(c):
    c = c.lower()
    if c in "aàâ": return (1.0, .55, 0, 0, 0)
    if c in "oôuùûö": return (.55, 0, 1, 0, 0)
    if c in "eéèêëiîïy": return (.5, 1, 0, 0, 0)
    if c in "mbp": return (0, .3, 0, 0, 1)
    if c in "fv": return (.12, .4, 0, 1, 0)
    if c in "szcçjgx": return (.2, .8, 0, 0, 0)
    if c.isalpha(): return (.32, .4, .1, 0, 0)
    return (0, .3, 0, 0, 0)


def make(spec, out_dir):
    segs = spec["segments"]
    texts = [s["say"].strip() for s in segs]
    text = " ".join(texts)
    engine = "elevenlabs"
    try:
        a, sr, chars, cs, ce = eleven(text, out_dir)
    except Exception as e:  # quota, réseau, clé...
        print("ElevenLabs indisponible, repli sur Piper :", str(e)[:200])
        engine = "piper"
        a, sr, chars, cs, ce = piper(texts, out_dir)
        text = "".join(chars)
    joined = "".join(chars)
    dur = round(LEAD + ce[-1] + TAIL, 3)
    full = np.concatenate([np.zeros(int(LEAD * sr), dtype=np.float32), a])[:int(dur * sr)]
    full = np.concatenate([full, np.zeros(max(0, int(dur * sr) - len(full)), dtype=np.float32)])
    full = full / max(1e-6, np.abs(full).max()) * .95
    sf.write(out_dir + "/voice.wav", full, sr)
    words, i = [], 0
    while i < len(chars):
        if chars[i].isspace(): i += 1; continue
        j = i
        while j < len(chars) and not chars[j].isspace(): j += 1
        words.append({"w": joined[i:j], "a": round(LEAD + cs[i], 3), "b": round(LEAD + ce[j - 1], 3)})
        i = j
    out_segs, pos = [], 0
    for s, txt in zip(segs, texts):
        k = joined.find(txt, pos)
        if k < 0: k = pos
        e = min(k + len(txt) - 1, len(ce) - 1)
        out_segs.append({"id": s["id"], "start": round(LEAD + cs[k], 3), "end": round(LEAD + ce[e], 3), "text": txt})
        pos = e + 1
    for w in words:
        w["seg"] = next((s["id"] for s in out_segs if s["start"] - .02 <= w["a"] <= s["end"] + .02), out_segs[-1]["id"])
    N = int(dur * FPS); hop = sr // FPS
    target, ci = [], 0
    for f in range(N):
        t = f / FPS - LEAD + .02
        while ci < len(chars) - 1 and ce[ci] < t: ci += 1
        target.append(shape(chars[ci]) if cs[ci] <= t <= ce[ci] + .03 else (0, .3, 0, 0, 0))
    amp = np.array([float(np.sqrt(np.mean(full[f * hop:(f + 1) * hop] ** 2))) for f in range(N)])
    amp = np.clip(amp / (np.percentile(amp[amp > .005], 90) + 1e-6), 0, 1)
    vis, cur = [], np.array([0, .3, 0, 0, 0], dtype=float)
    for f in range(N):
        tg = np.array(target[f], dtype=float); tg[0] *= (.35 + .65 * amp[f])
        cur = cur + (tg - cur) * .55
        vis.append([round(float(x), 3) for x in cur])
    tl = {"duration": dur, "segs": out_segs, "words": words, "vis": vis, "mouth": [round(float(x), 3) for x in amp], "voice_engine": engine}
    json.dump(tl, open(out_dir + "/timeline.json", "w"), ensure_ascii=False)
    return tl


# ---------- dialogues à plusieurs voix ----------
VOICES = {"leo": os.environ.get("STUDIO_VOICE_LEO", "TX3LPaxmHKxFdv7VOQHJ"), "bip": os.environ.get("STUDIO_VOICE_BIP", "cgSgspJ2msm6clMCkdW9")}
DIALOGUE_MODEL = os.environ.get("STUDIO_DIALOGUE_MODEL", "eleven_multilingual_v2")


def make_dialogue(spec, out_dir):
    global ELEVEN_VOICE, ELEVEN_MODEL
    ELEVEN_MODEL = DIALOGUE_MODEL
    segs = spec["segments"]; sr = 44100
    visq = []
    who_list = sorted(set(s.get("who", "leo") for s in segs))
    tracks = {w: [] for w in who_list}
    audio, t = [], LEAD
    words, out_segs = [], []
    engine = "elevenlabs"
    for k, s in enumerate(segs):
        txt = s["say"].strip(); who = s.get("who", "leo")
        try:
            ELEVEN_VOICE = VOICES.get(who, VOICES["leo"])
            a, sr2, chars, cs, ce = eleven(txt, out_dir)
        except Exception as e:
            print("ElevenLabs indisponible, repli Piper :", str(e)[:120]); engine = "piper"
            a, sr2, chars, cs, ce = piper([txt], out_dir)
        nz = np.where(np.abs(a) > .01)[0]
        off = 0
        if len(nz): off = max(0, nz[0] - 300); a = a[off: nz[-1] + 900]
        o = off / sr; joined = "".join(chars)
        i = 0
        while i < len(chars):
            if chars[i].isspace(): i += 1; continue
            j = i
            while j < len(chars) and not chars[j].isspace(): j += 1
            words.append({"w": joined[i:j], "a": round(t + cs[i] - o, 3), "b": round(t + ce[j-1] - o, 3), "seg": s["id"], "who": who})
            i = j
        d = len(a) / sr
        out_segs.append({"id": s["id"], "who": who, "start": round(t, 3), "end": round(t + d, 3), "text": txt})
        visq.append((t - o, who, chars, cs, ce, t, t + d))
        audio.append((t, a, who)); t += d + s.get("pause", .28)
    dur = round(t + TAIL, 3)
    N = int(dur * sr); full = np.zeros(N, dtype=np.float32); per = {w: np.zeros(N, dtype=np.float32) for w in who_list}
    for (st, a, who) in audio:
        i0 = int(st * sr); i1 = min(N, i0 + len(a)); full[i0:i1] += a[:i1 - i0]; per[who][i0:i1] += a[:i1 - i0]
    m = np.abs(full).max(); full = full / max(1e-6, m) * .95
    sf.write(out_dir + "/voice.wav", full, sr)
    hop = sr // FPS; mouths = {}
    for w, tr in per.items():
        amp = np.array([float(np.sqrt(np.mean(tr[f*hop:(f+1)*hop] ** 2))) for f in range(int(dur * FPS))])
        ref = np.percentile(amp[amp > .005], 90) if (amp > .005).any() else 1
        mouths[w] = [round(float(x), 3) for x in np.clip(amp / (ref + 1e-6), 0, 1)]
    amp_all = np.clip(np.array([float(np.sqrt(np.mean(full[f*hop:(f+1)*hop] ** 2))) for f in range(int(dur * FPS))]) / .1, 0, 1)
    Nf = int(dur * FPS); visw = {w: [] for w in who_list}
    for w in who_list:
        cur = np.array([0, .3, 0, 0, 0], dtype=float); arr = []
        for f in range(Nf):
            tt = f / FPS; tg = (0, .3, 0, 0, 0)
            for (base, who, chars, cs, ce, a0, a1) in visq:
                if who == w and a0 <= tt <= a1:
                    rel = tt - base + .02
                    for ci in range(len(chars)):
                        if cs[ci] <= rel <= ce[ci] + .03: tg = shape(chars[ci]); break
                    break
            tg = np.array(tg, dtype=float); tg[0] *= (.35 + .65 * mouths[w][f]); cur = cur + (tg - cur) * .55
            arr.append([round(float(x), 3) for x in cur[:3]])
        visw[w] = arr
    tl = {"duration": dur, "segs": out_segs, "words": words, "mouths": mouths, "visw": visw, "mouth": [round(float(x), 3) for x in amp_all],
          "vis": [[0, .3, 0, 0, 0]] * int(dur * FPS), "voice_engine": engine}
    json.dump(tl, open(out_dir + "/timeline.json", "w"), ensure_ascii=False)
    return tl


_make_single = make
def make(spec, out_dir):
    if spec.get("format") == "sketch" or any("who" in s for s in spec.get("segments", [])):
        return make_dialogue(spec, out_dir)
    return _make_single(spec, out_dir)
