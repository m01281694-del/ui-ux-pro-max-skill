const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await b.newPage({viewport:{width:1080,height:1920}});const errs=[];p.on('console',m=>{const s=m.text();if(!s.includes('GL Driver'))console.log('LOG',s)});p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('http://localhost:8765/index.html');await p.waitForFunction('window.ready',null,{timeout:120000});
const ts=process.argv.slice(2).map(Number);
for(const t of ts){const t0=Date.now();await p.evaluate(`renderAt(${t})`);await p.locator('#stage').screenshot({path:`stills/t${t.toFixed(2)}.png`});console.log(t,Date.now()-t0,'ms');}
await b.close();})();
