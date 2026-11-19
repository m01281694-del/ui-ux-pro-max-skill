// Seeds brain/ with REAL, sourced starter notes (system structure, platform specs, scene templates).
// No business "knowledge" is invented here: lessons/trends/hooks will be written by the agents from data.
import fs from "node:fs";
import path from "node:path";
import { DEPARTMENTS } from "../src/lib/sim/data";

const ROOT = path.join(process.cwd(), "brain");
const today = new Date().toISOString().slice(0, 10);

function note(rel: string, fm: Record<string, unknown>, body: string) {
  const file = path.join(ROOT, rel + ".md");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const yaml = Object.entries({ date: today, auteur: "Mairie (seed)", ...fm })
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? `[${v.map((x) => JSON.stringify(x)).join(", ")}]` : JSON.stringify(v)}`).join("\n");
  fs.writeFileSync(file, `---\n${yaml}\n---\n\n${body.trim()}\n`);
}

// ---- Hubs (Maps of Content) — one per galaxy
const HUBS: [string, string, string][] = [
  ["Tendances", "hub", "Toutes les tendances détectées par Trend Scout. Chaque tendance a une preuve (lien) et un score."],
  ["Hooks", "hub", "Bibliothèque des hooks testés, avec leur rétention mesurée. Alimente le [[Playbook]]."],
  ["Concurrents", "hub", "Comptes suivis par Competitor Watch et analyses de leurs posts qui sur-performent."],
  ["Audience", "hub", "Personas, heures actives, questions récurrentes (Audience Listener, Comment Miner)."],
  ["Vidéos", "hub", "Chaque vidéo produite, ses stats H+1 / H+24 / H+72 / J+7 et les leçons tirées."],
  ["Leçons", "hub", "Leçons validées par les données (Loop Feeder). Elles sont réinjectées dans les prompts des 36 métiers."],
  ["Ventes", "hub", "Offres, leads (anonymisés), appels, revenus."],
  ["Formats", "hub", "Formats et templates de scènes réutilisables."],
  ["Système", "hub", "Organisation de la ville : départements, métiers, boucle, règles."],
  ["Incidents", "hub", "Échecs de tâches, causes et corrections (auto-réparation)."],
  ["Plateformes", "hub", "Contraintes techniques et règles des plateformes."],
];
for (const [name, type, body] of HUBS) note(name, { type, confiance: 1, source: "structure" }, `# ${name}\n\n${body}\n\nParent : [[Agent City]]`);
note("Agent City", { type: "hub", confiance: 1, source: "PROMPT-ville-ia.md" }, `# Agent City\n\nLe cerveau de la ville. Galaxies : ${HUBS.map(([n]) => `[[${n}]]`).join(" · ")}.\n\nBoucle : [[Research]] → [[Content]] → [[Publish]] → [[Community]] → [[Sales]] → [[The loop]] → [[Research]]. Orchestrateur : [[Mairie Claude Code]].`);

note("Playbook", { type: "playbook", confiance: 0.2, source: "seed", tags: ["playbook"] }, `# Playbook\n\nRègles lues par Research et Content avant chaque tâche. **Vide au démarrage** : chaque règle sera ajoutée par [[Loop Feeder]] avec un niveau de confiance et les vidéos qui la prouvent.\n\n## Règles de départ (contraintes du cahier des charges, pas encore validées par nos données)\n- Hook visuel + texte + voix dans les 1,5 premières secondes. ([[Format vidéo courte 9-16]])\n- Changement visuel toutes les 1–2 s.\n- Structure : hook → tension → 3 temps forts → payoff → boucle/CTA.\n- Brand Check ≥ 80/100 avant toute publication.\n\nVoir [[Leçons]] · [[Hooks]] · [[Formats]]`);
note("Mairie Claude Code", { type: "système", confiance: 1, source: "spec" }, `# Mairie « Claude Code »\n\nOrchestrateur : planifie la journée (1–3 vidéos/jour, 3 carrousels/semaine, 1 newsletter/semaine), gère la machine à états des contenus, l'auto-réparation et le kill switch.\n\n[[Système]] · [[Playbook]]`);

for (const d of DEPARTMENTS) {
  const i = DEPARTMENTS.indexOf(d);
  const next = DEPARTMENTS[(i + 1) % DEPARTMENTS.length];
  note(`Système/${d.name}`, { type: "département", confiance: 1, source: "spec", couleur: d.color }, `# ${d.name}\n\nMétiers : ${d.jobs.map((j) => `[[${j}]]`).join(" · ")}\n\nÉtape suivante de la boucle : [[${next.name}]]\n\n[[Système]]`);
  for (const j of d.jobs) note(`Système/Métiers/${j}`, { type: "métier", département: d.name, confiance: 1, source: "spec" }, `# ${j}\n\nDépartement : [[${d.name}]]. Agent avec prompt système dédié, entrée/sortie validées par schéma (Zod). Lit le [[Playbook]] et les notes pertinentes du cerveau (RAG ciblé, 5–10 notes) avant chaque tâche.`);
}

note("Plateformes/Format vidéo courte 9-16", { type: "format", confiance: 0.95, source: "https://support.google.com/youtube/answer/15424877" }, `# Format vidéo courte 9:16\n\n- 1080×1920, 30 fps (60 si possible), 20–60 s.\n- YouTube Shorts : vidéos verticales ou carrées jusqu'à 3 min (source ci-dessus).\n- Sous-titres incrustés, placés hors des zones d'interface.\n\n[[Plateformes]] · [[Formats]]`);
note("Plateformes/Loudness -14 LUFS", { type: "format", confiance: 0.5, source: "cahier des charges — à vérifier par Research" }, `# Loudness −14 LUFS\n\nNormaliser le mix final à −14 LUFS intégré (cible usuelle de normalisation des plateformes de streaming), true peak ≤ −1 dBTP. Vérifié par [[Brand Check]] avec ffmpeg \`loudnorm\`.\n\n[[Plateformes]]`);
note("Plateformes/Label contenu IA", { type: "format", confiance: 0.9, source: "https://support.tiktok.com/en/using-tiktok/creating-videos/ai-generated-content" }, `# Label « contenu IA »\n\nTikTok demande d'étiqueter le contenu réaliste généré par IA. (Instagram et YouTube : règles équivalentes à vérifier par Research.) Le label est ajouté par les Posters quand la plateforme l'exige.\n\n[[Plateformes]] · [[Publish]]`);
note("Plateformes/Carrousel Instagram", { type: "format", confiance: 0.5, source: "cahier des charges — à vérifier par Research" }, `# Carrousel Instagram\n\n1080×1350 (4:5), 8–10 slides, cohérence de charte. Produit par [[Carousel Builder]].\n\n[[Plateformes]] · [[Formats]]`);
note("Plateformes/Pas de bots", { type: "format", confiance: 1, source: "spec" }, `# Règles de sécurité des comptes\n\nPas de bots de navigateur connectés aux comptes, pas de faux comptes, pas d'achat d'abonnés, pas de spam. Uniquement API officielles / Metricool, en respectant les quotas.\n\n[[Plateformes]]`);

const SCENES = [
  ["Titre 3D qui explose", "Typographie extrudée qui se fragmente en particules au beat — idéal pour le hook."],
  ["Graphique 3D qui monte", "Barres 3D animées avec caméra en travelling — pour prouver un chiffre sourcé."],
  ["Téléphone 3D", "Smartphone 3D qui affiche un écran (capture ou UI) — démonstration produit."],
  ["Globe", "Globe 3D qui tourne et zoome sur un point — tendance mondiale/locale."],
  ["Objets qui tombent", "Objets avec physique simple qui tombent et s'empilent — accumulation, liste."],
  ["Transition portail", "Portail circulaire qui révèle la scène suivante."],
  ["Zoom à travers un texte", "La caméra traverse une lettre pour entrer dans la scène suivante."],
  ["Avant après", "Split 3D avant/après avec glissière."],
  ["Compte à rebours", "Chiffres 3D 3-2-1 — tension avant le payoff."],
  ["Liste animée", "Cartes 3D qui s'empilent, une par point."],
  ["Citation", "Citation en typographie 3D avec profondeur de champ."],
  ["Révélation finale", "Révélation lumineuse + boucle vers le début (rewatch)."],
];
for (const [n, d] of SCENES) note(`Formats/Scène — ${n}`, { type: "format", confiance: 0.6, source: "bibliothèque Remotion interne (Phase 2)" }, `# Scène 3D : ${n}\n\n${d}\n\nRendu : Remotion + @remotion/three. Performance mesurée par vidéo dans [[Vidéos]].\n\n[[Formats]]`);

console.log("brain seeded:", ROOT);
