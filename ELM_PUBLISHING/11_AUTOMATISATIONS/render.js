// ELM PUBLISHING — rendu HTML -> PDF / PNG avec Chromium (Playwright, gratuit).
// Usage :
//   node render.js pdf  in.html out.pdf widthIn heightIn marginsJSON footer(0|1) [startPage]
//   node render.js png  in.html out.png widthPx heightPx
//   node render.js pdfpage in.html out.pdf widthIn heightIn   (page unique sans marges : couvertures)
const { chromium } = require("playwright");
const path = require("path");
(async () => {
  const [mode, inp, out, a, b, marg, footer, start] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage(mode === "png" ? { viewport: { width: +a, height: +b } } : {});
  await page.goto("file://" + path.resolve(inp), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  if (mode === "png") {
    await page.screenshot({ path: out, clip: { x: 0, y: 0, width: +a, height: +b } });
  } else if (mode === "pdfpage") {
    await page.pdf({ path: out, width: a + "in", height: b + "in", printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } });
  } else {
    const m = JSON.parse(marg);
    await page.pdf({
      path: out, width: a + "in", height: b + "in", printBackground: true,
      margin: { top: m.top + "in", bottom: m.bottom + "in", left: m.left + "in", right: m.right + "in" },
      displayHeaderFooter: footer === "1",
      headerTemplate: "<span></span>",
      footerTemplate: footer === "1"
        ? `<div style="width:100%;font-family:Literata,serif;font-size:8.5pt;color:#555;text-align:center;margin-bottom:0.22in"><span class="pageNumber"></span></div>`
        : "<span></span>",
    });
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
