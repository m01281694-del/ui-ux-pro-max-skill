// Renders a short with Remotion (server-side), then normalizes loudness to -14 LUFS with ffmpeg.
import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

const id = process.argv[2] ?? "v001";
const stillsOnly = process.argv.includes("--stills");
const out = path.resolve("out", id);
fs.mkdirSync(out, { recursive: true });
const browserExecutable = process.env.REMOTION_CHROME ?? "/opt/pw-browsers/chromium";
const chromiumOptions = { gl: "swangle" as const };

const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id: "Short", browserExecutable, chromiumOptions });
console.log("composition", composition.durationInFrames, "frames");

for (const [name, sec] of [["hook", 0.5], ["tension", 4], ["p1", 9.5], ["p2", 14], ["p3", 18], ["payoff", 23.5], ["cta", 28]] as const) {
  await renderStill({ serveUrl, composition, frame: Math.round(sec * 30), output: path.join(out, `still-${name}.png`), browserExecutable, chromiumOptions });
}
if (stillsOnly) process.exit(0);

const raw = path.join(out, "raw.mp4");
let last = 0;
await renderMedia({
  serveUrl, composition, codec: "h264", outputLocation: raw, browserExecutable, chromiumOptions, crf: 18, concurrency: 3,
  onProgress: ({ progress }) => { const p = Math.floor(progress * 10); if (p !== last) { last = p; console.log(`render ${p * 10}%`); } },
});
// loudness -14 LUFS integrated, TP -1 dBTP
const final = path.join(out, `${id}.mp4`);
execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", raw, "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1:LRA=11", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", final]);
console.log("done", final);
