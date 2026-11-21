#!/usr/bin/env python3
"""Génère tableau_de_bord.md à partir des CSV. N'invente rien : sans ventes saisies, tout reste à 0.
Saisie : recopier chaque mois les chiffres du rapport KDP (Rapports > Redevances) dans ventes.csv."""
import csv, os
D = os.path.dirname(os.path.abspath(__file__))
rd = lambda f: list(csv.DictReader(open(os.path.join(D, f), encoding="utf-8")))
livres, ventes, dep = rd("livres.csv"), rd("ventes.csv"), rd("depenses.csv")
f = lambda x: float(x or 0)
out = ["# Tableau de bord ELM Publishing", "",
       "*Généré par `tableau.py` à partir de ventes.csv (chiffres réels du rapport KDP uniquement).*", ""]
tot_r = sum(f(v["redevances_eur"]) for v in ventes); tot_d = sum(f(d["montant_eur"]) for d in dep)
out += ["| Indicateur | Valeur |", "|---|---|",
        f"| Livres | {len(livres)} ({sum(l['statut']=='Publié' for l in livres)} publiés) |",
        f"| Redevances cumulées | {tot_r:.2f} € |", f"| Dépenses cumulées | {tot_d:.2f} € |",
        f"| Résultat | {tot_r - tot_d:.2f} € |", ""]
out += ["## Par livre", "", "| Livre | Niche | Statut | Prix broché / Kindle | Ventes | Redevances | Prochaine action |", "|---|---|---|---|---|---|---|"]
for l in livres:
    vs = [v for v in ventes if v["id_livre"] == l["id"]]
    n = sum(int(f(v["ventes_broche"]) + f(v["ventes_kindle"])) for v in vs)
    r = sum(f(v["redevances_eur"]) for v in vs)
    out.append(f"| {l['id']} {l['titre']} | {l['niche']} | {l['statut']} | {l['prix_broche']} € / {l['prix_kindle']} € | {n} | {r:.2f} € | {l['prochaine_action']} |")
mois = sorted({v["mois"] for v in ventes})
if mois:
    out += ["", "## Par mois", "", "| Mois | Ventes | Redevances |", "|---|---|---|"]
    for m in mois:
        vs = [v for v in ventes if v["mois"] == m]
        out.append(f"| {m} | {sum(int(f(v['ventes_broche'])+f(v['ventes_kindle'])) for v in vs)} | {sum(f(v['redevances_eur']) for v in vs):.2f} € |")
else:
    out += ["", "*Aucune vente enregistrée pour l'instant (aucun livre publié).*"]
open(os.path.join(D, "tableau_de_bord.md"), "w", encoding="utf-8").write("\n".join(out) + "\n")
print("OK tableau_de_bord.md")
