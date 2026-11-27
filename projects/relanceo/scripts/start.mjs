// Démarrage production hors Vercel (serveur Node classique : VPS, Render, Railway, Fly…).
// Le planificateur est déclenché par un ordonnanceur externe appelant /api/cron/tick avec CRON_SECRET.
import { buildApp } from '../src/app.js';
import { listen } from '../src/http/server.js';

if (!process.env.DATABASE_URL) { console.error('DATABASE_URL manquant.'); process.exit(1); }
if (!process.env.APP_URL) { console.error('APP_URL manquant.'); process.exit(1); }
const { app, services } = await buildApp();
const port = Number(process.env.PORT ?? 3000);
await listen(app, port);
console.log(`RELANCEO en ligne sur le port ${port} — paiement : ${services.billing.name}, e-mail : ${services.email.name}, IA : ${services.ai.name}`);
