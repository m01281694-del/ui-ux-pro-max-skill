import json,subprocess,numpy as np,sys
SR=44100
TEMPO={"s1":1.04,"s2":1.06,"s3":1.10,"s4":1.12,"s5":1.10,"s6":1.12,"s7":1.06}
def load(p):
    r=subprocess.run(["ffmpeg","-v","error","-i",p,"-ac","1","-ar",str(SR),"-f","f32le","-"],capture_output=True)
    return np.frombuffer(r.stdout,np.float32).copy()
def words(a):
    ch,st,en=a["characters"],a["character_start_times_seconds"],a["character_end_times_seconds"]
    out=[];w="";ws=0;pe=0
    for c,b,e in zip(ch,st,en):
        if c==" ":
            if w: out.append([w,ws,pe]); w=""
            continue
        if not w: ws=b
        w+=c; pe=e
    if w: out.append([w,ws,pe])
    return [x for x in out if not (x[0].startswith("[") and x[0].endswith("]"))]
res={}
for s,tf in TEMPO.items():
    x=load(f"audio/vo/{s}.mp3"); a=json.load(open(f"audio/vo/{s}.align.json"))
    hop=int(SR*0.01); n=len(x)//hop
    rms=np.sqrt(np.mean(x[:n*hop].reshape(n,hop)**2,1)+1e-12); db=20*np.log10(rms)
    sil=db<-40
    # find silent runs
    segs=[];i=0
    while i<n:
        if sil[i]:
            j=i
            while j<n and sil[j]: j+=1
            segs.append((i,j)); i=j
        else: i+=1
    keep=0.16  # seconds kept each side
    cuts=[]
    for i,j in segs:
        st,en=i*0.01,j*0.01
        if i==0: cuts.append((0,max(0,en-0.05))); continue
        if j==n: cuts.append((st+0.15,len(x)/SR)); continue
        if en-st>2*keep+0.05: cuts.append((st+keep,en-keep))
    # build output + time map
    pieces=[];t=0;tmap=[]  # (orig_start, new_start)
    prev=0.0;newt=0.0;fade=int(0.008*SR)
    for c0,c1 in cuts+[(len(x)/SR,len(x)/SR)]:
        seg=x[int(prev*SR):int(c0*SR)].copy()
        if len(seg)>2*fade:
            seg[:fade]*=np.linspace(0,1,fade); seg[-fade:]*=np.linspace(1,0,fade)
        tmap.append((prev,c0,newt)); pieces.append(seg); newt+=len(seg)/SR; prev=c1
    y=np.concatenate(pieces)
    def remap(t):
        for o0,o1,nt in tmap:
            if t<=o1: return nt+max(0,t-o0)
        return newt
    W=words(a)
    for w in W: w[1]=remap(w[1])/tf; w[2]=remap(w[2])/tf
    y.astype(np.float32).tofile("/tmp/_v.raw")
    subprocess.run(["ffmpeg","-v","error","-y","-f","f32le","-ar",str(SR),"-ac","1","-i","/tmp/_v.raw","-af",f"atempo={tf}","-ar",str(SR),f"audio/vo/{s}_edit.wav"],check=True)
    d=float(subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",f"audio/vo/{s}_edit.wav"],capture_output=True,text=True).stdout)
    res[s]={"dur":d,"words":W}
    print(s,round(len(x)/SR,2),"->",round(d,2))
json.dump(res,open("audio/vo/timing.json","w"),ensure_ascii=False,indent=0)
print("total",round(sum(r["dur"] for r in res.values()),2))
