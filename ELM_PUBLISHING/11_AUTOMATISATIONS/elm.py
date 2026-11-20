#!/usr/bin/env python3
"""ELM PUBLISHING — moteur de production de livres (100 % outils gratuits).

Commandes :
  python3 elm.py build  <dossier_livre>   # PDF intérieur KDP + DOCX + EPUB
  python3 elm.py cover  <dossier_livre>   # couverture Kindle (JPG) + couverture brochée complète (PDF)
  python3 elm.py check  <dossier_livre>   # contrôle technique -> rapport_technique.md
  python3 elm.py prix   <dossier_livre>   # calcul des redevances -> prix.md
  python3 elm.py all    <dossier_livre>

Chaque livre contient : livre.json (métadonnées), manuscrit/NN-*.md (chapitres), illustrations/*.svg,
couverture/front.html (+ back.html facultatif). Les exports vont dans exports/.
Règles KDP utilisées : voir 01_ETUDE_DE_MARCHE/etude_de_marche.md §5 (vérifiées le 20/11/2026).
"""
import json, os, re, subprocess, sys, shutil, html, unicodedata, datetime
from pypdf import PdfReader, PdfWriter

HERE = os.path.dirname(os.path.abspath(__file__))
RENDER = os.path.join(HERE, "render.js")
FONTS = os.path.join(HERE, "fonts")

# ---------- règles KDP (marchés EUR) ----------
SPINE_PER_PAGE = {"blanc": 0.002252, "creme": 0.0025}


def gutter_for(pages):
    for lim, g in ((150, .375), (300, .5), (500, .625), (700, .75), (828, .875)):
        if pages <= lim:
            return g
    raise ValueError("trop de pages")


def is_large_trim(w, h):
    return w > 6.12 or h > 9.0


def print_cost_eur(pages, w, h):
    large = is_large_trim(w, h)
    if pages <= 110:
        return 2.48 if large else 2.05
    return 0.75 + pages * (0.016 if large else 0.012)


def paperback_royalty_eur(price, pages, w, h):
    rate = 0.60 if price >= 9.99 else 0.50
    return round(rate * price - print_cost_eur(pages, w, h), 2), rate


def ebook_royalty_eur(price_ttc, size_mb, vat=0.055):
    """Amazon.fr : redevance calculée sur le prix HT (TVA livre numérique France 5,5 %)."""
    ht = price_ttc / (1 + vat)
    if 2.69 <= price_ttc <= 12.99:
        return round(0.70 * ht - 0.12 * max(size_mb, 0.01), 2), "70 %"
    return round(0.35 * ht, 2), "35 %"


# ---------- outils ----------
def sh(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode:
        raise RuntimeError(f"échec : {' '.join(cmd)}\n{r.stderr[-1500:]}")
    return r.stdout


def node(*args):
    return sh(["node", RENDER, *map(str, args)], cwd=HERE)


def meta_of(book):
    return json.load(open(os.path.join(book, "livre.json"), encoding="utf-8"))


def chapters(book):
    d = os.path.join(book, "manuscrit")
    return sorted(os.path.join(d, f) for f in os.listdir(d) if f.endswith(".md"))


def norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "", s)


def font_css(rel):
    """Polices statiques (instanciées depuis les polices variables OFL) : Chromium les incorpore en vraies polices
    TrueType (texte sélectionnable, impression sûre), au lieu de glyphes Type 3."""
    faces = [("Literata", "Literata-Regular", 400, "normal"), ("Literata", "Literata-Bold", 700, "normal"),
             ("Literata", "Literata-Italic", 400, "italic"), ("Literata", "Literata-BoldItalic", 700, "italic"),
             ("Source Serif 4", "SourceSerif4-Regular", 400, "normal"), ("Source Serif 4", "SourceSerif4-Bold", 700, "normal"),
             ("Montserrat", "Montserrat-Medium", 500, "normal"), ("Montserrat", "Montserrat-SemiBold", 600, "normal"),
             ("Montserrat", "Montserrat-Bold", 700, "normal"), ("Montserrat", "Montserrat-ExtraBold", 800, "normal"),
             ("Montserrat", "Montserrat-Black", 900, "normal"), ("Oswald", "Oswald-Bold", 700, "normal"),
             ("Fraunces", "Fraunces-Bold", 700, "normal"), ("Fraunces", "Fraunces-Black", 900, "normal")]
    css = "\n".join(f"@font-face{{font-family:'{f}';src:url('{rel}/static/{fn}.ttf');font-weight:{wt};font-style:{st}}}" for f, fn, wt, st in faces)
    return css + f"\n@font-face{{font-family:'Bebas Neue';src:url('{rel}/BebasNeue-Regular.ttf')}}"


# ---------- SVG -> PNG (pour DOCX / EPUB) ----------
def rasterize_svgs(book):
    ill = os.path.join(book, "illustrations")
    out = os.path.join(book, "exports", "png")
    os.makedirs(out, exist_ok=True)
    for f in sorted(os.listdir(ill)) if os.path.isdir(ill) else []:
        if not f.endswith(".svg"):
            continue
        svg = open(os.path.join(ill, f), encoding="utf-8").read()
        m = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', svg)
        w, h = (float(m.group(1)), float(m.group(2))) if m else (1200, 800)
        scale = 1600 / w
        tmp = os.path.join(out, f + ".html")
        open(tmp, "w", encoding="utf-8").write(
            f"<html><head><style>{font_css(os.path.relpath(FONTS, out))}html,body{{margin:0;background:#fff}}"
            f"svg{{width:{w*scale}px;height:{h*scale}px;display:block}}</style></head><body>{svg}</body></html>")
        node("png", tmp, os.path.join(out, f[:-4] + ".png"), int(w * scale), int(h * scale))
        os.remove(tmp)


# ---------- construction du livre ----------
def fr_typo(src):
    """Typographie française : espace insécable avant : ; ! ? » et après « (évite les coupures disgracieuses)."""
    src = re.sub(r"« ", "«\u00a0", src)
    src = re.sub(r" »", "\u00a0»", src)
    src = re.sub(r"(?<=\S) ([;!?])", "\u202f\\1", src)
    src = re.sub(r"(?<=\S) :(?=\s)", "\u00a0:", src)
    return src


def md_to_html(book, files):
    src = fr_typo("\n\n".join(open(f, encoding="utf-8").read() for f in files))
    return sh(["pandoc", "-f", "markdown+smart", "-t", "html5", "--section-divs"], input=src)


def book_css(meta, rel_fonts, trim):
    c = meta.get("couleurs", {})
    acc = c.get("accent", "#1f4e79")
    return font_css(rel_fonts) + f"""
html{{font-family:'{meta.get('police','Literata')}',serif;font-size:{meta.get('taille_police',10.6)}pt;line-height:{meta.get('interligne',1.48)};color:#1a1a1a;hyphens:auto;-webkit-hyphens:auto}}
body{{margin:0}}
p{{margin:0 0 .55em;text-align:justify;orphans:2;widows:2}}
h1{{font-family:'Montserrat',sans-serif;font-weight:800;font-size:21pt;line-height:1.12;color:{acc};margin:.6in 0 .35in;break-before:page;letter-spacing:-.01em}}
h1 .num,.chapnum{{display:block;font-size:10pt;letter-spacing:.25em;color:#888;font-weight:600;margin-bottom:.12in;text-transform:uppercase}}
h2{{font-family:'Montserrat',sans-serif;font-weight:700;font-size:13pt;color:{acc};margin:1.1em 0 .45em;break-after:avoid}}
h3{{font-family:'Montserrat',sans-serif;font-weight:700;font-size:11pt;margin:1em 0 .35em;break-after:avoid}}
ul,ol{{margin:.2em 0 .7em 1.1em;padding:0}} li{{margin:.15em 0}}
blockquote{{margin:.8em 0;padding:.55em .8em;border-left:3pt solid {acc};background:{c.get('fond','#eef3f8')};font-size:10pt;break-inside:avoid}}
blockquote p{{text-align:left;margin:.2em 0}}
table{{border-collapse:collapse;width:100%;font-size:9pt;margin:.6em 0 .9em;break-inside:avoid;font-family:'Source Serif 4',serif}}
th{{background:{acc};color:#fff;font-family:'Montserrat',sans-serif;font-weight:600;text-align:left;padding:4pt 5pt}}
td{{border-bottom:.5pt solid #bbb;padding:3.5pt 5pt;vertical-align:top}} td:empty{{height:.34in}} td{{border-left:.5pt solid #ddd}} td:first-child{{border-left:none}}
img,figure{{max-width:100%;break-inside:avoid}} figure{{margin:.7em 0;text-align:center}} figure img{{max-height:{trim[1]*0.55:.2f}in}}
figcaption{{font-size:8.5pt;color:#555;font-style:italic;margin-top:.25em}}
hr{{border:none;text-align:center;margin:1em 0}} hr:after{{content:'◆';color:{acc};font-size:9pt}}
.exercice,.fiche{{border:1pt solid {acc};border-radius:4pt;padding:.5em .8em;margin:.8em 0;break-inside:avoid}}
.lignes{{height:{1.6}in;background:repeating-linear-gradient(transparent 0 .27in,#bbb .27in calc(.27in + .6pt));margin:.3em 0 .8em}}
.lignes.petit{{height:.9in}} .lignes.grand{{height:3in}}
.pagebreak{{break-after:page}}
code{{font-family:'DejaVu Sans Mono',monospace;font-size:8.6pt}}
.prompt{{font-family:'Source Serif 4',serif;background:#f6f4ef;border:.6pt solid #d8d2c4;border-radius:3pt;padding:.45em .65em;margin:.4em 0 .8em;font-size:9.6pt;break-inside:avoid}}
.prompt p{{text-align:left;margin:.15em 0}}
""" + meta.get("css_extra", "")


def front_html(meta, toc, css):
    t, st, a = html.escape(meta["titre"]), html.escape(meta.get("sous_titre", "")), html.escape(meta.get("auteur", ""))
    year = meta.get("annee", datetime.date.today().year)
    rows = "".join(f'<div class="t"><span>{html.escape(x)}</span><i></i><b>{p}</b></div>' for x, p in toc)
    acc = meta.get("couleurs", {}).get("accent", "#1f4e79")
    return f"""<html><head><meta charset="utf-8"><style>{css}
.tp{{height:100%;display:flex;flex-direction:column;justify-content:center;text-align:center}}
.tp h1{{break-before:auto;margin:0 0 .2in;font-size:26pt;border:none}}
.tp .st{{font-size:12pt;color:#444;margin:0 .3in}} .tp .au{{margin-top:.6in;font-family:Montserrat;font-weight:600;letter-spacing:.12em;text-transform:uppercase;font-size:9.5pt}}
.tp .ed{{margin-top:auto;font-family:Montserrat;font-size:8.5pt;letter-spacing:.3em;color:{acc}}}
.page{{height:{meta['_inner_h']:.3f}in;break-after:page;overflow:hidden}}
.cp{{display:flex;flex-direction:column;justify-content:flex-end;font-size:8.2pt;color:#444}} .cp p{{text-align:left;margin:.25em 0}}
.toc h2{{font-size:17pt;margin:.3in 0 .25in}} .t{{display:flex;align-items:baseline;gap:.08in;margin:.09in 0;font-size:10pt}}
.t span{{max-width:80%}} .t i{{flex:1;border-bottom:.8pt dotted #999;transform:translateY(-.06in)}} .t b{{font-family:Montserrat;font-weight:600;font-size:9.5pt}}
</style></head><body>
<div class="page tp"><h1>{t}</h1><div class="st">{st}</div><div class="au">{a}</div><div class="ed">ELM PUBLISHING</div></div>
<div class="page cp">{meta.get('mentions_html','')}
<p>© {year} {a}. Tous droits réservés. Édité par ELM Publishing.</p>
<p>Aucune partie de ce livre ne peut être reproduite sans autorisation écrite, sauf courtes citations.</p>
<p>Les informations de ce livre sont données à titre éducatif. Elles ont été vérifiées à la date de publication ({meta.get('date_verification','')}) mais ne remplacent pas l'avis d'un professionnel.</p>
<p>Polices : Literata, Source Serif 4, Montserrat (licence SIL Open Font License).</p>
</div>
<div class="page toc"><h2>Sommaire</h2>{rows}</div>
</body></html>"""


def build(book):
    meta = meta_of(book)
    w, h = meta["format_pouces"]
    exp = os.path.join(book, "exports")
    os.makedirs(exp, exist_ok=True)
    rasterize_svgs(book)
    files = chapters(book)
    body = md_to_html(book, files)
    # illustrations SVG insérées directement (les polices de la page s'appliquent, rendu vectoriel net)
    def inline_svg(m):
        p = os.path.join(book, "illustrations", m.group(1) + ".svg")
        svg = open(p, encoding="utf-8").read()
        svg = re.sub(r"<\?xml[^>]*>", "", svg)
        return svg.replace("<svg ", f'<svg style="width:100%;height:auto;max-height:{h*0.55:.2f}in" ', 1)
    body = re.sub(r'<img[^>]*src="\.\./illustrations/([\w\-]+)\.svg"[^>]*/?>', inline_svg, body)
    rel_fonts = os.path.relpath(FONTS, exp)

    def render_body(gutter):
        mg = {"top": .7, "bottom": .75, "left": gutter, "right": max(gutter, .5)}
        meta["_inner_h"] = h - mg["top"] - mg["bottom"]
        css = book_css(meta, rel_fonts, (w, h))
        p = os.path.join(exp, "_corps.html")
        open(p, "w", encoding="utf-8").write(f'<html lang="{meta.get("langue","fr")}"><head><meta charset="utf-8"><style>{css}</style></head><body>{body}</body></html>')
        node("pdf", p, os.path.join(exp, "_corps.pdf"), w, h, json.dumps(mg), 1)
        return mg, css

    mg, css = render_body(.5)  # première passe pour estimer le nombre de pages
    n = len(PdfReader(os.path.join(exp, "_corps.pdf")).pages)
    g = gutter_for(n + 6)
    if g != mg["left"]:
        mg, css = render_body(g)
    rd = PdfReader(os.path.join(exp, "_corps.pdf"))
    texts = [norm(pg.extract_text() or "") for pg in rd.pages]
    heads = re.findall(r"<h1[^>]*>(.*?)</h1>", body, flags=re.S)
    toc, pos = [], 0
    for hh in heads:
        label = re.sub(r"<[^>]+>", " ", hh)
        label = html.unescape(re.sub(r"\s+", " ", label)).strip()
        key = norm(label)[:28]
        for i in range(pos, len(texts)):
            if key and key in texts[i]:
                toc.append((label, i + 1)); pos = i; break
        else:
            toc.append((label, "—"))
    meta["_inner_h"] = h - mg["top"] - mg["bottom"]
    fp = os.path.join(exp, "_debut.html")
    open(fp, "w", encoding="utf-8").write(front_html(meta, toc, css))
    node("pdf", fp, os.path.join(exp, "_debut.pdf"), w, h, json.dumps(mg), 0)
    wr = PdfWriter()
    front = PdfReader(os.path.join(exp, "_debut.pdf"))
    for pg in front.pages:
        wr.add_page(pg)
    if len(front.pages) % 2:  # le corps commence sur une page de droite
        wr.add_blank_page(width=w * 72, height=h * 72)
    for pg in rd.pages:
        wr.add_page(pg)
    if len(wr.pages) % 2:
        wr.add_blank_page(width=w * 72, height=h * 72)
    slug = meta["slug"]
    out_pdf = os.path.join(exp, f"{slug}_interieur_KDP.pdf")
    wr.write(out_pdf)
    total = len(wr.pages)
    # DOCX + EPUB (pandoc) : images SVG remplacées par leurs PNG
    md_all = fr_typo("\n\n".join(open(f, encoding="utf-8").read() for f in files))
    md_all = re.sub(r"\.\./illustrations/([\w\-]+)\.svg", r"png/\1.png", md_all)
    md_all = re.sub(r'::: \{\.lignes[^}]*\}\s*:::', "\n\n______________________________________________\n\n______________________________________________\n\n", md_all)
    tmpmd = os.path.join(exp, "_tout.md")
    hdr = f"---\ntitle: \"{meta['titre']}\"\nsubtitle: \"{meta.get('sous_titre','')}\"\nauthor: \"{meta.get('auteur','')}\"\nlang: {meta.get('langue','fr')}\nrights: \"© {meta.get('annee')} {meta.get('auteur')}\"\npublisher: ELM Publishing\n---\n\n"
    open(tmpmd, "w", encoding="utf-8").write(hdr + md_all)
    sh(["pandoc", tmpmd, "-o", os.path.join(exp, f"{slug}.docx"), "--toc", "--toc-depth=1", "--resource-path", exp], cwd=exp)
    cover_jpg = os.path.join(book, "couverture", f"{slug}_kindle.jpg")
    epub_args = ["pandoc", tmpmd, "-o", os.path.join(exp, f"{slug}.epub"), "--toc", "--toc-depth=1", "--resource-path", exp,
                 "--css", os.path.join(HERE, "epub.css"), "--split-level=1"]
    if os.path.exists(cover_jpg):
        epub_args += ["--epub-cover-image", cover_jpg]
    sh(epub_args, cwd=exp)
    for f in ("_corps.html", "_debut.html", "_corps.pdf", "_debut.pdf", "_tout.md"):
        os.path.exists(os.path.join(exp, f)) and os.remove(os.path.join(exp, f))
    meta_state = {"pages": total, "pages_corps": len(rd.pages), "marges": mg, "toc": toc, "construit_le": datetime.datetime.now().isoformat(timespec="seconds")}
    json.dump(meta_state, open(os.path.join(exp, "etat_build.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"OK intérieur : {out_pdf} ({total} pages, petit fond {mg['left']} po)")
    return total


# ---------- couvertures ----------
def cover(book):
    meta = meta_of(book)
    w, h = meta["format_pouces"]
    st = json.load(open(os.path.join(book, "exports", "etat_build.json"), encoding="utf-8"))
    pages = st["pages"]
    spine = pages * SPINE_PER_PAGE[meta.get("papier", "blanc")]
    bleed = .125
    cdir = os.path.join(book, "couverture")
    rel = os.path.relpath(FONTS, cdir)
    tpl = open(os.path.join(cdir, "cover.html"), encoding="utf-8").read()
    vals = {"FONTS": font_css(rel), "W": f"{w}", "H": f"{h}", "SPINE": f"{spine:.4f}", "BLEED": f"{bleed}",
            "TOTALW": f"{2*w+spine+2*bleed:.4f}", "TOTALH": f"{h+2*bleed:.4f}", "SPINE_TEXT": "1" if (pages > 79 and spine >= 0.25) else "0",
            "SPINE_FONT": f"{min(14, (spine - 0.125) * 72 * 0.62):.1f}",
            "KSCALE": f"{1600 / (w * 96):.5f}", "KH": f"{w * 1.6:.4f}"}
    # Texte du dos : autorisé par KDP au-delà de 79 pages, mais on ne l'imprime que si le dos fait >= 0,25 po
    # (sinon les caractères seraient illisibles une fois retirée la marge de 0,0625 po de chaque côté).
    for k, v in vals.items():
        tpl = tpl.replace("{{" + k + "}}", v)
    full = os.path.join(cdir, "_full.html")
    open(full, "w", encoding="utf-8").write(tpl.replace("{{MODE}}", "full"))
    out = os.path.join(cdir, f"{meta['slug']}_couverture_brochee_KDP.pdf")
    node("pdfpage", full, out, f"{2*w+spine+2*bleed:.4f}", f"{h+2*bleed:.4f}")
    # Chromium arrondit la taille de page : on recadre à la dimension KDP exacte (le surplus est dans le fond perdu)
    from pypdf.generic import RectangleObject
    r = PdfReader(out); wpdf = PdfWriter()
    pg = r.pages[0]
    tw, th = (2 * w + spine + 2 * bleed) * 72, (h + 2 * bleed) * 72
    pg.mediabox = RectangleObject([0, float(pg.mediabox.height) - th, tw, float(pg.mediabox.height)])
    pg.cropbox = pg.mediabox; pg.trimbox = pg.mediabox
    wpdf.add_page(pg); wpdf.write(out)
    # Kindle : face avant seule, 1600 x 2560 px (ratio 1,6 recommandé par KDP)
    k = os.path.join(cdir, "_kindle.html")
    open(k, "w", encoding="utf-8").write(tpl.replace("{{MODE}}", "kindle"))
    png = os.path.join(cdir, "_kindle.png")
    node("png", k, png, 1600, 2560)
    sh(["convert", png, "-quality", "92", os.path.join(cdir, f"{meta['slug']}_kindle.jpg")])
    for f in (full, k, png):
        os.remove(f)
    print(f"OK couverture : dos {spine:.3f} po ({pages} pages, papier {meta.get('papier','blanc')}) -> {out}")


# ---------- contrôle technique ----------
def check(book):
    meta = meta_of(book)
    w, h = meta["format_pouces"]
    slug = meta["slug"]
    exp = os.path.join(book, "exports")
    rep, crit = [], 0
    pdf = os.path.join(exp, f"{slug}_interieur_KDP.pdf")
    rd = PdfReader(pdf)
    n = len(rd.pages)
    sizes = {(round(float(p.mediabox.width) / 72, 3), round(float(p.mediabox.height) / 72, 3)) for p in rd.pages}
    ok_size = sizes == {(w, h)}
    rep.append(f"- Format des pages : {sizes} → {'OK' if ok_size else 'ERREUR'} (attendu {w}×{h} po, sans fond perdu)")
    crit += not ok_size
    rep.append(f"- Nombre de pages : {n} → {'OK' if 24 <= n <= 828 else 'ERREUR'} (KDP : 24 à 828) ; pair : {'oui' if n % 2 == 0 else 'non'}")
    st = json.load(open(os.path.join(exp, "etat_build.json"), encoding="utf-8"))
    g = st["marges"]["left"]
    need = gutter_for(n)
    rep.append(f"- Petit fond (reliure) : {g} po, minimum KDP pour {n} p. : {need} po → {'OK' if g >= need else 'ERREUR'}")
    crit += g < need
    rep.append(f"- Marges extérieures/haut/bas : {st['marges']} → {'OK' if min(st['marges'].values()) >= .25 else 'ERREUR'} (min 0,25 po)")
    fonts, unembedded = set(), set()

    def scan(res, seen):
        res = res.get_object() if res is not None else None
        if not res or id(res) in seen:
            return
        seen.add(id(res))
        for _, f in ((res.get("/Font") or {}).items()):
            f = f.get_object()
            if f.get("/Subtype") == "/Type3":  # glyphes dessinés dans le PDF : incorporée par nature
                fonts.add("Type3 (symboles)"); continue
            name = str(f.get("/BaseFont"))
            fonts.add(name.split("+")[-1])
            desc = f.get("/FontDescriptor")
            if f.get("/Subtype") == "/Type0":
                desc = f["/DescendantFonts"][0].get_object().get("/FontDescriptor")
            if desc is None or not any(k in desc.get_object() for k in ("/FontFile", "/FontFile2", "/FontFile3")):
                unembedded.add(name)
        for _, x in ((res.get("/XObject") or {}).items()):
            x = x.get_object()
            if x.get("/Subtype") == "/Form":
                scan(x.get("/Resources"), seen)
    seen = set()
    for p in rd.pages:
        scan(p.get("/Resources"), seen)
    rep.append(f"- Polices : {', '.join(sorted(fonts))} → {'toutes incorporées' if not unembedded else 'NON incorporées : ' + ', '.join(unembedded)}")
    crit += bool(unembedded)
    blanks = [i + 1 for i, p in enumerate(rd.pages) if not (p.extract_text() or "").strip() and not (p.get("/Resources") or {}).get("/XObject")]
    rep.append(f"- Pages sans texte : {blanks or 'aucune'} (attendu : pages volontairement blanches de mise en page uniquement)")
    toc_missing = [t for t, p in st["toc"] if p == "—"]
    rep.append(f"- Sommaire : {len(st['toc'])} entrées, numéros manquants : {toc_missing or 'aucun'}")
    crit += bool(toc_missing)
    cov = os.path.join(book, "couverture", f"{slug}_couverture_brochee_KDP.pdf")
    if os.path.exists(cov):
        c = PdfReader(cov).pages[0]
        cw, ch = float(c.mediabox.width) / 72, float(c.mediabox.height) / 72
        spine = n * SPINE_PER_PAGE[meta.get("papier", "blanc")]
        ew, eh = 2 * w + spine + .25, h + .25
        okc = abs(cw - ew) < .01 and abs(ch - eh) < .01
        rep.append(f"- Couverture brochée : {cw:.3f}×{ch:.3f} po, attendu {ew:.3f}×{eh:.3f} (dos {spine:.3f}) → {'OK' if okc else 'ERREUR'}")
        crit += not okc
    kj = os.path.join(book, "couverture", f"{slug}_kindle.jpg")
    if os.path.exists(kj):
        from PIL import Image
        im = Image.open(kj)
        rep.append(f"- Couverture Kindle : {im.size[0]}×{im.size[1]} px → {'OK' if im.size == (1600, 2560) else 'à vérifier'}")
    for ext in ("docx", "epub"):
        f = os.path.join(exp, f"{slug}.{ext}")
        rep.append(f"- {ext.upper()} : {'présent (' + str(round(os.path.getsize(f)/1e6, 2)) + ' Mo)' if os.path.exists(f) else 'ABSENT'}")
    out = os.path.join(book, "rapport_technique.md")
    open(out, "w", encoding="utf-8").write(f"# Contrôle technique — {meta['titre']}\n\n*{datetime.datetime.now():%d/%m/%Y %H:%M}*\n\n" + "\n".join(rep) +
                                          f"\n\n**Défauts critiques : {crit}**\n")
    print(open(out, encoding="utf-8").read())
    return crit


# ---------- prix ----------
def prix(book):
    meta = meta_of(book)
    w, h = meta["format_pouces"]
    exp = os.path.join(book, "exports")
    n = json.load(open(os.path.join(exp, "etat_build.json"), encoding="utf-8"))["pages"]
    epub = os.path.join(exp, f"{meta['slug']}.epub")
    mb = os.path.getsize(epub) / 1e6 if os.path.exists(epub) else 1.0
    pc = print_cost_eur(n, w, h)
    lines = [f"# Prix et redevances — {meta['titre']}", "",
             f"Pages : {n} · format {w}×{h} po ({'grand format' if is_large_trim(w, h) else 'format standard'}) · coût d'impression Amazon.fr : **{pc:.2f} €**",
             f"Prix minimum possible (broché) : {pc/0.5:.2f} € (à 50 %) ; seuil 60 % : 9,99 €", "",
             "| Prix broché | Taux | Redevance / vente |", "|---|---|---|"]
    for p in meta.get("prix_broche_tests", [meta["prix_broche"]]):
        r, rate = paperback_royalty_eur(p, n, w, h)
        lines.append(f"| {p:.2f} € | {int(rate*100)} % | {r:.2f} € |")
    lines += ["", f"Ebook : fichier ≈ {mb:.2f} Mo (frais de livraison 0,12 €/Mo sur Amazon.fr), TVA 5,5 % déduite.", "",
              "| Prix Kindle TTC | Option | Redevance / vente |", "|---|---|---|"]
    for p in meta.get("prix_kindle_tests", [meta["prix_kindle"]]):
        r, opt = ebook_royalty_eur(p, mb)
        lines.append(f"| {p:.2f} € | {opt} | {r:.2f} € |")
    rb, _ = paperback_royalty_eur(meta["prix_broche"], n, w, h)
    rk, _ = ebook_royalty_eur(meta["prix_kindle"], mb)
    lines += ["", f"**Prix retenus : broché {meta['prix_broche']:.2f} € ({rb:.2f} €/vente), Kindle {meta['prix_kindle']:.2f} € ({rk:.2f} €/vente).**", "",
              "## Scénarios mensuels (illustratifs, PAS des prévisions)", "", "| Ventes/mois (broché + Kindle) | Revenu estimé |", "|---|---|"]
    for b, k in ((5, 5), (20, 20), (50, 50), (150, 150)):
        lines.append(f"| {b} + {k} | {b*rb + k*rk:.2f} € |")
    lines += ["", "Les redevances sont calculées selon les règles KDP vérifiées le 20/11/2026 (marchés EUR). Les ventes réelles peuvent être nulles."]
    out = os.path.join(book, "prix.md")
    open(out, "w", encoding="utf-8").write("\n".join(lines) + "\n")
    print("\n".join(lines))


if __name__ == "__main__":
    cmd, book = sys.argv[1], os.path.abspath(sys.argv[2])
    if cmd in ("build", "all"):
        build(book)
    if cmd in ("cover", "all"):
        cover(book)
    if cmd == "all":  # l'EPUB est reconstruit avec la couverture Kindle
        build(book)
    if cmd in ("check", "all"):
        check(book)
    if cmd in ("prix", "all"):
        prix(book)
