// Two-pass loudnorm to -14 LUFS / -1 dBTP. Usage: npx tsx scripts/loudnorm.ts in.mp4 out.mp4
import { spawnSync, execFileSync } from "node:child_process";
export function loudnorm(input: string, output: string) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-i", input, "-af", "loudnorm=I=-14:TP=-1:LRA=11:print_format=json", "-f", "null", "-"], { encoding: "utf8" });
  const t = r.stderr;
  const m = JSON.parse(t.slice(t.lastIndexOf("{"), t.lastIndexOf("}") + 1));
  const ln = `loudnorm=I=-14:TP=-1:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", input, "-c:v", "copy", "-af", ln, "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", output]);
}
if (process.argv[1]?.endsWith("loudnorm.ts")) loudnorm(process.argv[2], process.argv[3]);
