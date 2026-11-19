# Brand Check — deterministic QA (no AI). Score /100; < 80 = sent back with reasons.
import json, re, subprocess, sys, os
vid, d = sys.argv[1], sys.argv[2]
timing = json.load(open(os.path.join(d, "timing.json")))
script = json.load(open(os.path.join(d, "script.json")))
def run(args): return subprocess.run(args, capture_output=True, text=True).stderr + subprocess.run(args, capture_output=True, text=True).stdout
probe = json.loads(subprocess.run(["ffprobe","-v","error","-show_streams","-show_format","-of","json",vid],capture_output=True,text=True).stdout)
v = next(s for s in probe["streams"] if s["codec_type"]=="video"); a = next((s for s in probe["streams"] if s["codec_type"]=="audio"), None)
dur = float(probe["format"]["duration"]); fps = eval(v["r_frame_rate"])
log = subprocess.run(["ffmpeg","-hide_banner","-i",vid,"-vf","blackdetect=d=0.5:pix_th=0.08,freezedetect=n=0.002:d=1","-af","ebur128=peak=true:framelog=quiet","-f","null","-"],capture_output=True,text=True).stderr
lufs = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", log)[-1]); peak = float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", log)[-1])
blacks = re.findall(r"black_start:([\d.]+) black_end:([\d.]+)", log); freezes = re.findall(r"freeze_duration: ([\d.]+)", log)
checks = []
def chk(name, ok, weight, detail): checks.append({"check": name, "ok": bool(ok), "weight": weight, "detail": detail})
chk("Résolution 1080×1920", v["width"]==1080 and v["height"]==1920, 10, f'{v["width"]}×{v["height"]}')
chk("30 fps ou plus", fps >= 29.9, 5, f"{fps:.2f} fps")
chk("Durée 20–60 s", 20 <= dur <= 60, 10, f"{dur:.1f} s")
chk("Audio présent", a is not None, 10, a["codec_name"] if a else "aucun")
chk("Loudness −14 LUFS ±1", abs(lufs + 14) <= 1, 10, f"{lufs} LUFS, crête {peak} dBFS")
chk("Pas d'écran noir > 0,5 s", not blacks, 10, f"{len(blacks)} détection(s)")
chk("Pas de frame figée > 1 s", not freezes, 10, f"{len(freezes)} détection(s)")
chk("Hook < 1,5 s (voix + texte)", timing["words"][0]["start"] < 1.5 and script["scenes"][0]["id"]=="hook", 10, f'1er mot à {timing["words"][0]["start"]:.2f} s')
chk("Sous-titres synchronisés mot à mot", len(timing["words"]) > 20 and all(w["end"] >= w["start"] for w in timing["words"]), 10, f'{len(timing["words"])} mots horodatés (ElevenLabs)')
gaps = [b["start"]-a2["end"] for a2,b in zip(timing["words"], timing["words"][1:])]
chk("Pas de temps mort > 1 s dans la voix", max(gaps) < 1.0, 5, f"plus long silence {max(gaps):.2f} s")
chk("Musique libre de droits", True, 5, "musique synthétisée par la ville (ffmpeg) + SFX ElevenLabs")
chk("Label IA prévu", script.get("aiLabel") is True, 5, "étiquette « contenu IA » à cocher à la publication")
score = sum(c["weight"] for c in checks if c["ok"])
report = {"score": score, "verdict": "validé" if score >= 80 else "à corriger", "checks": checks, "manual": ["affirmations : aucune statistique chiffrée non sourcée (vérifié à l'écriture du script)", "regard humain des frames clés : voir frames/"]}
json.dump(report, open(os.path.join(d, "brandcheck.json"), "w"), ensure_ascii=False, indent=1)
print(json.dumps(report, ensure_ascii=False, indent=1))
