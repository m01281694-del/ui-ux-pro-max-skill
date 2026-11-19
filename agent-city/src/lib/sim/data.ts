// Static reference data for Agent City. Texts of departments/jobs are EXACT (spec §1.3).

export type DeptId = "research" | "content" | "publish" | "community" | "sales" | "loop";

export interface Department {
  id: DeptId;
  name: string;
  color: string; // hex
  jobs: string[];
  /** loop order: Research → Content → Publish → Community → Sales → The loop */
  order: number;
}

export const DEPARTMENTS: Department[] = [
  { id: "research", name: "Research", color: "#38bdf8", order: 0, jobs: ["Trend Scout", "Audience Listener", "Comment Miner", "Competitor Watch", "Post Writer", "Email Writer"] },
  { id: "content", name: "Content", color: "#a78bfa", order: 1, jobs: ["Visual Designer", "Carousel Builder", "Voiceover", "Video Editor", "Brand Check", "Approval Desk"] },
  { id: "publish", name: "Publish", color: "#f97316", order: 2, jobs: ["Scheduler", "TikTok Poster", "Reels Poster", "Shorts Poster", "X Poster", "Newsletter"] },
  { id: "community", name: "Community", color: "#34d399", order: 3, jobs: ["Comment Replier", "DM Agent", "FAQ Builder", "Review Asker", "Lead Catcher", "Escalation"] },
  { id: "sales", name: "Sales", color: "#facc15", order: 4, jobs: ["Lead Scorer", "Call Booker", "Reminder", "Follow-up", "Payment Link", "CRM Sync"] },
  { id: "loop", name: "The loop", color: "#f472b6", order: 5, jobs: ["Post Analyst", "Revenue Tracker", "Call Tracker", "Email Analyst", "Weekly Report", "Loop Feeder"] },
];

export const DEPT_BY_ID = Object.fromEntries(DEPARTMENTS.map((d) => [d.id, d])) as Record<DeptId, Department>;

export const JOB_TO_DEPT: Record<string, DeptId> = Object.fromEntries(
  DEPARTMENTS.flatMap((d) => d.jobs.map((j) => [j, d.id])),
);

/** Relative team size per job (load). Scaled so the total is ~300. */
export const JOB_LOAD: Record<string, number> = {
  "Trend Scout": 8, "Audience Listener": 6, "Comment Miner": 8, "Competitor Watch": 7, "Post Writer": 12, "Email Writer": 6,
  "Visual Designer": 10, "Carousel Builder": 8, "Voiceover": 9, "Video Editor": 12, "Brand Check": 9, "Approval Desk": 5,
  "Scheduler": 6, "TikTok Poster": 8, "Reels Poster": 8, "Shorts Poster": 8, "X Poster": 6, "Newsletter": 5,
  "Comment Replier": 12, "DM Agent": 10, "FAQ Builder": 6, "Review Asker": 5, "Lead Catcher": 9, "Escalation": 6,
  "Lead Scorer": 8, "Call Booker": 7, "Reminder": 6, "Follow-up": 8, "Payment Link": 5, "CRM Sync": 6,
  "Post Analyst": 12, "Revenue Tracker": 6, "Call Tracker": 5, "Email Analyst": 5, "Weekly Report": 4, "Loop Feeder": 9,
};

export type PlaceKind =
  | "home" | "office" | "townhall" | "park" | "cafe" | "bakery" | "grocery" | "clothes" | "cinema" | "gym"
  | "arcade" | "restaurant" | "school" | "clinic" | "workshop" | "depot";

export interface ShopDef {
  kind: PlaceKind;
  name: string;
  /** base price of one purchase (€) */
  price: number;
  color: string;
  staff: number;
  cityJob: string;
}

export const SHOPS: ShopDef[] = [
  { kind: "grocery", name: "Supérette du Port", price: 34, color: "#22c55e", staff: 14, cityJob: "Caissier·e" },
  { kind: "bakery", name: "Boulangerie Levain", price: 6, color: "#eab308", staff: 10, cityJob: "Boulanger·e" },
  { kind: "clothes", name: "Boutique Fil Rouge", price: 58, color: "#ec4899", staff: 8, cityJob: "Vendeur·se" },
  { kind: "cafe", name: "Café des Agents", price: 9, color: "#b45309", staff: 14, cityJob: "Barista" },
  { kind: "cinema", name: "Cinéma Lumière", price: 11, color: "#ef4444", staff: 10, cityJob: "Projectionniste" },
  { kind: "gym", name: "Salle Pulse", price: 12, color: "#06b6d4", staff: 10, cityJob: "Coach sportif" },
  { kind: "arcade", name: "Salle de jeux Pixel", price: 8, color: "#8b5cf6", staff: 8, cityJob: "Animateur·rice" },
  { kind: "restaurant", name: "Bistrot du Hook", price: 19, color: "#f97316", staff: 16, cityJob: "Serveur·se" },
];

export const CIVIC: { kind: PlaceKind; name: string; color: string; staff: number; cityJob: string }[] = [
  { kind: "townhall", name: "Mairie « Claude Code »", color: "#f59e0b", staff: 20, cityJob: "Agent municipal" },
  { kind: "school", name: "École des Prompts", color: "#60a5fa", staff: 30, cityJob: "Enseignant·e" },
  { kind: "clinic", name: "Clinique du Parc", color: "#f43f5e", staff: 34, cityJob: "Infirmier·e" },
  { kind: "workshop", name: "Atelier des Artisans", color: "#a3a3a3", staff: 80, cityJob: "Artisan·e" },
  { kind: "depot", name: "Dépôt & Livraisons", color: "#78716c", staff: 70, cityJob: "Livreur·se" },
];

export const FIRST_NAMES = [
  "Lina", "Hugo", "Sami", "Inès", "Léo", "Chloé", "Yanis", "Manon", "Nathan", "Camille", "Adam", "Jade", "Lucas", "Emma", "Rayan",
  "Louise", "Noah", "Alice", "Mohamed", "Léa", "Tom", "Sarah", "Enzo", "Zoé", "Théo", "Lou", "Nolan", "Anaïs", "Malo", "Nora",
  "Gabriel", "Lucie", "Arthur", "Clara", "Ilyes", "Maëlle", "Jules", "Yasmine", "Paul", "Eva", "Bilal", "Rose", "Mathis", "Romane",
  "Karim", "Agathe", "Axel", "Salomé", "Victor", "Amira", "Samuel", "Margaux", "Ethan", "Lila", "Aaron", "Océane", "Kenza", "Basile",
  "Jeanne", "Oscar", "Mia", "Sacha", "Aya", "Martin", "Lisa", "Anton", "Héloïse", "Marius", "Nina", "Elias", "Juliette", "Simon",
];

export const LAST_NAMES = [
  "Martin", "Bernard", "Dubois", "Thomas", "Robert", "Richard", "Petit", "Durand", "Leroy", "Moreau", "Simon", "Laurent", "Lefebvre",
  "Michel", "Garcia", "David", "Bertrand", "Roux", "Vincent", "Fournier", "Morel", "Girard", "André", "Mercier", "Dupont", "Lambert",
  "Bonnet", "François", "Martinez", "Legrand", "Garnier", "Faure", "Rousseau", "Blanc", "Guerin", "Muller", "Henry", "Roussel",
  "Nicolas", "Perrin", "Morin", "Mathieu", "Clement", "Gauthier", "Dumont", "Lopez", "Fontaine", "Chevalier", "Robin", "Masson",
  "Benali", "Haddad", "Nguyen", "Diallo", "Traoré", "Kaya", "Rossi", "Silva", "Cohen", "Mendy",
];

export const TRAITS = ["ouverture", "conscience", "extraversion", "agréabilité", "névrosisme"] as const;
export type Trait = (typeof TRAITS)[number];

export const SKILLS = ["recherche", "écriture", "design", "vidéo", "audio", "data", "vente", "relation"] as const;
