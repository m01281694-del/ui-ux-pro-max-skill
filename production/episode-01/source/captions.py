import json,re
T=json.load(open("timeline.json"))
# multi-word display replacements (lowercased, punctuation-stripped match)
REP=[("dix mille euros","10 000 €"),("dix mille vues","10 000 vues"),("deux pour cent","2 %"),("trois pour cent","3 %"),
("deux cents visiteurs","200 visiteurs"),("cent euros","100 €"),("six cents euros","600 €"),("six ventes","6 ventes"),
("deux cents ventes","200 ventes"),("cinquante euros","50 €"),("cent ventes","100 ventes"),("cinquante ventes","50 ventes"),
("deux cents euros","200 €"),("sept étapes","7 étapes")]
KEY=set("chiffre affaires 10 000 € marketing digital oui absolument pas limite salaire raccourcis différence formation numérique affiliation contenu clients marque confiance simulé 2 % 3 % 6 ventes 600 € tunnel mesure méthode 7 étapes niche problème offre audience vente données 200 ventes 100 ventes 50 ventes 50 € 100 € 200 € chiffre d'affaires garanti temps valeur communiquer vendre abonne-toi suite".split())
BIG={"s1":["Oui.","pas."],"s4":["tunnel."],"s7":["Abonne-toi."]}
def norm(w): return re.sub(r"[^\wà-ÿ']","",w.lower())
out=[]
for sc in T["scenes"]:
    W=sc["words"];toks=[];i=0
    while i<len(W):
        hit=None
        for k,(src,dst) in enumerate(REP):
            n=len(src.split())
            if [norm(x[0]) for x in W[i:i+n]]==src.split():
                tail=re.sub(r"^[\wà-ÿ']+","",W[i+n-1][0]); hit=(n,dst+tail); break
        if hit:
            n,d=hit; toks.append({"w":d,"s":W[i][1],"e":W[i+n-1][2]}); i+=n
        else:
            toks.append({"w":W[i][0],"s":W[i][1],"e":W[i][2]}); i+=1
    # merge standalone punctuation tokens
    m=[]
    for t in toks:
        if re.fullmatch(r"[?!:;…]+",t["w"]) and m: m[-1]["w"]+=" "+t["w"]; m[-1]["e"]=t["e"]
        else: m.append(t)
    for t in m:
        base=norm(t["w"].replace(" ","")); core=re.sub(r"^(l|d|qu)'","",t["w"].strip("?.,:;… ").lower()); t["k"]= (core in KEY) and core!="pas" or t["w"] in ("pas.",) and sc["id"]=="s1" or any(ch.isdigit() for ch in t["w"])
    # chunk: break on punctuation or >3 words / >20 chars
    chunks=[];cur=[]
    for t in m:
        if t["w"] in BIG.get(sc["id"],[]):
            if cur: chunks.append(cur); cur=[]
            chunks.append([dict(t,big=True)]); continue
        cur.append(t)
        txt=" ".join(x["w"] for x in cur)
        if re.search(r"[.?!:,…]$",t["w"]) or len(cur)>=4 or len(txt)>=19:
            chunks.append(cur); cur=[]
    if cur: chunks.append(cur)
    mm=[]
    for c in chunks:
        if mm and len(c)==1 and not c[0].get("big") and not mm[-1][0].get("big") and len(" ".join(x["w"] for x in mm[-1]+c))<=26 and not re.search(r"[.?!]$",mm[-1][-1]["w"]):
            mm[-1]=mm[-1]+c
        else: mm.append(c)
    chunks=mm
    for c in chunks:
        out.append({"scene":sc["id"],"s":c[0]["s"],"e":c[-1]["e"],"big":bool(c[0].get("big")),"words":[{"w":x["w"],"s":x["s"],"e":x["e"],"k":x["k"]} for x in c]})
# extend chunk end to next chunk start (max +0.6s) to avoid flicker
for a,b in zip(out,out[1:]): a["e"]=min(b["s"],a["e"]+0.6)
out[-1]["e"]+=1.0
json.dump(out,open("captions.json","w"),ensure_ascii=False)
for c in out: print(c["scene"],round(c["s"],2),("BIG " if c["big"] else "")+" ".join(("*"+w["w"]+"*") if w["k"] else w["w"] for w in c["words"]))
