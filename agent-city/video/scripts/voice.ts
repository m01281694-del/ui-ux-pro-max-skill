// Voiceover: ElevenLabs TTS with timestamps (auth injected by the environment proxy — no key in code).
import fs from "node:fs";
import path from "node:path";

const dir = process.argv[2];
const s = JSON.parse(fs.readFileSync(path.join(dir, "script.json"), "utf8"));
const text: string = s.scenes.map((x: { voice: string }) => x.voice).join(" ");
const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${s.voice.voiceId}/with-timestamps?output_format=mp3_44100_128`, {
  method: "POST",
  headers: { "content-type": "application/json", "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "proxy" },
  body: JSON.stringify({ text, model_id: s.voice.model, language_code: "fr", voice_settings: { stability: 0.42, similarity_boost: 0.8, style: 0.4, use_speaker_boost: true } }),
});
if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
const d = await res.json();
fs.writeFileSync(path.join(dir, "voice.mp3"), Buffer.from(d.audio_base64, "base64"));
const a = d.alignment as { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] };
// words
const words: { text: string; start: number; end: number; scene: number }[] = [];
let cur = "", start = 0, charIdx = 0;
const sceneStarts: number[] = []; // char index where each scene starts
{ let acc = 0; for (const sc of s.scenes) { sceneStarts.push(acc); acc += sc.voice.length + 1; } }
const sceneOf = (ci: number) => { let k = 0; for (let i = 0; i < sceneStarts.length; i++) if (ci >= sceneStarts[i]) k = i; return k; };
for (let i = 0; i < a.characters.length; i++) {
  const ch = a.characters[i];
  if (/\s/.test(ch)) { if (cur) words.push({ text: cur, start, end: a.character_end_times_seconds[i - 1], scene: sceneOf(charIdx) }); cur = ""; continue; }
  if (!cur) { start = a.character_start_times_seconds[i]; charIdx = i; }
  cur += ch;
}
if (cur) words.push({ text: cur, start, end: a.character_end_times_seconds.at(-1)!, scene: sceneOf(charIdx) });
const scenes = s.scenes.map((sc: { id: string }, i: number) => {
  const ws = words.filter((w) => w.scene === i);
  return { id: sc.id, start: ws[0].start, end: ws.at(-1)!.end };
});
fs.writeFileSync(path.join(dir, "timing.json"), JSON.stringify({ duration: a.character_end_times_seconds.at(-1), words, scenes }, null, 1));
console.log("voice ok", text.length, "chars,", a.character_end_times_seconds.at(-1), "s,", words.length, "words");
