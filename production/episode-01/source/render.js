const {chromium}=require('playwright');const {spawn}=require('child_process');
const [a,b,out]=[+process.argv[2],+process.argv[3],process.argv[4]];const FPS=30;
(async()=>{const br=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await br.newPage({viewport:{width:1080,height:1920}});p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('http://localhost:8765/index.html');await p.waitForFunction('window.ready',null,{timeout:120000});
// warm-up: render preceding frames so scene state/caches are primed
if(a>0)await p.evaluate(`renderAt(${(a-1)/FPS})`);
const ff=spawn('ffmpeg',['-v','error','-y','-f','image2pipe','-framerate',String(FPS),'-i','-','-c:v','libx264','-preset','medium','-crf','15','-pix_fmt','yuv420p',out],{stdio:['pipe','inherit','inherit']});
const t0=Date.now();
for(let f=a;f<b;f++){await p.evaluate(`renderAt(${f/FPS})`);const buf=await p.locator('#stage').screenshot({type:'png'});
  if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r));
  if((f-a)%100===0)console.log(out,f,((Date.now()-t0)/(f-a+1)).toFixed(0)+'ms/f');}
ff.stdin.end();await new Promise(r=>ff.on('close',r));await br.close();console.log('DONE',out);})();
