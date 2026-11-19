/* =====================================================================
   CAP AUTO SEPTÈMES — Fonction d'envoi des formulaires (Vercel)
   Active uniquement si les variables d'environnement suivantes sont
   définies dans Vercel (Project → Settings → Environment Variables) :
     RESEND_API_KEY      clé API du service d'e-mail Resend (resend.com)
     CONTACT_TO_EMAIL    adresse qui reçoit les demandes
     CONTACT_FROM_EMAIL  expéditeur vérifié chez Resend, ex. "Site <site@votredomaine.fr>"
     ALLOWED_ORIGIN      (facultatif) ex. "https://www.votredomaine.fr"
   Puis dans content/site.js : forms.endpoint = "/api/contact"
   Sans configuration, la fonction répond 503 et le site indique au
   visiteur que son message N'A PAS été envoyé.
   ===================================================================== */

const hits = new Map(); // limitation simple par IP (par instance)
const LIMIT = 5, WINDOW = 10 * 60 * 1000;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clip = (s, n) => String(s ?? "").trim().slice(0, n);

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }
  const { RESEND_API_KEY, CONTACT_TO_EMAIL, CONTACT_FROM_EMAIL, ALLOWED_ORIGIN } = process.env;
  if (!RESEND_API_KEY || !CONTACT_TO_EMAIL || !CONTACT_FROM_EMAIL) {
    return res.status(503).json({ ok: false, error: "not_configured" });
  }
  if (ALLOWED_ORIGIN && req.headers.origin && req.headers.origin !== ALLOWED_ORIGIN) {
    return res.status(403).json({ ok: false, error: "forbidden_origin" });
  }

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW);
  if (recent.length >= LIMIT) return res.status(429).json({ ok: false, error: "too_many_requests" });
  hits.set(ip, [...recent, now]);

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  if (body.website) return res.status(200).json({ ok: true }); // champ piège rempli : robot

  const data = {
    last_name: clip(body.last_name, 100), first_name: clip(body.first_name, 100),
    email: clip(body.email, 200), phone: clip(body.phone, 40), subject: clip(body.subject, 150),
    message: clip(body.message, 5000), vehicle_id: clip(body.vehicle_id, 120), vehicle_label: clip(body.vehicle_label, 200),
    page: clip(body.page, 500), consent: body.consent === "oui",
  };
  const emailOk = !data.email || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email);
  if (!data.last_name || !data.message || !data.consent || (!data.email && !data.phone) || !emailOk) {
    return res.status(400).json({ ok: false, error: "invalid" });
  }

  const subject = data.vehicle_label
    ? `Demande véhicule : ${data.vehicle_label}`
    : `Contact site${data.subject ? " : " + data.subject : ""}`;
  const rows = [
    ["Nom", `${data.last_name} ${data.first_name}`.trim()], ["E-mail", data.email], ["Téléphone", data.phone],
    ["Sujet", data.subject], ["Véhicule", data.vehicle_label && `${data.vehicle_label} (${data.vehicle_id})`], ["Page", data.page],
  ].filter((r) => r[1]);
  const html = `<table cellpadding="6">${rows.map(([k, v]) => `<tr><td><b>${esc(k)}</b></td><td>${esc(v)}</td></tr>`).join("")}</table>` +
    `<p style="white-space:pre-wrap">${esc(data.message)}</p><p><small>Consentement RGPD donné le ${new Date().toISOString()}</small></p>`;

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: CONTACT_FROM_EMAIL, to: [CONTACT_TO_EMAIL], subject, html, ...(data.email ? { reply_to: data.email } : {}) }),
    });
    if (!r.ok) return res.status(502).json({ ok: false, error: "send_failed" });
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(502).json({ ok: false, error: "send_failed" });
  }
};
