/* =====================================================================
   Réception des demandes (Vercel Function) → e-mail via Resend.
   Variables d'environnement (Vercel → Settings → Environment Variables) :
     RESEND_API_KEY, LEAD_TO_EMAIL, LEAD_FROM_EMAIL (expéditeur vérifié),
     ALLOWED_ORIGIN (ex. https://www.votredomaine.fr)
   Puis dans content/site.js : forms.endpoint = "/api/lead"
   Sécurité : méthode POST seule, origine contrôlée, taille limitée,
   champs filtrés et tronqués, échappement HTML, champ piège, limitation
   de débit par IP. Aucune donnée n'est stockée par la fonction.
   ===================================================================== */
const hits = new Map();
const LIMIT = 5, WINDOW = 10 * 60 * 1000;
const FIELDS = { kind: 20, subject: 40, last_name: 100, first_name: 100, phone: 40, email: 200, message: 3000, vehicle: 200, vehicle_id: 120, date: 10, slot: 20, licence: 3, my_car: 200, my_km: 100, wanted: 200, budget: 50, page: 300, consent: 3 };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ ok: false }); }
  const { RESEND_API_KEY, LEAD_TO_EMAIL, LEAD_FROM_EMAIL, ALLOWED_ORIGIN } = process.env;
  if (!RESEND_API_KEY || !LEAD_TO_EMAIL || !LEAD_FROM_EMAIL) return res.status(503).json({ ok: false, error: "not_configured" });
  if (ALLOWED_ORIGIN && req.headers.origin !== ALLOWED_ORIGIN) return res.status(403).json({ ok: false });
  if (Number(req.headers["content-length"] || 0) > 20000) return res.status(413).json({ ok: false });

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "?";
  const now = Date.now(), recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW);
  if (recent.length >= LIMIT) return res.status(429).json({ ok: false });
  hits.set(ip, [...recent, now]);

  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
  b = b && typeof b === "object" ? b : {};
  if (b.website) return res.status(200).json({ ok: true }); // robot

  const d = {};
  for (const [k, max] of Object.entries(FIELDS)) if (b[k] != null) d[k] = String(b[k]).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
  const emailOk = !d.email || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email);
  const valid = d.last_name && d.consent === "oui" && (d.email || d.phone) && emailOk && ["contact", "info", "essai"].includes(d.kind) && (d.kind === "essai" ? d.date && d.licence === "oui" : d.message);
  if (!valid) return res.status(400).json({ ok: false, error: "invalid" });

  const title = { essai: "Demande d'essai", info: "Demande de renseignements", contact: "Contact" }[d.kind] + (d.vehicle ? ` — ${d.vehicle}` : d.subject ? ` — ${d.subject}` : "");
  const LABELS = { last_name: "Nom", first_name: "Prénom", phone: "Téléphone", email: "E-mail", subject: "Sujet", vehicle: "Véhicule", date: "Date souhaitée", slot: "Créneau", my_car: "Son véhicule", my_km: "Km / année", wanted: "Recherche", budget: "Budget", page: "Page" };
  const rows = Object.entries(LABELS).filter(([k]) => d[k]).map(([k, l]) => `<tr><td style="color:#666">${l}</td><td><b>${esc(d[k])}</b></td></tr>`).join("");
  const html = `<h2 style="font-family:sans-serif">${esc(title)}</h2><table cellpadding="6" style="font-family:sans-serif">${rows}</table>` +
    (d.message ? `<p style="font-family:sans-serif;white-space:pre-wrap">${esc(d.message)}</p>` : "") +
    `<p style="font-family:sans-serif;color:#888;font-size:12px">Consentement RGPD donné le ${new Date().toISOString()}</p>`;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: LEAD_FROM_EMAIL, to: [LEAD_TO_EMAIL], subject: title.slice(0, 180), html, ...(d.email && emailOk ? { reply_to: d.email } : {}) }),
    });
    return r.ok ? res.status(200).json({ ok: true }) : res.status(502).json({ ok: false });
  } catch { return res.status(502).json({ ok: false }); }
};
