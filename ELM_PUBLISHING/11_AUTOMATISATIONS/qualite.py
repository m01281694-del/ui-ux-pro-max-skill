#!/usr/bin/env python3
"""ELM PUBLISHING — contrôle rédactionnel automatique (gratuit).

Usage : python3 qualite.py <dossier_livre>
Produit <dossier_livre>/rapport_redactionnel.md :
  - mots inconnus du dictionnaire français (pyspellchecker) à vérifier à la main ;
  - mots doublés (« le le ») ;
  - phrases très longues (> 45 mots) ;
  - répétitions de mots rares dans un même paragraphe ;
  - chiffres et pourcentages (à rapprocher des sources) ;
  - statistiques : nombre de mots, de chapitres, durée de lecture estimée.
"""
import os, re, sys, collections
from spellchecker import SpellChecker

book = os.path.abspath(sys.argv[1])
man = os.path.join(book, "manuscrit")
files = sorted(f for f in os.listdir(man) if f.endswith(".md"))
sp = SpellChecker(language="fr", distance=1)
extra = set(open(os.path.join(os.path.dirname(__file__), "lexique_ok.txt"), encoding="utf-8").read().split()) \
    if os.path.exists(os.path.join(os.path.dirname(__file__), "lexique_ok.txt")) else set()

def clean(t):
    t = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", t)
    t = re.sub(r"\[[^\]]*\]\([^)]*\)", " ", t)
    t = re.sub(r"[*_`#>|]", " ", t)
    t = re.sub(r":::.*", " ", t)
    return t

unknown = collections.Counter()
doubles, longs, reps, nums = [], [], [], []
words_total = 0
for f in files:
    raw = open(os.path.join(man, f), encoding="utf-8").read()
    txt = clean(raw)
    toks = re.findall(r"[A-Za-zÀ-ÖØ-öø-ÿœŒæÆ'’\-]+", txt)
    words_total += len(toks)
    for w in toks:
        for part in re.split(r"['’\-]", w):
            lw = part.lower()
            if len(lw) < 3 or part[:1].isupper() or lw in extra:
                continue
            if lw not in sp:
                unknown[lw] += 1
    for m in re.finditer(r"\b(\w+) \1\b", txt, flags=re.I):
        if m.group(1).lower() not in ("nous", "vous", "tout"):
            doubles.append((f, m.group(0)))
    for sent in re.split(r"(?<=[.!?])\s+", txt.replace("\n", " ")):
        n = len(sent.split())
        if n > 45:
            longs.append((f, n, sent[:90] + "…"))
    for para in txt.split("\n\n"):
        c = collections.Counter(w.lower() for w in re.findall(r"[A-Za-zÀ-ÿ]{7,}", para))
        for w, k in c.items():
            if k >= 4:
                reps.append((f, w, k))
    for m in re.finditer(r"[^.\n]*\d+(?:[.,]\d+)?\s?%[^.\n]*", raw):
        nums.append((f, m.group(0).strip()[:110]))

out = [f"# Contrôle rédactionnel automatique — {os.path.basename(book)}", "",
       f"- Mots : **{words_total}** · chapitres : {len(files)} · lecture estimée : {words_total//230} min", "",
       "## Mots absents du dictionnaire (à vérifier : faute, nom propre, anglicisme ou terme technique)", ""]
out += [f"- {w} ({n}×)" for w, n in unknown.most_common()] or ["- aucun"]
out += ["", "## Mots doublés", ""] + ([f"- {f} : « {d} »" for f, d in doubles] or ["- aucun"])
out += ["", "## Phrases de plus de 45 mots", ""] + ([f"- {f} ({n} mots) : {s}" for f, n, s in longs] or ["- aucune"])
out += ["", "## Mots longs répétés 4 fois ou plus dans un paragraphe", ""] + ([f"- {f} : {w} ({k}×)" for f, w, k in reps] or ["- aucun"])
out += ["", "## Pourcentages cités (chacun doit renvoyer à une source de references.md)", ""] + ([f"- {f} : {s}" for f, s in nums] or ["- aucun"])
p = os.path.join(book, "rapport_redactionnel.md")
open(p, "w", encoding="utf-8").write("\n".join(out) + "\n")
print("\n".join(out))
