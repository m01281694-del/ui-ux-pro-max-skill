#!/usr/bin/env python3
"""Génère les schémas SVG (demi-terrain) et les chapitres d'exercices du livre 002 à partir de recherche/exercices.json."""
import json, math, os
H = os.path.dirname(os.path.abspath(__file__))
D = json.load(open(os.path.join(H, "recherche/exercices.json"), encoding="utf-8"))
ACC = "#d9480f"
# Demi-terrain : 15 m de large x 14 m de profondeur, 40 px/m. Ligne de fond en haut.
S = {"panier": (300, 103), "sous": (300, 150), "lf": (300, 272), "lf_obs": (300, 225), "haut": (300, 405),
     "aile_g": (98, 318), "aile_d": (502, 318), "coin_g": (52, 112), "coin_d": (548, 112),
     "bloc_g": (205, 175), "bloc_d": (395, 175), "coude_g": (205, 272), "coude_d": (395, 272),
     "mi_g": (165, 235), "mi_d": (435, 235), "milieu": (300, 575),
     "c1": (300, 300), "c2": (300, 370), "c3": (300, 440), "c4": (300, 510)}

def court():
    g = ['<rect x="0" y="0" width="600" height="620" fill="#f7efe4"/>',
         '<rect x="20" y="40" width="560" height="560" fill="none" stroke="#9a7b5b" stroke-width="3"/>',
         '<rect x="202" y="40" width="196" height="232" fill="#efe0cc" stroke="#9a7b5b" stroke-width="3"/>',
         '<path d="M228,272 A72,72 0 0 0 372,272" fill="none" stroke="#9a7b5b" stroke-width="3"/>',
         '<path d="M228,272 A72,72 0 0 1 372,272" fill="none" stroke="#9a7b5b" stroke-width="3" stroke-dasharray="8 8"/>',
         # ligne à 3 points : droites à 0,9 m des lignes de côté puis arc de 6,75 m
         '<path d="M56,40 L56,165 A270,270 0 0 0 544,165 L544,40" fill="none" stroke="#9a7b5b" stroke-width="3"/>',
         '<path d="M240,600 A60,60 0 0 1 360,600" fill="none" stroke="#9a7b5b" stroke-width="3"/>',
         '<line x1="270" y1="80" x2="330" y2="80" stroke="#555" stroke-width="5"/>',
         '<circle cx="300" cy="103" r="18" fill="none" stroke="#e8590c" stroke-width="5"/>']
    return g

def arrow(x1, y1, x2, y2, kind):
    col = {"dribble": "#1c7ed6", "course": "#2b8a3e", "tir": ACC, "passe": "#7048e8"}[kind]
    ang = math.atan2(y2 - y1, x2 - x1)
    shorten = 22 if kind == "tir" else 14
    x2s, y2s = x2 - shorten * math.cos(ang), y2 - shorten * math.sin(ang)
    if kind == "dribble":  # ligne ondulée
        L = math.hypot(x2s - x1, y2s - y1); n = max(4, int(L / 16)); pts = []
        for i in range(n + 1):
            t = i / n; px, py = x1 + (x2s - x1) * t, y1 + (y2s - y1) * t
            off = (7 if i % 2 else -7) if 0 < i < n else 0
            pts.append(f"{px - off*math.sin(ang):.1f},{py + off*math.cos(ang):.1f}")
        body = f'<polyline points="{" ".join(pts)}" fill="none" stroke="{col}" stroke-width="4" stroke-linejoin="round"/>'
    elif kind == "tir":
        mx, my = (x1 + x2s) / 2 - 40 * math.sin(ang), (y1 + y2s) / 2 + 40 * math.cos(ang)
        body = f'<path d="M{x1},{y1} Q{mx:.1f},{my:.1f} {x2s:.1f},{y2s:.1f}" fill="none" stroke="{col}" stroke-width="4.5"/>'
        ang = math.atan2(y2s - my, x2s - mx)
    else:
        dash = "12 9" if kind == "course" else "3 8"
        body = f'<line x1="{x1}" y1="{y1}" x2="{x2s:.1f}" y2="{y2s:.1f}" stroke="{col}" stroke-width="4" stroke-dasharray="{dash}" stroke-linecap="round"/>'
    ax, ay = x2s, y2s
    p1 = (ax - 16 * math.cos(ang - .45), ay - 16 * math.sin(ang - .45)); p2 = (ax - 16 * math.cos(ang + .45), ay - 16 * math.sin(ang + .45))
    return body + f'<polygon points="{ax:.1f},{ay:.1f} {p1[0]:.1f},{p1[1]:.1f} {p2[0]:.1f},{p2[1]:.1f}" fill="{col}"/>'

def player(x, y):
    return f'<circle cx="{x}" cy="{y}" r="17" fill="#fff" stroke="#212529" stroke-width="4"/><text x="{x}" y="{y+7}" font-size="19" font-weight="800" text-anchor="middle" fill="#212529">J</text>'

def cone(x, y):
    return f'<polygon points="{x},{y-16} {x-13},{y+11} {x+13},{y+11}" fill="#ff922b" stroke="#c2410c" stroke-width="2.5"/>'

def svg_for(e):
    sc = e.get("schema", {})
    g = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 660" font-family="Montserrat, sans-serif">']
    if sc.get("mur"):
        g += ['<rect width="600" height="660" fill="#f7efe4"/>', '<rect x="60" y="60" width="480" height="40" fill="#adb5bd"/>',
              '<text x="300" y="88" text-anchor="middle" font-size="20" font-weight="700" fill="#212529">MUR</text>',
              '<rect x="270" y="105" width="60" height="45" fill="none" stroke="#7048e8" stroke-width="3" stroke-dasharray="6 5"/>',
              '<text x="300" y="175" text-anchor="middle" font-size="16" fill="#7048e8">cible</text>',
              arrow(285, 420, 285, 160, "passe"), arrow(315, 160, 315, 420, "passe"), player(300, 450),
              '<text x="300" y="520" text-anchor="middle" font-size="18" fill="#495057">3 à 5 m</text>']
    else:
        g += court()
        for c in sc.get("cones", []):
            g.append(cone(*S[c]))
        for s in sc.get("spots", []):
            x, y = S[s]; g.append(f'<circle cx="{x}" cy="{y}" r="11" fill="{ACC}" opacity=".85"/>')
        for a, b, k in sc.get("chemin", []):
            g.append(arrow(*S[a], *S[b], k))
        start = sc.get("joueur") or (sc["chemin"][0][0] if sc.get("chemin") else (sc.get("spots") or ["haut"])[0])
        if not sc.get("chemin") and not sc.get("spots"):  # exercice sur place : joueur mis en évidence
            x, y = S[start]
            g.append(f'<circle cx="{x}" cy="{y}" r="60" fill="{ACC}" opacity=".15"/><circle cx="{x}" cy="{y}" r="34" fill="#fff" stroke="#212529" stroke-width="5"/><text x="{x}" y="{y+13}" font-size="36" font-weight="800" text-anchor="middle" fill="#212529">J</text>')
        else:
            g.append(player(*S[start]))
    if sc.get("label"):
        g.append(f'<rect x="150" y="612" width="300" height="40" rx="20" fill="#212529"/><text x="300" y="639" text-anchor="middle" font-size="19" font-weight="700" fill="#fff">{sc["label"]}</text>')
    g.append("</svg>")
    return "\n".join(g)

def legend_svg():
    items = [("dribble", "Dribble"), ("course", "Course sans ballon"), ("tir", "Tir / finition"), ("passe", "Passe")]
    g = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 170" font-family="Montserrat, sans-serif"><rect width="1200" height="170" fill="#fff"/>']
    for i, (k, lab) in enumerate(items):
        x = 30 + i * 290
        g.append(arrow(x, 60, x + 120, 60, k)); g.append(f'<text x="{x+135}" y="68" font-size="24" font-weight="600" fill="#212529">{lab}</text>')
    g.append(player(60, 130)); g.append('<text x="95" y="138" font-size="24" font-weight="600">Toi (joueur)</text>')
    g.append(cone(380, 132)); g.append('<text x="410" y="140" font-size="24" font-weight="600">Plot</text>')
    g.append(f'<circle cx="640" cy="130" r="11" fill="{ACC}"/><text x="665" y="140" font-size="24" font-weight="600">Position de tir</text>')
    g.append("</svg>")
    return "\n".join(g)

os.makedirs(os.path.join(H, "illustrations"), exist_ok=True)
open(os.path.join(H, "illustrations", "legende.svg"), "w").write(legend_svg())
order = ["D", "T", "F", "P", "S", "C"]
for n, cat in enumerate(order, start=3):
    info = D["categories"][cat]
    ex = [e for e in D["exercices"] if e["cat"] == cat]
    md = [f"# {n}. {info['titre']}", "", info["intro"], ""]
    for e in ex:
        open(os.path.join(H, "illustrations", f"ex-{e['id']}.svg"), "w").write(svg_for(e))
        stars = "●" * e["niveau"] + "○" * (3 - e["niveau"])
        md += [f"## {e['id']} · {e['titre']}", "",
               '::: {.exo}', "", f"![](../illustrations/ex-{e['id']}.svg)", "",
               '::: {.exo-txt}',
               f"**Niveau** {stars}  ·  **Matériel :** {e['materiel']}", "",
               f"**Objectif.** {e['objectif']}", "",
               f"**Consigne.** {e['consigne']}", "",
               f"**Volume.** {e['volume']}", "",
               f"**Pour aller plus loin.** {e['progression']}", "",
               f"**Erreur fréquente.** {e['erreur']}", "",
               "**Mon meilleur score :** ________  **Date :** ________", "", "**Notes :**", "", '::: {.notes}', " ", ":::", ":::", "", ":::", ""]
    open(os.path.join(H, "manuscrit", f"{n:02d}-{cat}-exercices.md"), "w", encoding="utf-8").write("\n".join(md))
print("ok", len(D["exercices"]), "exercices")
