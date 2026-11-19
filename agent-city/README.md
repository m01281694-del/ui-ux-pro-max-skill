# Agent City

Une ville vivante de 1 000 habitants. Une partie d'entre eux travaille dans 6 départements et 36 métiers qui automatisent la production de contenu. À côté, un « Cerveau » : un graphe de connaissances 3D qui grandit.

- `/city` : carte isométrique (PixiJS), fiches habitants et bâtiments, fil d'activité, recherche « qui fait quoi », tableau de bord, organigramme, économie, replay.
- `/brain` : graphe 3D façon Obsidian (`brain/` est un vault Obsidian).
- `/gallery` : productions et statut de chacune.
- `/system` : santé, files de tâches, coûts IA, connecteurs, kill switch.

## Lancer

```bash
npm install
npm run dev            # http://localhost:3000
npm test               # Vitest
npx playwright test --trace off   # e2e (serveur lancé, BASE_URL=http://localhost:3000)
npm run brain:seed     # (ré)écrit les notes de départ du cerveau
```

## Variables d'environnement

| Nom | Rôle |
|---|---|
| `SITE_PASSWORD` | Protège tout le site (HTTP Basic). |
| `ANTHROPIC_API_KEY` | Claude (chat avec les habitants, puis agents en Phase 2). |
| `AI_DAILY_CAP_EUR` | Plafond de dépense IA par jour (10 par défaut). |
| `DEMO_MODE=off` | Coupe les données DÉMO. |

Architecture et choix détaillés : voir [`DECISIONS.md`](./DECISIONS.md).
