import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import {Font} from 'three/addons/loaders/FontLoader.js';
import {TTFLoader} from 'three/addons/loaders/TTFLoader.js';

const W=1080,H=1920,ASP=W/H,PI=Math.PI;
const C={violet:0xa855f7,violet2:0x7c3aed,blue:0x22d3ee,blue2:0x3b82f6,gold:0xf5c76b,white:0xf7f5ff,magenta:0xd946ef};
// ---------- utils
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const lerp=(a,b,t)=>a+(b-a)*t;
const seg=(t,a,b)=>clamp((t-a)/(b-a));
const eOutExpo=x=>x>=1?1:1-Math.pow(2,-10*x);
const eOutCubic=x=>1-Math.pow(1-x,3);
const eInCubic=x=>x*x*x;
const eInOut=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
const eOutBack=x=>{const c1=1.70158,c3=c1+1;return 1+c3*Math.pow(x-1,3)+c1*Math.pow(x-1,2)};
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const $=id=>document.getElementById(id);

const TL=await (await fetch('timeline.json')).json();
const CAPS=await (await fetch('captions.json')).json();
const SC={};TL.scenes.forEach(s=>SC[s.id]=s);
const norm=w=>w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9']/g,'');
function cue(sid,word,n=0,end=false){const ws=SC[sid].words;let k=0;const q=norm(word);
  for(const w of ws){if(norm(w[0]).startsWith(q)){if(k===n)return end?w[2]:w[1];k++;}}
  console.log('CUE MISSING',sid,word);return SC[sid].start;}

await document.fonts.load('800 40px Sora');await document.fonts.load('700 40px Sora');await document.fonts.load('600 40px Sora');
await document.fonts.load('500 40px Inter');await document.fonts.load('700 40px Inter');await document.fonts.load('500 40px Mono');
const font=await new Promise(r=>new TTFLoader().load('node_modules/@fontsource/sora/files/sora-latin-800-normal.woff',j=>r(new Font(j))));

// ---------- renderer & post
const renderer=new THREE.WebGLRenderer({canvas:$('c'),antialias:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
renderer.setPixelRatio(1);renderer.setSize(W,H,false);
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
const rt=new THREE.WebGLRenderTarget(W,H,{type:THREE.HalfFloatType,samples:4});
const composer=new EffectComposer(renderer,rt);
const rpass=new RenderPass(new THREE.Scene(),new THREE.PerspectiveCamera());composer.addPass(rpass);
const bloom=new UnrealBloomPass(new THREE.Vector2(W,H),0.7,0.5,0.78);composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade=new ShaderPass({uniforms:{tDiffuse:{value:null},uTime:{value:0},uTrans:{value:0},uType:{value:0},uAb:{value:.0025},uVig:{value:.55},uGrain:{value:.045},uFlash:{value:0},uFlashCol:{value:new THREE.Color(C.violet)}},
vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
fragmentShader:`uniform sampler2D tDiffuse;uniform float uTime,uTrans,uType,uAb,uVig,uGrain,uFlash;uniform vec3 uFlashCol;varying vec2 vUv;
float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){vec2 uv=vUv;vec2 c=uv-.5;vec3 col;
 if(uTrans>0.01){
  if(uType<0.5){float band=floor(uv.y*28.);float fr=floor(uTime*30.);float j=hash(vec2(band,fr))-.5;uv.x+=j*.16*uTrans*step(.5,hash(vec2(band,fr+7.)));}
  float ab=uAb+uTrans*.018;col=vec3(0.);
  for(int i=0;i<9;i++){float k=float(i)/8.;
   vec2 off=uType>1.5?vec2(0.,k*uTrans*.10):(uType>0.5?vec2(k*uTrans*.10,0.):-c*k*uTrans*.22);
   vec2 u=uv+off;col.r+=texture2D(tDiffuse,u+c*ab).r;col.g+=texture2D(tDiffuse,u).g;col.b+=texture2D(tDiffuse,u-c*ab).b;}
  col/=9.;
 } else {col.r=texture2D(tDiffuse,uv+c*uAb).r;col.g=texture2D(tDiffuse,uv).g;col.b=texture2D(tDiffuse,uv-c*uAb).b;}
 col+=uFlashCol*uFlash;
 float v=smoothstep(.98,.22,length(c*vec2(1.,.62)));col*=mix(1.-uVig,1.,v);
 col=max(col,vec3(.008,.004,.016));
 col+=(hash(vUv*vec2(1080.,1920.)+fract(uTime*7.31))-.5)*uGrain;
 gl_FragColor=vec4(col,1.);}`});
composer.addPass(grade);

// ---------- environment (tinted studio reflections)
const pmrem=new THREE.PMREMGenerator(renderer);
function makeEnv(cols){const s=new THREE.Scene();s.background=new THREE.Color(0x020105);
  const box=new THREE.BoxGeometry(1,1,1);
  cols.forEach(([col,int,pos,scl])=>{const m=new THREE.Mesh(box,new THREE.MeshBasicMaterial({color:new THREE.Color(col).multiplyScalar(int)}));m.position.set(...pos);m.scale.set(...scl);s.add(m);});
  return pmrem.fromScene(s,0.03).texture;}
const ENV=makeEnv([[0xffffff,1.3,[0,9,0],[8,.3,8]],[C.violet,2.6,[-9,2,0],[.3,6,10]],[C.blue,2.2,[9,1,-2],[.3,5,8]],[C.gold,.9,[0,2,9],[8,3,.3]],[0x8866ff,1,[0,0,-10],[10,4,.3]]]);
const ENV_GOLD=makeEnv([[0xffffff,1.2,[0,9,0],[8,.3,8]],[C.gold,2.6,[-9,2,0],[.3,6,10]],[0xffb347,1.6,[9,1,-2],[.3,5,8]],[C.violet,.8,[0,2,9],[8,3,.3]],[0xffffff,.6,[0,0,-10],[10,4,.3]]]);

// ---------- shared builders
function newScene(bg,fogD){const s=new THREE.Scene();s.background=new THREE.Color(bg);if(fogD)s.fog=new THREE.FogExp2(bg,fogD);s.environment=ENV;return s;}
function newCam(fov=40,lift=0){const c=new THREE.PerspectiveCamera(fov,ASP,.1,300);if(lift)c.setViewOffset(W,H,0,lift,W,H);return c;}
function camKF(cam,t,keys){let a=keys[0],b=keys[keys.length-1];
  if(t<=a.t){a=b=keys[0];}else if(t>=b.t){a=b;}else for(let i=0;i<keys.length-1;i++)if(t>=keys[i].t&&t<keys[i+1].t){a=keys[i];b=keys[i+1];break;}
  const k=a===b?0:(b.ease||eInOut)(seg(t,a.t,b.t));
  const p=a.p.map((v,i)=>lerp(v,b.p[i],k)),l=a.l.map((v,i)=>lerp(v,b.l[i],k));
  cam.position.set(...p);cam.lookAt(...l);if(a.r!==undefined||b.r!==undefined)cam.rotateZ(lerp(a.r||0,b.r||0,k));
  const f=lerp(a.f||40,b.f||40,k);if(cam.fov!==f){cam.fov=f;cam.updateProjectionMatrix();}}

const PV=`attribute float aSize;attribute vec3 aColor;attribute float aPhase;uniform float uTime,uScale,uRise,uWrap,uSwirl;varying vec3 vC;varying float vA;
void main(){vec3 p=position;p.y=p.y+mod(uTime*uRise+aPhase*7.,uWrap)-uWrap*.5*step(.001,uRise);
p.x+=sin(uTime*.4+aPhase*6.)*.25*uSwirl;p.z+=cos(uTime*.33+aPhase*4.)*.25*uSwirl;
vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(aSize*uScale/(-mv.z),0.,90.);vC=aColor;vA=.55+.45*sin(uTime*2.3+aPhase*20.);}`;
const PF=`uniform float uOpacity;varying vec3 vC;varying float vA;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,.0,d);a*=a;gl_FragColor=vec4(vC,a*vA*uOpacity);}`;
function particles(n,seed,fn,o={}){const r=rng(seed),P=new Float32Array(n*3),Cc=new Float32Array(n*3),S=new Float32Array(n),Ph=new Float32Array(n);
  for(let i=0;i<n;i++){const q=fn(i,r);P.set(q.p,i*3);Cc.set([q.c.r,q.c.g,q.c.b],i*3);S[i]=q.s;Ph[i]=r();}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('aColor',new THREE.BufferAttribute(Cc,3));g.setAttribute('aSize',new THREE.BufferAttribute(S,1));g.setAttribute('aPhase',new THREE.BufferAttribute(Ph,1));
  const m=new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uOpacity:{value:o.opacity??1},uScale:{value:o.scale??900},uRise:{value:o.rise??0},uWrap:{value:o.wrap??20},uSwirl:{value:o.swirl??1}},vertexShader:PV,fragmentShader:PF,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
  const pts=new THREE.Points(g,m);pts.frustumCulled=false;return pts;}
const pal=(r,list)=>new THREE.Color(list[Math.floor(r()*list.length)]);

function vcone(color,rTop,rBot,h,op=.35){const g=new THREE.CylinderGeometry(rTop,rBot,h,48,1,true);g.translate(0,-h/2,0);
  const m=new THREE.ShaderMaterial({uniforms:{uColor:{value:new THREE.Color(color)},uOp:{value:op}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
  vertexShader:`varying vec3 vN,vV;varying float vY;void main(){vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=normalize(-mv.xyz);vY=uv.y;gl_Position=projectionMatrix*mv;}`,
  fragmentShader:`uniform vec3 uColor;uniform float uOp;varying vec3 vN,vV;varying float vY;void main(){float f=pow(abs(dot(vN,vV)),2.2);float a=f*pow(vY,1.6)*uOp;gl_FragColor=vec4(uColor,a);}`});
  return new THREE.Mesh(g,m);}

function canvasTex(w,h,draw){const cv=document.createElement('canvas');cv.width=w;cv.height=h;const ctx=cv.getContext('2d');draw&&draw(ctx,w,h);const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;t.userData={cv,ctx};return t;}
function gridTex(col='rgba(168,85,247,.9)',n=8){const t=canvasTex(512,512,(c,w,h)=>{c.fillStyle='#000';c.fillRect(0,0,w,h);c.strokeStyle=col;c.lineWidth=2;for(let i=0;i<=n;i++){const p=i*w/n;c.beginPath();c.moveTo(p,0);c.lineTo(p,h);c.stroke();c.beginPath();c.moveTo(0,p);c.lineTo(w,p);c.stroke();}});t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;return t;}
function floor(scene,{reflect=true,size=120,grid=0.55,rep=30,col='rgba(168,85,247,.9)',dark=0x06050b,op=.8}={}){
  if(reflect){const r=new Reflector(new THREE.PlaneGeometry(size,size),{textureWidth:540,textureHeight:960,color:0x8a8a9a,clipBias:.003});r.rotation.x=-PI/2;scene.add(r);}
  const gt=gridTex(col);gt.repeat.set(rep,rep);
  const m=new THREE.Mesh(new THREE.PlaneGeometry(size,size),new THREE.MeshStandardMaterial({color:dark,roughness:.45,metalness:.6,emissive:0xffffff,emissiveMap:gt,emissiveIntensity:grid,transparent:reflect,opacity:reflect?op:1}));
  m.rotation.x=-PI/2;m.position.y=.005;scene.add(m);return m;}
function blob(scene,x,z,r=1,op=.7){const t=canvasTex(128,128,(c,w,h)=>{const g=c.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,`rgba(0,0,0,${op})`);g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(0,0,w,h);});
  const m=new THREE.Mesh(new THREE.PlaneGeometry(r*2,r*2),new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false}));m.rotation.x=-PI/2;m.position.set(x,.012,z);scene.add(m);return m;}

const MAT={
 gold:()=>new THREE.MeshPhysicalMaterial({color:0xf3c46a,metalness:1,roughness:.2,clearcoat:.6,clearcoatRoughness:.15,envMapIntensity:1.5}),
 chrome:()=>new THREE.MeshPhysicalMaterial({color:0xcfc4ff,metalness:1,roughness:.12,clearcoat:1,envMapIntensity:1.3}),
 dark:()=>new THREE.MeshPhysicalMaterial({color:0x0e0b16,metalness:.55,roughness:.28,clearcoat:1,clearcoatRoughness:.1,envMapIntensity:1.2}),
};
function glyphs(text,size,depth,mat){const g=new THREE.Group();const res=font.data.resolution,sc=size/res;let x=0;const items=[];
  for(const ch of text){const gl=font.data.glyphs[ch];const adv=(gl?gl.ha:res*.3)*sc;
    if(ch!==' '){const geo=new TextGeometry(ch,{font,size,depth,curveSegments:10,bevelEnabled:true,bevelThickness:depth*.25,bevelSize:size*.025,bevelSegments:4});
      const m=new THREE.Mesh(geo,mat);m.userData.base=new THREE.Vector3(x,0,0);items.push(m);g.add(m);}
    x+=adv;}
  items.forEach(m=>{m.userData.base.x-=x/2;m.userData.base.y=-size*.36;m.position.copy(m.userData.base);});g.userData.items=items;g.userData.width=x;return g;}

function holoMat(tex,color=C.blue,op=1){return new THREE.ShaderMaterial({uniforms:{map:{value:tex},uColor:{value:new THREE.Color(color)},uOp:{value:op},uTime:{value:0},uGl:{value:0}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
 vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`uniform sampler2D map;uniform vec3 uColor;uniform float uOp,uTime,uGl;varying vec2 vUv;float h(float n){return fract(sin(n)*43758.5);}
 void main(){vec2 uv=vUv;float row=floor(uv.y*40.);uv.x+=(h(row+floor(uTime*24.))-.5)*.08*uGl;vec4 t=texture2D(map,uv);
 float e=min(min(vUv.x,1.-vUv.x),min(vUv.y,1.-vUv.y));float edge=smoothstep(.035,.0,e)*.9;
 float scan=.82+.18*sin(vUv.y*420.+uTime*6.);float fl=.92+.08*sin(uTime*37.);
 vec3 col=(t.rgb*1.15+uColor*.10+uColor*edge)*scan*fl;float a=(max(t.a,.0)*.95+.10+edge)*uOp;gl_FragColor=vec4(col,a);}`});}

// rounded rect helper for canvases
function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}

// ---------- DOM helpers
const labelsEl=$('labels');const LBL={};
function label(id,html,cls,pos3,cam,op,scale=1){let el=LBL[id];if(!el){el=document.createElement('div');el.className='abs lbl '+(cls||'');el.innerHTML=html;labelsEl.appendChild(el);LBL[id]=el;}
  if(el._h!==html){el.innerHTML=html;el._h=html;} if(el._c!==cls){el.className='abs lbl '+(cls||'');el._c=cls;}
  const v=pos3.clone().project(cam);let x=(v.x+1)/2*W,y=(1-v.y)/2*H;x=clamp(x,150,W-170);
  el.style.left=x+'px';el.style.top=y+'px';el.style.opacity=op;el.style.transform=`translate(-50%,-50%) scale(${scale})`;el.style.display=op>0.01?'block':'none';}
function hideLabels(except=''){for(const k in LBL)if(!k.startsWith(except)||!except)LBL[k].style.display='none';}

// ======================================================================================
// SCENE 1 — HOOK
function S1(){const s=newScene(0x030208,.03),cam=newCam(38,-120);const S=SC.s1;
  floor(s,{grid:.5,rep:40});
  // mannequin
  const mat=MAT.dark(),g=new THREE.Group();const add=(geo,x,y,z,sx=1,sy=1,sz=1,rz=0)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.rotation.z=rz;g.add(m);return m;};
  add(new THREE.SphereGeometry(.12,32,24),0,1.69,0,1,1.18,1.05);add(new THREE.CylinderGeometry(.05,.06,.12,16),0,1.54,0);
  add(new THREE.CapsuleGeometry(.17,.36,8,24),0,1.25,0,1.28,1,.72);add(new THREE.CapsuleGeometry(.15,.12,8,24),0,.95,0,1.18,1,.78);
  for(const sd of[-1,1]){add(new THREE.CapsuleGeometry(.055,.27,6,16),sd*.275,1.27,0,1,1,1,sd*.1);add(new THREE.CapsuleGeometry(.047,.25,6,16),sd*.305,.95,.02,1,1,1,sd*.04);
    add(new THREE.SphereGeometry(.05,16,12),sd*.31,.76,.03);add(new THREE.CapsuleGeometry(.08,.36,6,16),sd*.1,.64,0);add(new THREE.CapsuleGeometry(.064,.36,6,16),sd*.1,.25,0);
    add(new THREE.BoxGeometry(.1,.06,.24),sd*.1,.03,.05);}
  g.rotation.y=PI;s.add(g);blob(s,0,0,.9,.85);
  // big number
  const nm=MAT.gold();nm.envMapIntensity=.55;nm.roughness=.3;const num=glyphs('10 000 €',.6,.2,nm);num.position.set(0,3.0,-4.2);s.add(num);
  const r=rng(11);num.userData.items.forEach(m=>{m.userData.from=new THREE.Vector3((r()-.5)*14,(r()-.5)*9,(r()-.2)*12);m.userData.rot=new THREE.Euler((r()-.5)*8,(r()-.5)*8,(r()-.5)*4);});
  // glow behind number
  const halo=new THREE.Mesh(new THREE.PlaneGeometry(12,6),new THREE.MeshBasicMaterial({map:canvasTex(256,128,(c,w,h)=>{const gr=c.createRadialGradient(128,64,0,128,64,128);gr.addColorStop(0,'rgba(168,85,247,.9)');gr.addColorStop(.5,'rgba(124,58,237,.25)');gr.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=gr;c.fillRect(0,0,w,h);}),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));
  halo.position.set(0,3.0,-6.5);s.add(halo);
  // light cones
  const c1=vcone(C.violet,.15,2.2,11,.55);c1.position.set(0,11,0);s.add(c1);
  const c2=vcone(C.blue,.2,3.5,14,.28);c2.position.set(0,14,-6);s.add(c2);
  const c3=vcone(C.violet2,.1,1.6,12,.3);c3.position.set(-4,12,-9);c3.rotation.z=-.25;s.add(c3);
  const c4=vcone(C.blue2,.1,1.6,12,.3);c4.position.set(4,12,-9);c4.rotation.z=.25;s.add(c4);
  // digit atlas particles
  const chars='0123456789€%+$↑';const atlas=canvasTex(1024,64,(c)=>{c.fillStyle='#fff';c.font='800 52px Sora';c.textAlign='center';c.textBaseline='middle';for(let i=0;i<16;i++)c.fillText(chars[i]||'0',i*64+32,34);});
  const N=1600,P=new Float32Array(N*3),Cc=new Float32Array(N*3),Sz=new Float32Array(N),Id=new Float32Array(N),Ph=new Float32Array(N);const rr2=rng(5);
  for(let i=0;i<N;i++){const a=rr2()*PI*2,rad=2.2+Math.pow(rr2(),.7)*13;P.set([Math.cos(a)*rad,1.8+Math.sin(a)*rad*.8+3,-30+rr2()*80],i*3);const col=pal(rr2,[C.violet,C.violet,C.blue,C.gold,0xffffff]);Cc.set([col.r,col.g,col.b],i*3);Sz[i]=.35+rr2()*.9;Id[i]=Math.floor(rr2()*12);Ph[i]=rr2();}
  const dg=new THREE.BufferGeometry();dg.setAttribute('position',new THREE.BufferAttribute(P,3));dg.setAttribute('aColor',new THREE.BufferAttribute(Cc,3));dg.setAttribute('aSize',new THREE.BufferAttribute(Sz,1));dg.setAttribute('aIdx',new THREE.BufferAttribute(Id,1));dg.setAttribute('aPhase',new THREE.BufferAttribute(Ph,1));
  const dm=new THREE.ShaderMaterial({uniforms:{map:{value:atlas},uTime:{value:0},uOp:{value:1}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
   vertexShader:`attribute float aSize,aIdx,aPhase;attribute vec3 aColor;uniform float uTime;varying vec3 vC;varying float vI,vA;void main(){vec3 p=position;p.y+=sin(uTime*.5+aPhase*9.)*.3;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(aSize*1500./(-mv.z),0.,160.);vC=aColor;vI=aIdx;vA=.6+.4*sin(uTime*3.+aPhase*30.);}`,
   fragmentShader:`uniform sampler2D map;uniform float uOp;varying vec3 vC;varying float vI,vA;void main(){vec2 uv=vec2((vI+gl_PointCoord.x)/16.,1.-gl_PointCoord.y);float a=texture2D(map,uv).a;gl_FragColor=vec4(vC*1.6,a*vA*uOp);}`});
  const digits=new THREE.Points(dg,dm);digits.frustumCulled=false;s.add(digits);
  const dust=particles(2500,3,(i,r)=>({p:[(r()-.5)*30,r()*14,-25+r()*60],c:pal(r,[C.violet,C.blue,0xffffff]),s:.04+r()*.08}),{scale:900,swirl:1});s.add(dust);
  // lights
  s.add(new THREE.HemisphereLight(0x3a2a66,0x050308,.6));
  const rim=new THREE.SpotLight(C.violet,260,30,.45,.6,1.6);rim.position.set(0,7,-4.5);rim.target=g;s.add(rim);
  const rim2=new THREE.PointLight(C.blue,40,14,1.6);rim2.position.set(-3,2.2,-1.5);s.add(rim2);
  const rim3=new THREE.PointLight(C.violet,40,14,1.6);rim3.position.set(3,2.2,-1.5);s.add(rim3);
  const gl=new THREE.PointLight(0xffc870,90,16,1.6);gl.position.set(0,4.6,1);s.add(gl);
  const tDix=cue('s1','Dix'),tPos=cue('s1','Possible'),tAbs=cue('s1','Absolument'),tPas=cue('s1','pas'),tVoici=cue('s1','Voici');
  return{scene:s,cam,bloom:.75,update(t){
    const lt=t-S.start;
    camKF(cam,t,[{t:S.start-.4,p:[.6,3.4,48],l:[0,2.4,-5],r:.12,f:44},{t:S.start+3.3,p:[0,1.9,5.6],l:[0,2.3,-5],r:0,f:40,ease:eOutExpo},{t:tAbs,p:[.15,1.85,5.0],l:[0,2.4,-5],f:39},
      {t:tVoici+.2,p:[.1,1.68,3.7],l:[0,2.6,-5],f:36},{t:S.end+.3,p:[1.1,2.25,5.9],l:[0,2.6,-5],r:-.04,f:38}]);
    // shake on "pas"
    const sh=Math.exp(-Math.max(0,t-tPas)*7)*(t>tPas?1:0);cam.position.x+=Math.sin(t*90)*.05*sh;cam.position.y+=Math.cos(t*77)*.05*sh;
    num.userData.items.forEach((m,i)=>{const k=eOutCubic(seg(t,tDix-.15+i*.07,tDix+.85+i*.07));const u=m.userData;
      m.position.lerpVectors(u.base.clone().add(u.from),u.base,k);m.rotation.set(u.rot.x*(1-k),u.rot.y*(1-k)+(t>tPas&&t<tPas+.5?Math.sin(t*60+i)*.1:0),u.rot.z*(1-k));m.scale.setScalar(Math.max(.001,k));
      if(t>tAbs&&t<tPas+.6){m.position.x+=Math.sin(t*70+i*3)*.06;}});
    num.rotation.y=Math.sin(lt*.5)*.12;num.position.y=3.0+Math.sin(lt*.8)*.05;
    halo.material.opacity=.32*seg(t,tDix,tDix+1)*(.85+.15*Math.sin(lt*3));
    gl.intensity=8*seg(t,tDix,tDix+1);
    rim.intensity=110+70*seg(t,tVoici,S.end);c1.material.uniforms.uOp.value=.3+.25*seg(t,tVoici,S.end);
    dm.uniforms.uTime.value=lt;dust.material.uniforms.uTime.value=lt;
    // kicker
    const k=$('kicker');k.classList.toggle('hide',!(t>tVoici-.2));if(t>tVoici-.2){k.innerHTML='Épisode 01 · <b>Marketing digital</b><br>Comment viser 10 000 € par mois ?<span class="rule"></span>';k.style.opacity=eOutCubic(seg(t,tVoici-.2,tVoici+.4));k.style.transform=`translateY(${(1-eOutCubic(seg(t,tVoici-.2,tVoici+.5)))*30}px)`;}
  },leave(){$('kicker').classList.add('hide');}};}

// ======================================================================================
// SCENE 2 — PROBLÈME
function S2(){const s=newScene(0x05060b,.028),cam=newCam(40,-60);const S=SC.s2;s.environment=ENV;
  // cubicle field
  const nx=22,nz=46,n=nx*nz;const desk=new THREE.InstancedMesh(new THREE.BoxGeometry(1.1,.45,.7),new THREE.MeshStandardMaterial({color:0x1a1c26,roughness:.6,metalness:.3}),n);
  const mon=new THREE.InstancedMesh(new THREE.BoxGeometry(.55,.34,.03),new THREE.MeshStandardMaterial({color:0x0b0f18,emissive:0x5b8cff,emissiveIntensity:.9}),n);
  const part=new THREE.InstancedMesh(new THREE.BoxGeometry(.04,.55,.9),new THREE.MeshStandardMaterial({color:0x252836,roughness:.5,metalness:.4}),n);
  const dm=new THREE.Object3D();let k=0;const r=rng(21);
  for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){const x=(i-nx/2)*1.75,z=10-j*1.9;dm.position.set(x,-4.8,z);dm.rotation.set(0,0,0);dm.scale.set(1,1,1);dm.updateMatrix();desk.setMatrixAt(k,dm.matrix);
    dm.position.set(x,-4.4,z-.2);dm.updateMatrix();mon.setMatrixAt(k,dm.matrix);mon.setColorAt(k,new THREE.Color().setHSL(.62,.6,.3+r()*.4));
    dm.position.set(x+.8,-4.75,z);dm.updateMatrix();part.setMatrixAt(k,dm.matrix);k++;}
  s.add(desk,mon,part);
  const fl=new THREE.Mesh(new THREE.PlaneGeometry(80,140),new THREE.MeshStandardMaterial({color:0x0a0b10,roughness:.35,metalness:.7}));fl.rotation.x=-PI/2;fl.position.set(0,-5.03,-30);s.add(fl);
  // giant clock
  const clock=new THREE.Group();clock.position.set(0,1.6,0);s.add(clock);
  clock.add(new THREE.Mesh(new THREE.TorusGeometry(2.1,.09,24,120),MAT.chrome()));
  const face=new THREE.Mesh(new THREE.CircleGeometry(2.05,96),new THREE.MeshPhysicalMaterial({color:0x0a0812,metalness:.3,roughness:.15,transparent:true,opacity:.78,clearcoat:1}));face.position.z=-.04;clock.add(face);
  const tk=new THREE.InstancedMesh(new THREE.BoxGeometry(.035,.18,.03),new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xcfc4ff,emissiveIntensity:.35}),60);
  for(let i=0;i<60;i++){const a=i/60*PI*2;dm.position.set(Math.sin(a)*1.85,Math.cos(a)*1.85,0);dm.rotation.set(0,0,-a);dm.scale.set(i%5?1:1.6,i%5?1:1.7,1);dm.updateMatrix();tk.setMatrixAt(i,dm.matrix);}clock.add(tk);
  const hh=new THREE.Mesh(new THREE.BoxGeometry(.09,1.1,.04),MAT.gold());hh.geometry.translate(0,.5,0);hh.position.z=.06;clock.add(hh);
  const mh=new THREE.Mesh(new THREE.BoxGeometry(.06,1.6,.04),MAT.chrome());mh.geometry.translate(0,.75,0);mh.position.z=.09;clock.add(mh);
  const arcM=new THREE.ShaderMaterial({uniforms:{uP:{value:0},uC:{value:new THREE.Color(C.violet)}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform float uP;uniform vec3 uC;varying vec2 vUv;void main(){vec2 c=vUv-.5;float a=atan(c.x,c.y)/6.2831853;a=fract(a);float r=length(c);float band=smoothstep(.47,.465,r)*smoothstep(.43,.435,r);float on=step(a,uP);gl_FragColor=vec4(uC*.9,band*on*.8);}`});
  const arc=new THREE.Mesh(new THREE.PlaneGeometry(5.4,5.4),arcM);arc.position.z=.02;clock.add(arc);
  // salary bars + ceiling
  const bars=new THREE.Group();bars.position.set(0,-1.2,-14);s.add(bars);const BR=[];
  for(let i=0;i<5;i++){const m=new THREE.Mesh(new THREE.BoxGeometry(.62,1,.62),new THREE.MeshPhysicalMaterial({color:0x8b5cf6,metalness:.2,roughness:.15,transmission:0,emissive:0x7c3aed,emissiveIntensity:.12,clearcoat:1}));
    m.geometry.translate(0,.5,0);m.position.x=(i-2)*.85;bars.add(m);BR.push(m);}
  const ceil=new THREE.Mesh(new THREE.PlaneGeometry(6,3),new THREE.MeshBasicMaterial({map:gridTex('rgba(217,70,239,1)',6),transparent:true,opacity:.0,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,depthWrite:false}));
  ceil.rotation.x=-PI/2;ceil.position.y=3.2;bars.add(ceil);
  const ceilEdge=new THREE.Mesh(new THREE.BoxGeometry(6,.04,.04),new THREE.MeshBasicMaterial({color:0xff4fd8}));ceilEdge.position.set(0,3.2,1.5);bars.add(ceilEdge);
  const sparks=particles(500,8,(i,r)=>({p:[(r()-.5)*4,3.2,(r()-.5)*1.4],c:pal(r,[0xff7ae6,C.gold,0xffffff]),s:.05+r()*.07}),{scale:900,swirl:0});sparks.material.uniforms.uOpacity.value=0;bars.add(sparks);
  const spBase=sparks.geometry.attributes.position.array.slice();
  // fake ad panels (shatter)
  const ads=new THREE.Group();ads.position.set(0,1.4,-28);s.add(ads);
  const mkAd=(t1,t2)=>canvasTex(768,480,(c,w,h)=>{c.clearRect(0,0,w,h);const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,'rgba(217,70,239,.35)');g.addColorStop(1,'rgba(124,58,237,.2)');c.fillStyle=g;rr(c,6,6,w-12,h-12,36);c.fill();
    c.strokeStyle='rgba(255,120,230,.9)';c.lineWidth=6;c.stroke();c.fillStyle='#fff';c.font='800 92px Sora';c.textAlign='center';c.fillText(t1,w/2,205);c.font='700 52px Sora';c.fillStyle='#ffd1f5';c.fillText(t2,w/2,300);
    c.font='700 34px Mono';c.fillStyle='rgba(255,255,255,.75)';c.fillText('▶ CLIQUE ICI',w/2,400);});
  const AD=[['10K€','EN 7 JOURS',-0.9,1.55,-.18],['SANS','EFFORT',.95,.1,.2],['ARGENT','FACILE',-.6,-1.45,-.08]].map(([a,b,x,y,rz],i)=>{
    const tex=mkAd(a,b);const nx=10,ny=7,w=2.3,h=1.44;const pos=[],uv=[],cen=[],rnd=[],idx=[];const rr3=rng(40+i);let v=0;
    for(let ix=0;ix<nx;ix++)for(let iy=0;iy<ny;iy++){const x0=-w/2+ix*w/nx,y0=-h/2+iy*h/ny,x1=x0+w/nx,y1=y0+h/ny;const cx=(x0+x1)/2,cy=(y0+y1)/2;const R=[rr3()-.5,rr3()-.5,rr3()];
      [[x0,y0],[x1,y0],[x1,y1],[x0,y1]].forEach(([px,py])=>{pos.push(px,py,0);uv.push((px+w/2)/w,(py+h/2)/h);cen.push(cx,cy,0);rnd.push(...R);});idx.push(v,v+1,v+2,v,v+2,v+3);v+=4;}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('aC',new THREE.Float32BufferAttribute(cen,3));g.setAttribute('aR',new THREE.Float32BufferAttribute(rnd,3));g.setIndex(idx);
    const m=holoMat(tex,C.magenta,1);m.vertexShader=`attribute vec3 aC,aR;uniform float uB;varying vec2 vUv;
     mat2 rot(float a){return mat2(cos(a),-sin(a),sin(a),cos(a));}
     void main(){vUv=uv;vec3 p=position-aC;p.xy=rot(aR.x*uB*9.)*p.xy;p.yz=rot(aR.y*uB*7.)*p.yz;vec3 c=aC+vec3(aC.xy*uB*2.2+aR.xy*uB*3.,aR.z*uB*4.);c.y-=uB*uB*2.5;gl_Position=projectionMatrix*modelViewMatrix*vec4(c+p*(1.-uB*.4),1.);}`;
    m.uniforms.uB={value:0};const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,0);mesh.rotation.set(0,(x>0?-1:1)*.25,rz);ads.add(mesh);return mesh;});
  const xMark=new THREE.Group();ads.add(xMark);
  [1,-1].forEach(sd=>{const b=new THREE.Mesh(new THREE.BoxGeometry(4.2,.14,.05),new THREE.MeshBasicMaterial({color:0xff3d7f}));b.rotation.z=sd*PI/4;xMark.add(b);});xMark.position.z=.6;
  const dust=particles(1800,9,(i,r)=>({p:[(r()-.5)*20,(r()-.5)*12,10-r()*50],c:pal(r,[0x8aa0ff,0xb59cff,0xffffff]),s:.03+r()*.05}),{scale:900});s.add(dust);
  s.add(new THREE.HemisphereLight(0x5a6a9a,0x0a0a10,.9));
  const key=new THREE.DirectionalLight(0xaab8ff,1.2);key.position.set(3,6,6);s.add(key);
  const vp=new THREE.PointLight(C.violet,14,18,1.6);vp.position.set(2.5,4,4);s.add(vp);
  const bp=new THREE.PointLight(0xff4fd8,0,14,1.6);bp.position.set(0,4,-12);s.add(bp);
  const ap=new THREE.PointLight(0xff4fd8,50,14,1.6);ap.position.set(0,2,-24);s.add(ap);
  const tTemps=cue('s2','temps'),tLim=cue('s2','limite'),tSal=cue('s2','salaire'),tLigne=cue('s2','ligne'),tRac=cue('s2','raccourcis'),tExist=cue('s2',"n'existent");
  return{scene:s,cam,bloom:.6,update(t){const lt=t-S.start;
    camKF(cam,t,[{t:S.start,p:[1.2,4.2,10.5],l:[0,1.2,0],r:.05,f:42},{t:tTemps,p:[0,2.2,7.4],l:[0,1.5,0],f:40},{t:tLim+.6,p:[0,1.9,6.6],l:[0,1.6,0],f:38},
      {t:tSal+.25,p:[-.8,1.6,-6.5],l:[0,1.1,-14],r:-.03,f:40},{t:tLigne,p:[0,1.5,-7.8],l:[0,1.1,-14],f:40},{t:tRac,p:[.3,1.5,-21],l:[0,1.3,-28],f:42},{t:S.end,p:[0,1.4,-22.4],l:[0,1.3,-28],f:42}]);
    const spd=lt<tLim-S.start?1:clamp(1-(t-tLim)*2);
    const ang=lt*4.5*spd+(t>tLim?(tLim-S.start)*4.5:0);mh.rotation.z=-ang*2.4;hh.rotation.z=-ang*.2;
    arcM.uniforms.uP.value=eInOut(seg(t,tTemps,tLim+.3));arcM.uniforms.uC.value.set(t>tLim?0xff4fd8:C.violet);
    clock.rotation.y=Math.sin(lt*.6)*.15;clock.position.y=1.6+Math.sin(lt)*.05;
    if(t>tLim&&t<tLim+.35){clock.position.x=Math.sin(t*80)*.04;}else clock.position.x=0;
    // bars rising to ceiling
    const H0=[1.5,2.2,2.9,3.6,4.3];BR.forEach((b,i)=>{const k=eOutCubic(seg(t,tSal-.5+i*.08,tSal+.5+i*.08));const want=H0[i]*k+.05;const hgt=Math.min(want,4.4);b.scale.y=hgt;b.scale.x=b.scale.z=1+Math.max(0,want-4.4)*.15;});
    ceil.material.opacity=.55*seg(t,tSal-.3,tSal+.2);bp.intensity=25*seg(t,tSal,tSal+.3);
    const hit=t-(tSal+.35);sparks.material.uniforms.uOpacity.value=hit>0?Math.exp(-hit*1.6):0;
    if(hit>0){const a=sparks.geometry.attributes.position.array,rr4=rng(77);for(let i=0;i<a.length/3;i++){const vx=(rr4()-.5)*3,vy=rr4()*2.5,vz=(rr4()-.5)*2;a[i*3]=spBase[i*3]+vx*hit;a[i*3+1]=spBase[i*3+1]+vy*hit-2.5*hit*hit;a[i*3+2]=spBase[i*3+2]+vz*hit;}sparks.geometry.attributes.position.needsUpdate=true;}
    // ads
    AD.forEach((m,i)=>{const ap0=seg(t,tLigne-.2+i*.25,tLigne+.3+i*.25);m.material.uniforms.uOp.value=ap0;m.scale.setScalar(.6+.4*eOutBack(ap0));m.material.uniforms.uTime.value=lt;
      m.material.uniforms.uGl.value=t>tRac?1:.25;m.material.uniforms.uB.value=eOutCubic(seg(t,tExist+.15,tExist+1.4))*1.2;});
    xMark.scale.setScalar(eOutBack(seg(t,tRac+.25,tRac+.55)));xMark.visible=t>tRac+.25&&t<tExist+.3;
    dust.material.uniforms.uTime.value=lt;
  }};}

// ======================================================================================
// SCENE 3 — RÉVÉLATION
function S3(){const s=newScene(0x04030b,.02),cam=newCam(40,-150);const S=SC.s3;
  const ph=new THREE.Group();s.add(ph);ph.scale.setScalar(.82);
  const body=new THREE.Mesh(new RoundedBoxGeometry(1.6,3.3,.17,6,.22),new THREE.MeshPhysicalMaterial({color:0x1c1530,metalness:.9,roughness:.22,clearcoat:1,clearcoatRoughness:.08,envMapIntensity:1.5}));ph.add(body);
  const screenTex=canvasTex(512,1056);const screen=new THREE.Mesh(new THREE.PlaneGeometry(1.46,3.12),new THREE.MeshBasicMaterial({map:screenTex,toneMapped:false}));screen.position.z=.088;ph.add(screen);
  const bezel=new THREE.Mesh(new THREE.PlaneGeometry(1.5,3.16),new THREE.MeshBasicMaterial({color:0x000000}));bezel.position.z=.0865;ph.add(bezel);
  const back=new THREE.Mesh(new THREE.PlaneGeometry(1.46,3.12),new THREE.MeshPhysicalMaterial({color:0x2a1a55,metalness:.6,roughness:.12,clearcoat:1,iridescence:1,iridescenceIOR:1.4}));back.position.z=-.088;back.rotation.y=PI;ph.add(back);
  const camb=new THREE.Mesh(new RoundedBoxGeometry(.5,.5,.06,4,.1),MAT.chrome());camb.position.set(-.42,1.2,-.11);ph.add(camb);
  [[-.53,1.31],[-.31,1.31],[-.53,1.09]].forEach(([x,y])=>{const l=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,.05,32),new THREE.MeshPhysicalMaterial({color:0x05050a,metalness:1,roughness:.05,clearcoat:1}));l.rotation.x=PI/2;l.position.set(x,y,-.15);ph.add(l);});
  // portal rings
  const ring1=new THREE.Mesh(new THREE.TorusGeometry(3.3,.035,16,200),new THREE.MeshBasicMaterial({color:new THREE.Color(C.violet).multiplyScalar(1.2)}));ring1.position.z=-4;s.add(ring1);
  const ring2=new THREE.Mesh(new THREE.TorusGeometry(3.7,.02,16,200),new THREE.MeshBasicMaterial({color:new THREE.Color(C.blue).multiplyScalar(1.1)}));ring2.position.z=-4.6;s.add(ring2);
  const ring3=new THREE.Mesh(new THREE.TorusGeometry(2.6,.012,16,200),new THREE.MeshBasicMaterial({color:new THREE.Color(C.gold).multiplyScalar(1.6)}));ring3.position.z=-3.2;s.add(ring3);
  const disc=new THREE.Mesh(new THREE.CircleGeometry(3.3,96),new THREE.MeshBasicMaterial({map:canvasTex(256,256,(c,w,h)=>{const g=c.createRadialGradient(128,128,0,128,128,128);g.addColorStop(0,'rgba(124,58,237,.65)');g.addColorStop(.6,'rgba(34,211,238,.12)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(0,0,w,h);}),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));disc.position.z=-4.1;s.add(disc);
  const cA=vcone(C.blue,.1,2.6,12,.22);cA.position.set(-2.4,9,-5);cA.rotation.z=-.3;s.add(cA);const cB=vcone(C.violet,.1,2.6,12,.25);cB.position.set(2.4,9,-5);cB.rotation.z=.3;s.add(cB);
  const dust=particles(2600,13,(i,r)=>{const a=r()*PI*2,rad=1+r()*6;return{p:[Math.cos(a)*rad,(r()-.5)*12,Math.sin(a)*rad-2],c:pal(r,[C.blue,C.violet,C.gold,0xffffff]),s:.03+r()*.07}},{scale:900,rise:.25,wrap:12});s.add(dust);
  // holo panels
  const IT=[['formation','FORMATION','Cours en ligne',C.violet],['num','PRODUIT NUMÉRIQUE','E-book · templates',C.blue],['affil','AFFILIATION','Commissions',C.gold],['contenu','CONTENU','Vidéos · posts',C.blue],['clients','CLIENTS','Acquisition',C.violet],['marque','MARQUE PERSO','Confiance',C.gold]];
  const icon=(c,k,x,y,s,col)=>{c.save();c.translate(x,y);c.scale(s,s);c.strokeStyle=col;c.fillStyle=col;c.lineWidth=7;c.lineJoin='round';c.lineCap='round';c.beginPath();
    if(k==='formation'){c.moveTo(-50,-5);c.lineTo(0,-30);c.lineTo(50,-5);c.lineTo(0,20);c.closePath();c.stroke();c.beginPath();c.moveTo(-28,8);c.lineTo(-28,32);c.quadraticCurveTo(0,48,28,32);c.lineTo(28,8);c.stroke();c.beginPath();c.moveTo(50,-5);c.lineTo(50,28);c.stroke();}
    if(k==='num'){rr(c,-32,-42,64,84,10);c.stroke();c.beginPath();c.moveTo(0,-18);c.lineTo(0,18);c.moveTo(-14,4);c.lineTo(0,18);c.lineTo(14,4);c.stroke();}
    if(k==='affil'){rr(c,-48,-16,52,32,16);c.stroke();rr(c,-4,-16,52,32,16);c.stroke();}
    if(k==='contenu'){rr(c,-46,-34,92,68,14);c.stroke();c.beginPath();c.moveTo(-12,-16);c.lineTo(18,0);c.lineTo(-12,16);c.closePath();c.fill();}
    if(k==='clients'){c.arc(-18,-14,14,0,7);c.stroke();c.beginPath();c.arc(22,-10,11,0,7);c.stroke();c.beginPath();c.moveTo(-44,34);c.quadraticCurveTo(-18,0,8,34);c.stroke();c.beginPath();c.moveTo(6,22);c.quadraticCurveTo(24,0,44,30);c.stroke();}
    if(k==='marque'){c.moveTo(-44,24);c.lineTo(-44,-20);c.lineTo(-20,2);c.lineTo(0,-30);c.lineTo(20,2);c.lineTo(44,-20);c.lineTo(44,24);c.closePath();c.stroke();}
    c.restore();};
  const PN=IT.map(([k,t1,t2,col],i)=>{const hex='#'+new THREE.Color(col).getHexString();
    const tex=canvasTex(640,400,(c,w,h)=>{c.clearRect(0,0,w,h);const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'rgba(20,14,40,.85)');g.addColorStop(1,'rgba(8,6,18,.85)');c.fillStyle=g;rr(c,4,4,w-8,h-8,34);c.fill();
      c.strokeStyle=hex;c.lineWidth=5;c.stroke();icon(c,k,w/2,120,1.25,hex);c.fillStyle='#fff';c.font=`800 ${t1.length>12?48:58}px Sora`;c.textAlign='center';c.fillText(t1,w/2,262);c.font='500 34px Inter';c.fillStyle='rgba(235,230,255,.78)';c.fillText(t2,w/2,320);
      c.fillStyle=hex;c.fillRect(w/2-40,348,80,5);});
    const m=new THREE.Mesh(new THREE.PlaneGeometry(1.62,1.01),holoMat(tex,col,0));s.add(m);
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(.007,.007,1,6),new THREE.MeshBasicMaterial({color:new THREE.Color(col).multiplyScalar(2.5),transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));s.add(beam);
    const pulse=new THREE.Mesh(new THREE.SphereGeometry(.035,12,8),new THREE.MeshBasicMaterial({color:new THREE.Color(col).multiplyScalar(4)}));s.add(pulse);
    return{m,beam,pulse,col};});
  const TC=['formation','num','affil','contenu','clients','marque'].map((k,i)=>[cue('s3','formation'),cue('s3','numerique'),cue('s3',"l'affiliation"),cue('s3','contenu'),cue('s3','clients'),cue('s3','marque')][i]);
  const tVend=cue('s3','vend'),tDiff=cue('s3','difference');
  s.add(new THREE.HemisphereLight(0x6a5aa0,0x05030a,.7));const kl=new THREE.PointLight(C.blue,60,16,1.6);kl.position.set(-3,2,3);s.add(kl);const kl2=new THREE.PointLight(C.violet,70,16,1.6);kl2.position.set(3,-1,2.5);s.add(kl2);
  const kl3=new THREE.PointLight(0xffffff,25,12,1.6);kl3.position.set(0,4,4);s.add(kl3);
  const tmp=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
  function drawScreen(t){const c=screenTex.userData.ctx,w=512,h=1056;const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#160c2e');g.addColorStop(1,'#07040f');c.fillStyle=g;c.fillRect(0,0,w,h);
    c.fillStyle='rgba(255,255,255,.85)';c.font='600 22px Inter';c.fillText('9:41',36,46);c.fillText('●●●  5G',w-130,46);
    c.font='700 26px Sora';c.fillStyle='rgba(235,230,255,.7)';c.fillText('Boutique en ligne',36,120);c.font='800 54px Sora';c.fillStyle='#fff';c.fillText('Ventes du jour',36,182);
    c.font='600 20px Mono';c.fillStyle='#22d3ee';c.fillText('● DÉMO · DONNÉES FICTIVES',36,222);
    // chart
    c.strokeStyle='rgba(255,255,255,.08)';c.lineWidth=1;for(let i=0;i<5;i++){c.beginPath();c.moveTo(36,300+i*45);c.lineTo(w-36,300+i*45);c.stroke();}
    const prog=clamp((t-tVend)/7);c.beginPath();for(let i=0;i<=60;i++){const x=36+i/60*(w-72);const v=Math.pow(i/60,1.6)*.85+Math.sin(i*.7)*.04;const y=470-v*170;if(i/60>prog)break;i?c.lineTo(x,y):c.moveTo(x,y);}
    const lg=c.createLinearGradient(0,0,w,0);lg.addColorStop(0,'#7c3aed');lg.addColorStop(1,'#22d3ee');c.strokeStyle=lg;c.lineWidth=6;c.stroke();
    // notifications
    const N=Math.floor(clamp((t-tVend)/1.15,0,9));
    for(let i=0;i<Math.min(N+1,5);i++){const idx=N-i;if(idx<0)break;const age=t-tVend-idx*1.15;if(age<0)continue;const a=eOutBack(clamp(age/.35));const y=540+i*100+(1-a)*-60;c.globalAlpha=(i===4?.4:1)*clamp(age/.2);
      c.fillStyle='rgba(255,255,255,.09)';rr(c,30,y,w-60,84,22);c.fill();c.strokeStyle=i===0?'rgba(245,199,107,.9)':'rgba(168,85,247,.4)';c.lineWidth=2.5;c.stroke();
      c.fillStyle=i===0?'#f5c76b':'#a855f7';c.beginPath();c.arc(76,y+42,20,0,7);c.fill();c.fillStyle='#0b0616';c.font='800 22px Sora';c.textAlign='center';c.fillText('€',76,y+50);c.textAlign='left';
      c.fillStyle='#fff';c.font='700 24px Sora';c.fillText('Nouvelle commande',112,y+36);c.fillStyle='rgba(235,230,255,.7)';c.font='500 20px Inter';c.fillText(['Formation','E-book','Template','Coaching'][idx%4]+' · il y a '+(i? i+' min':'1 s'),112,y+64);c.globalAlpha=1;}
    screenTex.needsUpdate=true;}
  return{scene:s,cam,bloom:1.0,update(t){const lt=t-S.start;
    const ang=lerp(-.5,.42,eInOut(seg(t,S.start,S.end)));const rad=lerp(7.2,8.6,eOutCubic(seg(t,S.start,S.start+2)));
    cam.position.set(Math.sin(ang)*rad,.3+Math.sin(lt*.4)*.15,Math.cos(ang)*rad);cam.lookAt(0,.2,0);
    const spin=eOutExpo(seg(t,S.start,S.start+1.8));ph.rotation.set(.08*Math.sin(lt*.7),-PI*3*(1-spin)+Math.sin(lt*.6)*.28+.15,.05*Math.sin(lt*.5));ph.position.y=Math.sin(lt*.9)*.08;
    ph.scale.setScalar(1.0*(.3+.7*eOutCubic(seg(t,S.start,S.start+1.2))));
    drawScreen(t);
    ring1.rotation.z=lt*.15;ring2.rotation.z=-lt*.1;ring2.rotation.x=Math.sin(lt*.3)*.15;ring3.rotation.x=.3+lt*.2;
    const rev=eOutCubic(seg(t,tDiff-.2,tDiff+.8));ring1.scale.setScalar(.6+.4*rev);ring2.scale.setScalar(.5+.5*rev);disc.material.opacity=rev;
    PN.forEach((p,i)=>{const a0=TC[i]-.15;const k=seg(t,a0,a0+.45);const a=i*1.05+lt*.22+.4;const y=2.35-i*.95;const r=1.5;
      p.m.position.set(Math.sin(a)*r,y,Math.cos(a)*r*.55+.35);p.m.lookAt(cam.position.x,y,cam.position.z);p.m.scale.setScalar(Math.max(.001,.8*eOutBack(k)));p.m.material.uniforms.uOp.value=k;p.m.material.uniforms.uTime.value=lt+i;
      p.m.material.uniforms.uGl.value=k<1?1-k:0;
      const from=tmp.set(0,ph.position.y+.2,0),to=p.m.position;const d=to.clone().sub(from);p.beam.position.copy(from).addScaledVector(d,.5);p.beam.scale.set(1,d.length(),1);p.beam.quaternion.setFromUnitVectors(up,d.clone().normalize());
      p.beam.material.opacity=.7*k;const ph2=((lt*1.3+i*.3)%1);p.pulse.position.copy(from).addScaledVector(d,ph2);p.pulse.visible=k>.5;});
    dust.material.uniforms.uTime.value=lt;
  }};}

// ======================================================================================
// SCENE 4 — DÉMONSTRATION (funnel + dashboard)
function S4(){const s=newScene(0x03050c,.02),cam=newCam(40,-110);const S=SC.s4;
  const LV=[{y:2.3,r:1.55,c:C.blue},{y:.95,r:1.05,c:C.violet},{y:-.25,r:.62,c:C.violet2},{y:-1.2,r:.3,c:C.gold}];
  const rings=LV.map(l=>{const m=new THREE.Mesh(new THREE.TorusGeometry(l.r,.028,16,160),new THREE.MeshBasicMaterial({color:new THREE.Color(l.c).multiplyScalar(2.4)}));m.rotation.x=PI/2;m.position.y=l.y;s.add(m);return m;});
  const shellM=(c)=>new THREE.ShaderMaterial({uniforms:{uC:{value:new THREE.Color(c)},uT:{value:0},uOp:{value:1}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
    vertexShader:`varying vec3 vN,vV;varying vec2 vUv;void main(){vUv=uv;vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform vec3 uC;uniform float uT,uOp;varying vec3 vN,vV;varying vec2 vUv;void main(){float f=1.-abs(dot(vN,vV));float lines=smoothstep(.92,1.,sin((vUv.y*14.+uT*1.5)*6.2831)*.5+.5);float meri=smoothstep(.96,1.,sin(vUv.x*6.2831*16.)*.5+.5);
     float a=(pow(f,2.)*.55+lines*.35+meri*.18)*uOp;gl_FragColor=vec4(uC*1.4,a);}`});
  const shells=[];for(let i=0;i<3;i++){const a=LV[i],b=LV[i+1];const g=new THREE.CylinderGeometry(a.r,b.r,a.y-b.y,96,1,true);const m=new THREE.Mesh(g,shellM(a.c));m.position.y=(a.y+b.y)/2;s.add(m);shells.push(m);}
  // flowing particles CPU
  const N=1400,r=rng(31),P=new Float32Array(N*3),Cc=new Float32Array(N*3),Sz=new Float32Array(N),Ph=new Float32Array(N);const meta=[];
  for(let i=0;i<N;i++){const u=r();const L=u<.03?3:u<.09?2:u<.35?1:0;meta.push({ph:r(),a0:r()*PI*2,L,sp:.35+r()*.2,out:r()*PI*2});const col=new THREE.Color([C.blue,C.violet,0xd8b4fe,C.gold][L]);Cc.set([col.r,col.g,col.b],i*3);Sz[i]=L===3?.16:.06+r()*.05;Ph[i]=r();}
  const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(P,3));pg.setAttribute('aColor',new THREE.BufferAttribute(Cc,3));pg.setAttribute('aSize',new THREE.BufferAttribute(Sz,1));pg.setAttribute('aPhase',new THREE.BufferAttribute(Ph,1));
  const pm=new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uOpacity:{value:1},uScale:{value:900},uRise:{value:0},uWrap:{value:1},uSwirl:{value:0}},vertexShader:PV,fragmentShader:PF,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
  const flow=new THREE.Points(pg,pm);flow.frustumCulled=false;s.add(flow);
  const prof=y=>{if(y>=LV[0].y)return LV[0].r*1.05;for(let i=0;i<3;i++){const a=LV[i],b=LV[i+1];if(y<=a.y&&y>=b.y)return lerp(b.r,a.r,(y-b.y)/(a.y-b.y))*.92;}return LV[3].r*.8;};
  // coins out the bottom
  const coinG=new THREE.CylinderGeometry(.16,.16,.035,40);const coins=[];for(let i=0;i<6;i++){const m=new THREE.Mesh(coinG,MAT.gold());s.add(m);coins.push(m);}
  // dashboard
  const dashTex=canvasTex(1024,640);const dash=new THREE.Mesh(new THREE.PlaneGeometry(4.3,2.69),holoMat(dashTex,C.blue,1));dash.position.set(0,4.75,-2.2);dash.rotation.x=.12;s.add(dash);
  const dust=particles(1500,33,(i,r)=>({p:[(r()-.5)*14,(r()-.5)*12+1,-6+r()*10],c:pal(r,[C.blue,C.violet,0xffffff]),s:.03+r()*.05}),{scale:900});s.add(dust);
  const grid=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshBasicMaterial({map:(()=>{const t=gridTex('rgba(34,211,238,.6)',8);t.repeat.set(10,10);return t;})(),transparent:true,opacity:.35,blending:THREE.AdditiveBlending,depthWrite:false}));grid.rotation.x=-PI/2;grid.position.y=-2.3;s.add(grid);
  s.add(new THREE.HemisphereLight(0x8090ff,0x050308,.8));const gl=new THREE.PointLight(0xffc870,40,8,1.6);gl.position.set(0,-1.5,1.5);s.add(gl);
  const tSim=cue('s4','simule'),tVid=cue('s4','video'),tDix=cue('s4','dix'),tDeux=cue('s4','deux'),tDeuxC=cue('s4','deux',1),tTrois=cue('s4','trois'),tCent=cue('s4','cent',1),tSix=cue('s4','six'),tSixC=cue('s4','six',1),tTun=cue('s4','tunnel'),tMes=cue('s4','mesure');
  const tmpv=new THREE.Vector3();
  function count(t,a,b,v){return Math.round(v*eOutCubic(seg(t,a,b)));}
  function drawDash(t){const c=dashTex.userData.ctx,w=1024,h=640;c.clearRect(0,0,w,h);c.fillStyle='rgba(6,10,24,.82)';rr(c,6,6,w-12,h-12,40);c.fill();c.strokeStyle='rgba(34,211,238,.8)';c.lineWidth=4;c.stroke();
    c.font='700 30px Mono';c.fillStyle='#22d3ee';c.fillText('TABLEAU DE BORD · SIMULATION',48,70);c.fillStyle='rgba(255,255,255,.5)';c.font='500 24px Inter';c.fillText('Tunnel de vente — 1 vidéo',48,108);
    const K=[['VUES',count(t,tDix,tDix+1.2,10000),'#22d3ee'],['CLICS',count(t,tDeuxC-.6,tDeuxC+.6,200),'#a855f7'],['VENTES',count(t,tSix,tSix+.6,6),'#d8b4fe'],['CA',count(t,tSixC,tSixC+.8,600)+' €','#f5c76b']];
    K.forEach(([k,v,col],i)=>{const x=48+i*236,y=150;c.fillStyle='rgba(255,255,255,.06)';rr(c,x,y,216,150,24);c.fill();c.strokeStyle=col;c.globalAlpha=.6;c.lineWidth=2;c.stroke();c.globalAlpha=1;
      c.fillStyle='rgba(255,255,255,.65)';c.font='600 22px Mono';c.fillText(k,x+22,y+44);c.fillStyle=col;c.font='800 52px Sora';c.fillText(typeof v==='number'?v.toLocaleString('fr-FR'):v,x+22,y+112);});
    const p=seg(t,tVid,tMes+.5);c.beginPath();for(let i=0;i<=80;i++){if(i/80>p)break;const x=60+i/80*(w-120);const y=560-Math.pow(i/80,1.4)*190-Math.sin(i*.45)*14*(i/80);i?c.lineTo(x,y):c.moveTo(x,y);}
    const lg=c.createLinearGradient(0,0,w,0);lg.addColorStop(0,'#22d3ee');lg.addColorStop(.6,'#a855f7');lg.addColorStop(1,'#f5c76b');c.strokeStyle=lg;c.lineWidth=7;c.stroke();
    if(t>tMes-.3){const a=seg(t,tMes-.3,tMes+.2);c.globalAlpha=a;c.fillStyle='#f5c76b';c.font='800 30px Sora';c.fillText('CHAQUE ÉTAPE SE MESURE ✓',w-500,400);c.globalAlpha=1;}
    dashTex.needsUpdate=true;}
  return{scene:s,cam,bloom:.95,update(t){const lt=t-S.start;
    camKF(cam,t,[{t:S.start,p:[0,7.5,5.8],l:[0,.6,0],f:44},{t:tDeux,p:[.6,3.8,8.2],l:[0,.7,0],f:40},{t:tSix,p:[-.4,1.2,9.2],l:[0,.5,0],f:40},{t:tTun+.1,p:[0,1.6,10.6],l:[0,1.6,0],f:40},{t:S.end,p:[.35,2.1,10.8],l:[0,2.1,0],f:40}]);
    const glow=[seg(t,tDix,tDix+.4),seg(t,tDeux,tDeux+.4),seg(t,tTrois,tTrois+.4),seg(t,tSix,tSix+.4)];
    rings.forEach((m,i)=>{m.material.color.set(LV[i].c).multiplyScalar(1+2.4*glow[i]);m.rotation.z=lt*.3*(i%2?1:-1);const k=eOutBack(seg(t,S.start+i*.12,S.start+.6+i*.12));m.scale.setScalar(Math.max(.001,k));});
    shells.forEach((m,i)=>{m.material.uniforms.uT.value=lt;m.material.uniforms.uOp.value=seg(t,S.start+.2,S.start+1)*(.5+.5*glow[i+1]);});
    const a=pg.attributes.position.array;const on=seg(t,tVid-.3,tVid+.6);
    for(let i=0;i<N;i++){const m=meta[i];const ph=((lt*m.sp+m.ph)%1);let y=3.9-ph*5.6;const stop=[LV[1].y,LV[2].y,LV[3].y,-2.6][m.L];let x,z;
      if(y>=stop){const rr5=prof(y);const ang=m.a0+lt*1.2+y*1.6;x=Math.cos(ang)*rr5;z=Math.sin(ang)*rr5;}
      else{const d=stop-y;const rr5=prof(stop)+d*1.8;const ang=m.out;x=Math.cos(ang)*rr5;z=Math.sin(ang)*rr5;y=stop-d*.25;}
      const vis=on*(y<stop-1.2?0:1);a[i*3]=x*vis+(1-vis)*1e3;a[i*3+1]=y;a[i*3+2]=z;}
    pg.attributes.position.needsUpdate=true;pm.uniforms.uTime.value=lt;
    coins.forEach((m,i)=>{const t0=tSix+.1+i*.16;const k=seg(t,t0,t0+.55);m.visible=k>0;const x=(i-2.5)*.38;m.position.set(lerp(0,x,eOutCubic(k)),lerp(-1.2,-1.95,eOutCubic(k))+Math.sin(k*PI)*.3,lerp(0,.9,k));m.rotation.set(PI/2*.9+ (1-k)*6,lt*.8+i,0);});
    gl.intensity=50*seg(t,tSix,tSix+.5);
    drawDash(t);dash.material.uniforms.uTime.value=lt;dash.material.uniforms.uOp.value=seg(t,tSim,tSim+.6);
    dust.material.uniforms.uTime.value=lt;
    $('badge').classList.remove('hide');$('badge').style.opacity=seg(t,S.start+.1,S.start+.5);
    const L=[[0,'<b>10 000</b> VUES','blue',tDix,new THREE.Vector3(LV[0].r+.2,LV[0].y,0)],[1,'<b>2 %</b> → 200 VISITEURS','',tDeux,new THREE.Vector3(LV[1].r+.3,LV[1].y,0)],[2,'<b>3 %</b> → 6 VENTES','',tTrois,new THREE.Vector3(LV[2].r+.4,LV[2].y,0)],
      [3,'<b>6 × 100 € = 600 €</b><small>chiffre d\'affaires simulé</small>','gold',tSixC,new THREE.Vector3(0,-2.6,.9)]];
    L.forEach(([i,html,cls,t0,p])=>{const k=eOutBack(seg(t,t0-.1,t0+.3));const pp=p.clone();if(i>=1&&t>tTun-.2)return label('f'+i,html,cls,pp,cam,0);if(i<3){pp.x=Math.max(pp.x,1.2);}label('f'+i,html,cls,pp,cam,seg(t,t0-.1,t0+.15),.6+.4*k);});
  },leave(){$('badge').classList.add('hide');hideLabels();}};}

// ======================================================================================
// SCENE 5 — STRATÉGIE (city of 7 towers)
function S5(){const s=newScene(0x040310,.035),cam=newCam(40,-120);const S=SC.s5;
  floor(s,{grid:.45,rep:50,col:'rgba(124,58,237,.9)'});
  const win=canvasTex(128,512,(c,w,h)=>{c.fillStyle='#000';c.fillRect(0,0,w,h);const r=rng(55);for(let y=8;y<h;y+=18)for(let x=8;x<w;x+=20){if(r()<.42){c.fillStyle=r()<.25?'#f5c76b':r()<.5?'#a855f7':'#8fb6ff';c.globalAlpha=.4+r()*.6;c.fillRect(x,y,12,10);}}c.globalAlpha=1;});
  const city=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:0x0b0a14,metalness:.7,roughness:.35,emissive:0xffffff,emissiveMap:win,emissiveIntensity:.9}),420);
  const dm=new THREE.Object3D(),r=rng(66);let k=0;
  while(k<420){const a=r()*PI*2,rad=7+r()*30;const x=Math.cos(a)*rad,z=Math.sin(a)*rad-6;if(z>-7&&Math.abs(x)<10)continue;const h=1+Math.pow(r(),2)*10;dm.position.set(x,h/2,z);dm.scale.set(.8+r()*1.4,h,.8+r()*1.4);dm.rotation.y=r()*PI;dm.updateMatrix();city.setMatrixAt(k++,dm.matrix);}
  s.add(city);
  const STEPS=[['choisis','NICHE'],['trouve','PROBLÈME'],['construis','OFFRE'],['cree','CONTENU'],['attire','AUDIENCE'],['installe','VENTE'],['ameliore','DONNÉES']];
  const TT=STEPS.map(([w])=>cue('s5',w));
  const cols=[C.violet,C.violet,C.blue2,C.blue,C.blue,C.gold,C.gold];
  const TW=STEPS.map((st,i)=>{const g=new THREE.Group();const h=1.1+i*.55;const x=-1.55+i*.52,z=-i*.75;g.position.set(x,0,z);s.add(g);
    const body=new THREE.Mesh(new THREE.BoxGeometry(.4,h,.4),new THREE.MeshPhysicalMaterial({color:0x120e22,metalness:.85,roughness:.18,clearcoat:1,emissive:cols[i],emissiveIntensity:.08}));body.geometry.translate(0,h/2,0);g.add(body);
    const ed=new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry),new THREE.LineBasicMaterial({color:new THREE.Color(cols[i]).multiplyScalar(3)}));g.add(ed);
    const cap=new THREE.Mesh(new THREE.BoxGeometry(.44,.05,.44),new THREE.MeshBasicMaterial({color:new THREE.Color(cols[i]).multiplyScalar(3)}));cap.position.y=h;g.add(cap);
    const beam=vcone(cols[i],.18,.05,3.5,.0);beam.rotation.x=PI;beam.position.y=h;g.add(beam);
    const ring=new THREE.Mesh(new THREE.RingGeometry(.3,.36,64),new THREE.MeshBasicMaterial({color:new THREE.Color(cols[i]).multiplyScalar(3),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));ring.rotation.x=-PI/2;ring.position.y=.02;g.add(ring);
    const pl=new THREE.PointLight(cols[i],0,4,1.6);pl.position.set(0,h+.3,.3);g.add(pl);
    return{g,h,beam,ring,pl,top:new THREE.Vector3(x,h,z)};});
  // data link line
  const lineG=new THREE.BufferGeometry().setFromPoints(TW.map(t=>t.top.clone().add(new THREE.Vector3(0,.05,0))));
  const line=new THREE.Line(lineG,new THREE.LineBasicMaterial({color:new THREE.Color(C.gold).multiplyScalar(3),transparent:true,opacity:0}));s.add(line);
  const linkTube=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(TW.map(t=>t.top.clone().add(new THREE.Vector3(0,.12,0)))),120,.018,8),new THREE.MeshBasicMaterial({color:new THREE.Color(C.gold).multiplyScalar(2.5),transparent:true,opacity:0}));s.add(linkTube);
  const dust=particles(2200,57,(i,r)=>({p:[(r()-.5)*16,r()*9,-14+r()*20],c:pal(r,[C.violet,C.blue,C.gold,0xffffff]),s:.03+r()*.06}),{scale:900,rise:.2,wrap:9});s.add(dust);
  s.add(new THREE.HemisphereLight(0x4a3a88,0x050308,.6));const mp=new THREE.PointLight(C.violet,40,20,1.6);mp.position.set(-3,5,3);s.add(mp);
  const tMeth=cue('s5','methode');
  return{scene:s,cam,bloom:1.0,update(t){const lt=t-S.start;
    let cur=-1;TT.forEach((tt,i)=>{if(t>=tt-.15)cur=i;});
    TW.forEach((w,i)=>{const k=eOutCubic(seg(t,TT[i]-.25,TT[i]+.45));w.g.scale.set(1,Math.max(.001,k),1);w.g.visible=k>0;const b=seg(t,TT[i]-.2,TT[i]+.2)*(1-seg(t,TT[i]+.4,TT[i]+1.4));
      w.beam.material.uniforms.uOp.value=.9*b+(.15*(k>=1?1:0));w.ring.scale.setScalar(1+seg(t,TT[i]-.1,TT[i]+.9)*5);w.ring.material.opacity=1-seg(t,TT[i]-.1,TT[i]+.9);w.pl.intensity=6+20*b;});
    const fin=seg(t,TT[6],TT[6]+.9);linkTube.material.opacity=fin;
    // camera follows
    const ci=Math.max(0,cur);const tgt=TW[ci].top;
    const prog=seg(t,TT[0]-.6,TT[6]+.4);
    const base=[lerp(-3.4,3.1,eInOut(prog)),lerp(1.6,4.6,eInOut(prog)),lerp(5.2,6.4,prog)];
    const look=[lerp(-1.2,0,prog),lerp(.9,1.9,prog),lerp(-.4,-2.1,prog)];
    const intro=1-eOutCubic(seg(t,S.start,TT[0]-.3));
    cam.position.set(base[0]-intro*1.5,base[1]+intro*3.5,base[2]+intro*4);cam.lookAt(look[0],look[1]-intro*.3,look[2]);
    const fov=40+intro*6;if(cam.fov!==fov){cam.fov=fov;cam.updateProjectionMatrix();}
    dust.material.uniforms.uTime.value=lt;
    const st=$('step');st.classList.remove('hide');st.style.opacity=seg(t,tMeth,tMeth+.5);
    const n=Math.max(0,cur+1);const html=n===0?`LA MÉTHODE EN <b>7</b> ÉTAPES<div class="bar"><i style="width:0%"></i></div>`:`MÉTHODE · ÉTAPE <b>${n}</b> / 7<div class="bar"><i style="width:${n/7*100}%"></i></div>`;if(st._h!==html){st.innerHTML=html;st._h=html;}
    TW.forEach((w,i)=>{const k=seg(t,TT[i]+.05,TT[i]+.35);const active=i===cur;const p=w.top.clone().add(new THREE.Vector3(0,.42,0));
      label('t'+i,`<b>${String(i+1).padStart(2,'0')}</b> ${STEPS[i][1]}`,active?'gold':'dim',p,cam,k,active?1+.15*(1-seg(t,TT[i]+.05,TT[i]+.4)):.78);});
  },leave(){$('step').classList.add('hide');hideLabels();}};}

// ======================================================================================
// SCENE 6 — OBJECTIF 10 000 €
function S6(){const s=newScene(0x070409,.03),cam=newCam(40,40);const S=SC.s6;s.environment=ENV_GOLD;
  const fl=new THREE.Mesh(new THREE.CircleGeometry(30,96),new THREE.MeshPhysicalMaterial({color:0x0b0810,metalness:.9,roughness:.25,clearcoat:1,clearcoatRoughness:.2,envMapIntensity:.6}));fl.rotation.x=-PI/2;s.add(fl);
  const ped=new THREE.Mesh(new THREE.CylinderGeometry(3.2,3.35,.18,96),new THREE.MeshPhysicalMaterial({color:0x14101e,metalness:.9,roughness:.2,clearcoat:1}));ped.position.y=.09;s.add(ped);
  const pedRing=new THREE.Mesh(new THREE.TorusGeometry(3.28,.02,12,200),new THREE.MeshBasicMaterial({color:new THREE.Color(C.gold).multiplyScalar(2.5)}));pedRing.rotation.x=PI/2;pedRing.position.y=.18;s.add(pedRing);
  const num=glyphs('10 000 €',.8,.25,MAT.gold());num.position.set(0,2.5,0);s.add(num);
  const CL=[{x:-1.32,r:.3,n:40,th:.08},{x:0,r:.38,n:20,th:.16},{x:1.32,r:.48,n:10,th:.32}];const HT=3.2;
  const coinGeo=new THREE.CylinderGeometry(1,1,1,48);const coinMat=MAT.gold();
  const inst=new THREE.InstancedMesh(coinGeo,coinMat,70);inst.frustumCulled=false;s.add(inst);const dm=new THREE.Object3D();
  const goal=new THREE.Mesh(new THREE.BoxGeometry(4.3,.025,.025),new THREE.MeshBasicMaterial({color:new THREE.Color(C.gold).multiplyScalar(3)}));goal.position.set(0,HT+.2,0);s.add(goal);
  const dust=particles(1600,61,(i,r)=>({p:[(r()-.5)*12,r()*8,-8+r()*12],c:pal(r,[C.gold,0xffe3a3,C.violet]),s:.03+r()*.06}),{scale:900,rise:.25,wrap:8});s.add(dust);
  const sparkle=particles(400,62,(i,r)=>{const a=r()*PI*2,rad=r()*.9;return{p:[Math.cos(a)*rad*1.8,2.5+Math.sin(a)*rad*.5,(r()-.5)*.4],c:pal(r,[C.gold,0xffffff]),s:.04+r()*.07}},{scale:900});s.add(sparkle);
  const sb=sparkle.geometry.attributes.position.array.slice();
  s.add(new THREE.HemisphereLight(0x6a5030,0x050308,.5));const k1=new THREE.SpotLight(0xffe0a8,70,25,.6,.6,1.6);k1.position.set(3,8,6);k1.target.position.set(0,1.5,0);s.add(k1,k1.target);
  const k2=new THREE.PointLight(C.violet,10,14,1.6);k2.position.set(-4,3,2);s.add(k2);const k3=new THREE.PointLight(C.blue,6,14,1.6);k3.position.set(4,2,-3);s.add(k3);
  const tCon=cue('s6','concretement'),tC1=cue('s6','deux'),tC2=cue('s6','cent',1),tC3=cue('s6','cinquante',1),tAtt=cue('s6','attention'),tPas=cue('s6','pas'),tFaut=cue('s6','faut'),tTemps=cue('s6','temps'),tOffre=cue('s6','offre'),tCli=cue('s6','clients');
  const starts=[tC1-.1,tC2-.1,tC3-.1];const durs=[1.6,1.4,1.1];
  const cr=rng(71);const rot=[];for(let i=0;i<70;i++)rot.push(cr());
  return{scene:s,cam,bloom:.7,update(t){const lt=t-S.start;
    camKF(cam,t,[{t:S.start,p:[0,2.8,6.5],l:[0,2.4,0],f:42},{t:tCon+.2,p:[0,2.6,7.4],l:[0,2.2,0],f:40},{t:tC1+.5,p:[-.8,2.5,12.2],l:[0,1.75,0],f:40},{t:tAtt,p:[.8,2.4,12.4],l:[0,1.75,0],f:40},{t:S.end,p:[0,2.2,11.6],l:[0,1.75,0],f:40}]);
    const burst=seg(t,tCon+.1,tCon+.6);
    num.userData.items.forEach((m,i)=>{const appear=eOutBack(seg(t,S.start+i*.05,S.start+.5+i*.05));m.scale.setScalar(Math.max(.001,appear*(1-eInCubic(burst))));m.position.copy(m.userData.base);m.position.y+=Math.sin(lt*2+i)*.03;m.rotation.y=Math.sin(lt+i)*.2;});
    num.rotation.y=Math.sin(lt*.7)*.15;
    const sp=sparkle.geometry.attributes.position.array;const bb=seg(t,tCon+.1,tCon+1.6);for(let i=0;i<sp.length/3;i++){sp[i*3]=sb[i*3]*(1+bb*3);sp[i*3+1]=sb[i*3+1]+(sb[i*3+1]-2.5)*bb*3-bb*bb*1.5;sp[i*3+2]=sb[i*3+2]+bb*(i%7-3)*.3;}sparkle.geometry.attributes.position.needsUpdate=true;sparkle.material.uniforms.uOpacity.value=burst>0?(1-bb):0;
    let id=0;CL.forEach((c,ci)=>{for(let j=0;j<c.n;j++){const t0=starts[ci]+j*durs[ci]/c.n;const k=seg(t,t0,t0+.38);const yT=.18+c.th*(j+.5);let y=lerp(6.5,yT,eInCubic(k));if(k>=1){const b=t-(t0+.38);y=yT+Math.abs(Math.sin(b*18))*Math.exp(-b*14)*.06;}
      dm.position.set(c.x+(rot[id]-.5)*.03*(k<1?6:1),k>0?y:-50,(rot[(id+7)%70]-.5)*.03);dm.rotation.set((1-k)*rot[id]*8,rot[id]*6,(1-k)*2);dm.scale.set(c.r,c.th*.86,c.r);dm.updateMatrix();inst.setMatrixAt(id,dm.matrix);id++;}});
    inst.instanceMatrix.needsUpdate=true;
    goal.scale.x=Math.max(.001,eOutCubic(seg(t,tC1,tC1+.8)));
    dust.material.uniforms.uTime.value=lt;
    const lb=[['<b>50 €</b> × 200',tC1],['<b>100 €</b> × 100',tC2],['<b>200 €</b> × 50',tC3]];
    lb.forEach(([h,t0],i)=>label('c'+i,h,'gold',new THREE.Vector3(CL[i].x,HT+.62,0),cam,seg(t,t0,t0+.3),.82+.18*eOutBack(seg(t,t0,t0+.4))));
    label('goal','= <b>10 000 €</b> / mois',(t>tC3+1)?'gold':'',new THREE.Vector3(0,HT+1.35,0),cam,seg(t,tC1+.3,tC1+.7)*(1-seg(t,tAtt-.4,tAtt-.15)),1);
    const card=$('card');const show=t>tAtt-.15;card.classList.toggle('hide',!show);
    if(show){const k=eOutCubic(seg(t,tAtt-.15,tAtt+.35));card.style.opacity=k;card.style.transform=`translateY(${(1-k)*-40}px)`;
      let html;if(t<tFaut-.1){html=`<h4>⚠ ATTENTION</h4><p>Chiffre d'affaires <b style="color:#f5c76b">théorique</b> — avant frais, charges et impôts.${t>tPas-.1?'<br><b style="color:#fff">Pas un revenu garanti.</b>':''}</p>`;}
      else html=`<h4>CE QU'IL FAUT VRAIMENT</h4><div class="pills"><div class="pill ${t>tTemps-.1?'on':''}">TEMPS</div><div class="pill ${t>tOffre-.1?'on':''}">OFFRE</div><div class="pill ${t>tCli-.1?'on':''}">CLIENTS</div></div>`;
      if(card._h!==html){card.innerHTML=html;card._h=html;}}
    k1.intensity=70*(1-.35*seg(t,tAtt,tAtt+.4));
  },leave(){$('card').classList.add('hide');hideLabels();}};}

// ======================================================================================
// SCENE 7 — CONCLUSION
function S7(){const s=newScene(0x050310,.02),cam=newCam(38,-160);const S=SC.s7;
  const base=new THREE.IcosahedronGeometry(.95,1).toNonIndexed();const geo=base.clone();const orig=base.attributes.position.array.slice();const nT=orig.length/9;
  const r=rng(81);const TR=[];for(let i=0;i<nT;i++){const c=new THREE.Vector3((orig[i*9]+orig[i*9+3]+orig[i*9+6])/3,(orig[i*9+1]+orig[i*9+4]+orig[i*9+7])/3,(orig[i*9+2]+orig[i*9+5]+orig[i*9+8])/3);TR.push({c,dir:c.clone().normalize().add(new THREE.Vector3(r()-.5,r()-.5,r()-.5).multiplyScalar(.6)).normalize(),dist:1.6+r()*2.6,ax:new THREE.Vector3(r()-.5,r()-.5,r()-.5).normalize(),sp:(r()-.5)*9});}
  const crys=new THREE.Mesh(geo,new THREE.MeshPhysicalMaterial({color:0xcbb6ff,metalness:.85,roughness:.08,clearcoat:1,iridescence:1,iridescenceIOR:1.6,iridescenceThicknessRange:[200,800],flatShading:true,side:THREE.DoubleSide,envMapIntensity:.8}));
  crys.position.y=1.0;s.add(crys);
  const core=new THREE.Mesh(new THREE.SphereGeometry(.45,32,24),new THREE.MeshBasicMaterial({color:new THREE.Color(C.violet).multiplyScalar(3)}));core.position.y=1.0;s.add(core);
  const shock=new THREE.Mesh(new THREE.RingGeometry(.9,1,96),new THREE.MeshBasicMaterial({color:new THREE.Color(C.gold).multiplyScalar(3),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));shock.position.y=1;s.add(shock);
  // rays
  const rays=new THREE.Group();rays.position.set(0,1,-3);s.add(rays);const rayT=canvasTex(64,512,(c,w,h)=>{const g=c.createLinearGradient(0,h,0,0);g.addColorStop(0,'rgba(255,255,255,.9)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.beginPath();c.moveTo(w/2-6,h);c.lineTo(w/2+6,h);c.lineTo(w,0);c.lineTo(0,0);c.fill();});
  for(let i=0;i<14;i++){const m=new THREE.Mesh(new THREE.PlaneGeometry(1.1,9),new THREE.MeshBasicMaterial({map:rayT,color:i%3===0?C.gold:i%2?C.violet:C.blue,transparent:true,opacity:.22,blending:THREE.AdditiveBlending,depthWrite:false}));m.geometry.translate(0,4.5,0);m.rotation.z=i/14*PI*2+r()*.2;rays.add(m);}
  const glow=new THREE.Mesh(new THREE.PlaneGeometry(9,9),new THREE.MeshBasicMaterial({map:canvasTex(256,256,(c,w,h)=>{const g=c.createRadialGradient(128,128,0,128,128,128);g.addColorStop(0,'rgba(200,160,255,.9)');g.addColorStop(.35,'rgba(124,58,237,.35)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(0,0,w,h);}),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));glow.position.set(0,1,-3.2);s.add(glow);
  const dust=particles(2400,83,(i,r)=>({p:[(r()-.5)*12,r()*10-3,-6+r()*10],c:pal(r,[C.gold,C.violet,C.blue,0xffffff]),s:.03+r()*.07}),{scale:900,rise:.35,wrap:11});s.add(dust);
  const fl=new THREE.Mesh(new THREE.CircleGeometry(20,64),new THREE.MeshPhysicalMaterial({color:0x07050d,metalness:.9,roughness:.3,clearcoat:1}));fl.rotation.x=-PI/2;fl.position.y=-1.4;s.add(fl);
  s.add(new THREE.HemisphereLight(0x6a5aa0,0x05030a,.6));const p1=new THREE.PointLight(C.gold,22,12,1.6);p1.position.set(2.5,2.5,2.5);s.add(p1);const p2=new THREE.PointLight(C.blue,20,12,1.6);p2.position.set(-2.5,0,2);s.add(p2);const p3=new THREE.PointLight(C.violet,25,12,1.6);p3.position.set(0,3,-2);s.add(p3);
  const tMais=cue('s7','mais'),tVal=cue('s7','valeur'),tVen=cue('s7','vendre'),tAb=cue('s7','abonne'),tSuite=cue('s7','suite');
  const q=new THREE.Quaternion(),v=new THREE.Vector3();
  return{scene:s,cam,bloom:.65,update(t){const lt=t-S.start;
    camKF(cam,t,[{t:S.start,p:[0,1.3,9.6],l:[0,1.2,0],f:40},{t:tMais,p:[.8,1.4,8.6],l:[0,1.15,0],f:40},{t:tVen+.8,p:[-.6,1.2,8.2],l:[0,1.1,0],f:40},{t:tAb,p:[0,1.5,9.4],l:[0,1.4,0],f:40},{t:S.end,p:[0,1.7,10],l:[0,1.5,0],f:40}]);
    const ex=eOutExpo(seg(t,tMais-.05,tMais+.7))*(1-eInOut(seg(t,tVen-.2,tVen+.9)));
    const a=geo.attributes.position.array;
    for(let i=0;i<nT;i++){const T=TR[i];q.setFromAxisAngle(T.ax,T.sp*ex+Math.sin(lt+i)*.3*ex);const off=T.dir.clone().multiplyScalar(T.dist*ex+Math.sin(lt*1.3+i)*.05*ex);
      for(let j=0;j<3;j++){v.set(orig[i*9+j*3],orig[i*9+j*3+1],orig[i*9+j*3+2]).sub(T.c).applyQuaternion(q).add(T.c).add(off);a[i*9+j*3]=v.x;a[i*9+j*3+1]=v.y;a[i*9+j*3+2]=v.z;}}
    geo.attributes.position.needsUpdate=true;geo.computeVertexNormals();
    const sc=1+.18*eOutBack(seg(t,tVen+.7,tVen+1.3));crys.scale.setScalar(sc);crys.rotation.set(lt*.25,lt*.4,0);crys.position.y=1+Math.sin(lt*.8)*.06+.45*seg(t,tAb-.4,tAb+.4)*0;
    core.scale.setScalar(.6+ex*1.3+.2*Math.sin(lt*4));core.material.color.set(C.violet).multiplyScalar(1.2+2.5*ex);
    const sh=seg(t,tVen+.65,tVen+1.6);shock.scale.setScalar(1+sh*6);shock.material.opacity=sh>0?1-sh:0;shock.lookAt(cam.position);
    rays.rotation.z=lt*.08;rays.children.forEach((m,i)=>m.material.opacity=(.08+.14*seg(t,tVen+.6,tVen+1.4))*(.7+.3*Math.sin(lt*1.5+i)));
    glow.material.opacity=.35+.3*seg(t,tVen+.6,tVen+1.2);
    dust.material.uniforms.uTime.value=lt;
    // title & CTA
    const ti=$('title');const tiOn=t>tVen+.7&&t<tAb-.15;ti.classList.toggle('hide',!tiOn);if(tiOn){const k=eOutCubic(seg(t,tVen+.7,tVen+1.2));ti.style.opacity=k*(1-seg(t,tAb-.5,tAb-.15));ti.style.transform=`scale(${.92+.08*k})`;}
    const cta=$('cta');const on=t>tSuite-.2;cta.classList.toggle('hide',!on);
    if(on){const k=eOutBack(seg(t,tSuite-.2,tSuite+.3));cta.style.opacity=seg(t,tSuite-.2,tSuite+.1);cta.style.transform=`scale(${.8+.2*k})`;const b=cta.querySelector('.btn');b.style.transform=`scale(${1+.04*Math.sin((t-tSuite)*6)})`;}
    $('cap').style.opacity=on?0:1;
  },leave(){$('title').classList.add('hide');$('cta').classList.add('hide');$('cap').style.opacity=1;}};}

// ======================================================================================
const SCENES=[S1(),S2(),S3(),S4(),S5(),S6(),S7()];
const IDS=['s1','s2','s3','s4','s5','s6','s7'];
const TTYPE=[0,2,1,2,0,1];const TCOL=[0x7c3aed,0x22d3ee,0xa855f7,0x22d3ee,0xf5c76b,0xa855f7];
let active=-1;
const capEl=$('cap');let capKey='';
function captions(t){const c=CAPS.find(c=>t>=c.s-.06&&t<c.e);if(!c){capEl.innerHTML='';capKey='';return;}
  const key=c.s+'';if(key!==capKey){capKey=key;capEl.className='abs'+(c.big?' big':'');capEl.innerHTML=c.words.map(w=>`<span class="w${w.k?' k':''}">${w.w}</span>`).join(' ');}
  const els=capEl.children;const k=eOutBack(seg(t,c.s-.06,c.s+.16));capEl.style.transform=`translateY(${(1-k)*26}px) scale(${.9+.1*k})`;capEl.style.opacity=seg(t,c.s-.06,c.s+.06)*(1-seg(t,c.e-.08,c.e));
  c.words.forEach((w,i)=>{const e=els[i];const on=t>=w.s-.04;const cur=on&&(t<w.e+.05||i===c.words.length-1&&t<c.e);e.classList.toggle('on',on);e.classList.toggle('cur',cur);
    const p=eOutBack(seg(t,w.s-.04,w.s+.12));e.style.transform=on?`scale(${(cur?1.06:1)*(.92+.08*p)})`:'scale(.94)';
    e.style.filter=cur&&!c.big?`drop-shadow(0 0 18px ${w.k?'rgba(245,199,107,.7)':'rgba(168,85,247,.75)'})`:'';});}
window.renderAt=(t)=>{
  let idx=0;IDS.forEach((id,i)=>{if(t>=SC[id].start)idx=i;});
  if(idx!==active){if(active>=0&&SCENES[active].leave)SCENES[active].leave();active=idx;}
  const S=SCENES[idx];S.update(t);rpass.scene=S.scene;rpass.camera=S.cam;bloom.strength=S.bloom;
  // transitions
  let tr=0,ty=0,tc=TCOL[0];for(let i=1;i<IDS.length;i++){const b=SC[IDS[i]].start;const d=t-b;let v=0;if(d<0&&d>-.28)v=eInCubic(1+d/.28);else if(d>=0&&d<.42)v=1-eOutCubic(d/.42);if(v>tr){tr=v;ty=TTYPE[i-1];tc=TCOL[i-1];}}
  grade.uniforms.uTrans.value=tr;grade.uniforms.uType.value=ty;grade.uniforms.uFlash.value=Math.pow(tr,3)*.55;grade.uniforms.uFlashCol.value.set(tc);
  // opening fade in & ending fade
  const fadeIn=seg(t,0,.35),fadeOut=1-seg(t,TL.duration-.6,TL.duration);
  grade.uniforms.uTime.value=t;renderer.toneMappingExposure=fadeIn*fadeOut;
  $('progress').style.width=(t/TL.duration*100)+'%';
  captions(t);$('ui').style.opacity=fadeOut;
  composer.render();
};
window.DURATION=TL.duration;
window.ready=true;
