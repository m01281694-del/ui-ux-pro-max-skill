// usage: node render.js <spec.json> <timeline.json> <out.mp4> <punch.json> [stills t1 t2 ...]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const [specPath, tlPath, out, punchPath, mode, ...times] = process.argv.slice(2);
const SPEC = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const TL = JSON.parse(fs.readFileSync(tlPath, 'utf8'));
const FPS = 30;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await p.addInitScript(([s, t]) => { window.SPEC = s; window.TL = t; }, [SPEC, TL]);
  let err = null;
  p.on('pageerror', e => { err = e; console.log('ERR', e.message); });
  await p.goto('file://' + path.join(__dirname, 'template.html'));
  await p.waitForTimeout(700);
  if (err) process.exit(2);
  fs.writeFileSync(punchPath, JSON.stringify(await p.evaluate(() => window.PUNCH_TIMES)));
  if (mode === 'stills') {
    for (const t of times) { await p.evaluate(t => render(t), +t); await p.screenshot({ path: `${out}-${t}.jpg`, type: 'jpeg', quality: 80 }); }
    await b.close(); return;
  }
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const N = Math.ceil(TL.duration * FPS);
  for (let i = 0; i < N; i++) {
    await p.evaluate(t => render(t), i / FPS);
    const buf = await p.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 300 === 0) console.log('frame', i, '/', N);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await b.close();
})();
