// Template dialogue for the 1 000 residents (no AI). LLM is only used when the user talks to someone.
import type { Resident } from "./world";

const T: Record<string, string[]> = {
  work: ["Le hook doit tomber avant 1,5 s.", "Je relance le rendu, 2 min.", "Brand Check a validé !", "Qui a la dernière version du script ?", "On teste un autre format ?", "Les stats H+1 arrivent."],
  park: ["Quelle belle journée !", "Tu as vu la vidéo #{n} ?", "Je fais le tour du parc.", "On se fait un café après ?", "Ça fait du bien de souffler."],
  food: ["C'est quoi le plat du jour ?", "Je meurs de faim.", "Les croissants sont incroyables ici.", "On partage l'addition ?"],
  fun: ["Revanche ce soir ?", "Ce film était dingue.", "Allez, encore une partie !", "Séance de sport validée 💪"],
  shop: ["Les prix ont bougé cette semaine…", "Il me faut du lait.", "Cette veste est parfaite."],
  road: ["Je suis en retard !", "Salut ! On se voit plus tard.", "Je file au bureau."],
  home: ["Enfin à la maison.", "Petite série ce soir."],
};

export function bubbleFor(r: Resident, activity: string, task: string | undefined, seed: number): string {
  if (task) return `${task.slice(0, 60)}${task.length > 60 ? "…" : ""}`;
  const a = activity.toLowerCase();
  const key = a.startsWith("travaille") || a === "en cours" ? "work" : a.includes("parc") ? "park" : /déj|dîne|croissant|café/.test(a) ? "food" : /jeux|film|sport/.test(a) ? "fun" : /courses|vêtements/.test(a) ? "shop" : a.startsWith("en route") ? "road" : "home";
  const list = T[key];
  return list[(seed + r.id) % list.length].replace("{n}", String(100 + (r.id % 40)));
}
