// Kill switch & run mode. File-backed when the FS is writable (dev / VPS), memory otherwise (Vercel).
import fs from "node:fs";
import path from "node:path";

export interface Control { publishingPaused: boolean; approvalMode: "manuel" | "semi-auto" | "full-auto"; updatedAt: number }
const FILE = path.join(process.cwd(), "data", "control.json");
const g = globalThis as unknown as { __control?: Control };
const DEFAULT: Control = { publishingPaused: false, approvalMode: "semi-auto", updatedAt: 0 };

export function getControl(): Control {
  try { return { ...DEFAULT, ...JSON.parse(fs.readFileSync(FILE, "utf8")) }; } catch { return g.__control ?? DEFAULT; }
}
export function setControl(p: Partial<Control>): Control {
  const next = { ...getControl(), ...p, updatedAt: Date.now() };
  g.__control = next;
  try { fs.writeFileSync(FILE, JSON.stringify(next, null, 2)); } catch {}
  return next;
}
