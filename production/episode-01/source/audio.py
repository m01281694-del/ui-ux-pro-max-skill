import json,subprocess,numpy as np,unicodedata,re
SR=44100;TL=json.load(open("timeline.json"));DUR=TL["duration"]+0.3;N=int(DUR*SR)
SC={s["id"]:s for s in TL["scenes"]};B=[SC[f"s{i}"]["start"] for i in range(1,8)]
def norm(w): return re.sub(r"[^a-z0-9']","",unicodedata.normalize("NFD",w.lower()).encode("ascii","ignore").decode())
def cue(sid,w,n=0):
    k=0
    for x in SC[sid]["words"]:
        if norm(x[0]).startswith(norm(w)):
            if k==n: return x[1]
            k+=1
    raise Exception(sid+w)
rs=np.random.default_rng(7)
def load(p,sr=SR):
    r=subprocess.run(["ffmpeg","-v","error","-i",p,"-ac","1","-ar",str(sr),"-f","f32le","-"],capture_output=True);return np.frombuffer(r.stdout,np.float32).astype(np.float64)
def at(buf,t,x,g=1.0):
    i=int(t*SR);
    if i<0: x=x[-i:];i=0
    n=min(len(x),len(buf)-i)
    if n>0: buf[i:i+n]+=x[:n]*g
def lp(x,cut):  # FFT brickwall-ish smooth lowpass
    X=np.fft.rfft(x);f=np.fft.rfftfreq(len(x),1/SR);X*=1/(1+(f/cut)**4);return np.fft.irfft(X,len(x))
def hp(x,cut):
    X=np.fft.rfft(x);f=np.fft.rfftfreq(len(x),1/SR);X*=1/(1+(cut/np.maximum(f,1))**4);return np.fft.irfft(X,len(x))
def reverb(x,dec=2.5,mix=.3,pre=.02):
    L=int(dec*SR);t=np.arange(L)/SR;ir=rs.standard_normal(L)*np.exp(-t*6.9/dec);ir=lp(ir,6000);ir[:int(pre*SR)]=0;ir/=np.sqrt(np.sum(ir**2))
    n=len(x)+L;nf=1<<(n-1).bit_length();y=np.fft.irfft(np.fft.rfft(x,nf)*np.fft.rfft(ir,nf),nf)[:len(x)]
    return x*(1-mix)+y*mix*1.0
hz=lambda m:440*2**((m-69)/12)
def env(n,a,r,sus=1.0):
    e=np.ones(n)*sus;A=int(a*SR);R=int(r*SR);A=min(A,n);e[:A]=np.linspace(0,sus,A);R=min(R,n-A);
    if R>0:e[n-R:]=np.linspace(sus,0,R)
    return e
def pad(notes,dur,amp=.1,bright=6,a=1.2,r=1.5):
    n=int(dur*SR);t=np.arange(n)/SR;y=np.zeros(n)
    for m in notes:
        for det in(-.12,0,.11):
            f=hz(m+det/1)
            for h in range(1,bright+1): y+=np.sin(2*np.pi*f*h*t+h*1.3+det*10)/(h**1.6)
    y*=env(n,a,r)*amp/len(notes)/3;y*=1+.08*np.sin(2*np.pi*.25*t);return y
def pluck(m,dur=.35,amp=.12,bright=1.0):
    n=int(dur*SR);t=np.arange(n)/SR;f=hz(m);y=np.zeros(n)
    for h in range(1,7): y+=np.sin(2*np.pi*f*h*t)*np.exp(-t*(6+h*5*bright))/h
    return y*amp*np.minimum(1,t/.003)
def kick(amp=.6):
    n=int(.45*SR);t=np.arange(n)/SR;f=45+120*np.exp(-t*30);ph=2*np.pi*np.cumsum(f)/SR;return np.sin(ph)*np.exp(-t*7)*amp
def hat(amp=.06):
    n=int(.08*SR);x=hp(rs.standard_normal(n),7000);return x*np.exp(-np.arange(n)/SR*55)*amp
def boom(amp=.9,dur=2.2):
    n=int(dur*SR);t=np.arange(n)/SR;f=38+60*np.exp(-t*9);s=np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*2.2);nz=lp(rs.standard_normal(n),900)*np.exp(-t*9)*.5
    return reverb((s+nz)*amp,3,.35)
def whoosh(dur=.9,amp=.35,up=True):
    n=int(dur*SR);x=rs.standard_normal(n);out=np.zeros(n);blk=2048
    for i in range(0,n,blk):
        p=i/n;fc=(300+5000*p**2) if up else (5000-4500*p);seg=x[i:i+blk]
        if len(seg)<64: break
        out[i:i+len(seg)]=lp(hp(seg,fc*.5),fc*1.6)
    e=np.sin(np.pi*np.linspace(0,1,n))**2*(np.linspace(.3,1,n) if up else 1)
    return out*e*amp
def riser(dur=2.2,amp=.25):
    n=int(dur*SR);t=np.arange(n)/SR;f=120*2**(t/dur*3);s=np.sin(2*np.pi*np.cumsum(f)/SR)*.4+hp(rs.standard_normal(n),2000)*.6;return s*(t/dur)**2.5*amp
def glitch(dur=.35,amp=.25):
    n=int(dur*SR);y=np.zeros(n);i=0
    while i<n:
        L=int(SR*rs.uniform(.01,.04));f=rs.choice([180,320,640,1200,2400]);t=np.arange(L)/SR;y[i:i+L]=np.sign(np.sin(2*np.pi*f*t))[:max(0,min(L,n-i))]*rs.uniform(.3,1)*(rs.random()>.3);i+=L
    return lp(y,6000)*amp
def clink(amp=.12,pitch=1.0):
    n=int(.35*SR);t=np.arange(n)/SR;y=np.zeros(n)
    for f,d in((2650,22),(4120,30),(6310,40),(8820,55)): y+=np.sin(2*np.pi*f*pitch*t+rs.random()*6)*np.exp(-t*d)
    return y*amp/2
def shatter(amp=.3):
    n=int(1.6*SR);y=np.zeros(n)
    for k in range(70):
        st=int(rs.exponential(.18)*SR)
        if st>n-SR//4: continue
        L=int(.25*SR);t=np.arange(L)/SR;f=rs.uniform(2500,9000);y[st:st+L]+=np.sin(2*np.pi*f*t)*np.exp(-t*rs.uniform(20,60))*rs.uniform(.2,1)
    y+=hp(rs.standard_normal(n),3000)*np.exp(-np.arange(n)/SR*7)*.6
    return reverb(y*amp/4,1.8,.3)
def tick(amp=.08):
    n=int(.03*SR);t=np.arange(n)/SR;return hp(rs.standard_normal(n),3000)*np.exp(-t*300)*amp+np.sin(2*np.pi*1800*t)*np.exp(-t*250)*amp
def blip(m,amp=.12):
    n=int(.5*SR);t=np.arange(n)/SR;y=np.sin(2*np.pi*hz(m)*t)*np.exp(-t*9)+.5*np.sin(2*np.pi*hz(m+7)*t)*np.exp(-t*12)+.3*np.sin(2*np.pi*hz(m+12)*t)*np.exp(-t*14)
    return y*amp
def thump(amp=.5):
    n=int(.6*SR);t=np.arange(n)/SR;return np.sin(2*np.pi*np.cumsum(60+80*np.exp(-t*25))/SR)*np.exp(-t*8)*amp

music=np.zeros(N);drums=np.zeros(N);sfx=np.zeros(N)
# chord progressions (MIDI roots in D minor)
Dm=[50,57,62,65];Bb=[46,53,58,62];F=[41,53,57,60];C=[48,55,60,64];Gm=[43,55,58,62];A=[45,52,57,61]
BEAT=60/100
def chords(t0,t1,prog,bar=4*BEAT,amp=.10,bright=6):
    t=t0;i=0
    while t<t1-.2:
        d=min(bar,t1-t)+.8;at(music,t,pad(prog[i%len(prog)],d,amp,bright,a=.5 if i else 1.0,r=.9));t+=bar;i+=1
# s1 mysterious drone
at(music,0,pad([38,45,50],B[1]+.3,.16,4,a=2.5,r=1.2))
at(music,0,pad([62,69],B[1],.035,3,a=4,r=1))
# s2 tension
chords(B[1],B[2],[Dm,Bb,Gm,A],amp=.10,bright=4)
t=B[1]
while t<B[2]-.3: at(drums,t,thump(.35));at(drums,t+BEAT*.75,thump(.18));t+=BEAT*2
# s3 reveal brighter
chords(B[2],B[3],[F,C,Dm,Bb],amp=.11,bright=7)
t=B[2];k=0;arp=[0,7,12,16,19,16,12,7]
while t<B[3]-.2:
    ch=[F,C,Dm,Bb][int((t-B[2])//(4*BEAT))%4];root=ch[0]+12
    at(music,t,pluck(root+[0,7,12,15 if ch in(Dm,) else 16,19,12,7,3 if ch in(Dm,) else 4][k%8],.4,.07));t+=BEAT/2;k+=1
# s4 driving
chords(B[3],B[4],[Dm,Bb,F,C],amp=.10,bright=6)
t=B[3];k=0
while t<B[4]-.2:
    if k%4==0: at(drums,t,kick(.55))
    if k%4==2: at(drums,t,hat(.07))
    at(drums,t+BEAT/4,hat(.03))
    ch=[Dm,Bb,F,C][int((t-B[3])//(4*BEAT))%4];at(music,t,pluck(ch[0]-12+12*(k%2),.25,.09,.6));t+=BEAT/2;k+=1
# s5 epic build
chords(B[4],B[5],[Bb,F,C,Dm],amp=.12,bright=8)
t=B[4];k=0
while t<B[5]-.2:
    if k%2==0: at(drums,t,kick(.6))
    at(drums,t+BEAT/2,hat(.06));
    ch=[Bb,F,C,Dm][int((t-B[4])//(4*BEAT))%4];at(music,t,pluck(ch[(k%4)]+24,.3,.05));at(music,t+BEAT/2,pluck(ch[(k+2)%4]+24,.3,.04))
    t+=BEAT;k+=1
# s6 restrained
chords(B[5],B[6],[Bb,F,Gm,A],amp=.09,bright=5)
t=B[5];tAtt=cue("s6","attention")
while t<B[6]-.3:
    if not (tAtt-.1<t<tAtt+2.5): at(drums,t,thump(.25))
    t+=BEAT*2
# s7 finale
fin=[Bb,F,C,Dm]
chords(B[6],DUR-.5,fin,bar=4*BEAT,amp=.13,bright=8)
t=B[6];k=0
while t<DUR-2.5:
    ch=fin[int((t-B[6])//(4*BEAT))%4];at(music,t,pluck(ch[k%4]+24,1.2,.05,.3));t+=BEAT/2;k+=1
tVen=cue("s7","vendre");t=tVen+.7
while t<DUR-2.5:
    if (t-tVen)%(BEAT)<1e-3 or True: at(drums,t,kick(.5));at(drums,t+BEAT/2,hat(.05))
    t+=BEAT
at(music,DUR-3.2,pad([50,57,62,66,69],3.4,.14,8,a=.05,r=2.8))
# ---- SFX
for i in range(1,7):
    b=B[i];at(sfx,b-.75,whoosh(.9,.32,True));at(sfx,b,boom(.55 if i!=2 else .8))
at(sfx,B[2]-2.3,riser(2.3,.22))
# s1
at(sfx,0.0,boom(.5,3));at(sfx,cue("s1","dix")-.05,whoosh(1.4,.18,False))
at(sfx,cue("s1","oui"),thump(.5));at(sfx,cue("s1","absolument"),glitch(.3,.18));at(sfx,cue("s1","pas"),boom(.55));at(sfx,cue("s1","pas"),glitch(.45,.25))
# s2 clock ticks
tLim=cue("s2","limite");t=B[1]+.1
while t<tLim+.2: at(sfx,t,tick(.06));t+=.16
at(sfx,tLim,boom(.4));at(sfx,cue("s2","salaire")+.35,thump(.6));at(sfx,cue("s2","salaire")+.35,shatter(.12))
for j in range(3): at(sfx,cue("s2","ligne")-.2+j*.25,glitch(.15,.12))
at(sfx,cue("s2","n'existent")+.15,shatter(.45))
# s3 panels
for j,w in enumerate(["formation","numerique","l'affiliation","contenu","clients","marque"]): at(sfx,cue("s3",w)-.15,blip([74,76,77,79,81,84][j],.11))
tv=cue("s3","vend")
for j in range(8): at(sfx,tv+j*1.15,blip(86,.05))
# s4
for w,n in[("dix",0),("deux",0),("trois",0),("six",1)]: at(sfx,cue("s4",w,n),blip(69,.09))
for j in range(6): at(sfx,cue("s4","six")+.1+j*.16+.55,clink(.10,1+j*.03))
at(sfx,cue("s4","tunnel"),boom(.45))
# s5 towers
for w in["choisis","trouve","construis","cree","attire","installe","ameliore"]:
    at(sfx,cue("s5",w)-.25,thump(.5));at(sfx,cue("s5",w)-.1,blip(81,.05))
# s6 coins
tc1=cue("s6","deux");tc2=cue("s6","cent",1);tc3=cue("s6","cinquante",1)
for (t0,n,d,p) in[(tc1-.1,40,1.6,1.15),(tc2-.1,20,1.4,1.0),(tc3-.1,10,1.1,.82)]:
    for j in range(n): at(sfx,t0+j*d/n+.38,clink(.07 if n==40 else .1,p*(1+rs.uniform(-.04,.04))))
at(sfx,cue("s6","concretement")+.1,shatter(.2));at(sfx,cue("s6","attention")-.1,boom(.35))
for w in["temps","offre","clients"]: at(sfx,cue("s6",w),blip(76,.08))
# s7
at(sfx,cue("s7","mais")-.05,boom(.6));at(sfx,cue("s7","mais")-.05,shatter(.35))
at(sfx,cue("s7","vendre")-.3,riser(1.0,.18));at(sfx,cue("s7","vendre")+.65,boom(.75))
at(sfx,cue("s7","abonne"),blip(86,.12));at(sfx,cue("s7","suite")-.2,whoosh(.6,.15))
# ---- voice
vo=np.zeros(N)
for s in TL["scenes"]: at(vo,s["start"],load(f"audio/vo/{s['id']}_edit.wav"))
# voice polish: light presence via hp + small room
vo=hp(vo,70);vo=reverb(vo,.6,.07,.01)
# ---- ducking
w=int(.05*SR);e=np.sqrt(np.convolve(vo**2,np.ones(w)/w,'same'));e=np.convolve(e,np.ones(int(.25*SR))/int(.25*SR),'same');e=e/(e.max()+1e-9)
duck=1-.6*np.clip(e*3,0,1)
music=reverb(music,3.2,.35);drums=reverb(drums,1.2,.15)
bed=(music*1.0+drums*.9)*duck
mix=vo*1.0+bed*0.55+sfx*0.8
# fades
fi=int(.3*SR);mix[:fi]*=np.linspace(0,1,fi);fo=int(.8*SR);mix[-fo:]*=np.linspace(1,0,fo)
mix/=np.abs(mix).max()*1.05
st=np.stack([mix,mix],1)
# stereo width for bed/sfx via small delay
d=int(.012*SR);side=(bed*0.55+sfx*.8);side=side/ (np.abs(side).max()+1e-9)*.08
st[d:,0]+=side[:-d];st[:-d,1]+=side[d:]
st/=np.abs(st).max()*1.02
st.astype(np.float32).tofile("audio/mix.raw")
subprocess.run(["ffmpeg","-v","error","-y","-f","f32le","-ar",str(SR),"-ac","2","-i","audio/mix.raw","-af","loudnorm=I=-14:TP=-1.5:LRA=11","-ar","48000","audio/mix.wav"],check=True)
print("ok",DUR)
