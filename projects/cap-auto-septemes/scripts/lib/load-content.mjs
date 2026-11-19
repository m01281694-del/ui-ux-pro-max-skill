// Charge content/site.js et content/vehicles.js côté Node (sans navigateur).
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function loadContent() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  for (const f of ["content/site.js", "content/vehicles.js"]) {
    const code = readFileSync(path.join(ROOT, f), "utf8");
    try {
      vm.runInContext(code, sandbox, { filename: f });
    } catch (err) {
      throw new Error(`Erreur de syntaxe dans ${f} : ${err.message}\n→ Vérifiez les guillemets, virgules et accolades autour de la ligne indiquée.`);
    }
  }
  return {
    content: sandbox.window.CAP_CONTENT || {},
    vehicles: sandbox.window.CAP_VEHICLES || [],
  };
}

export const checks = createRequire(import.meta.url)("../../admin/checks.js");
