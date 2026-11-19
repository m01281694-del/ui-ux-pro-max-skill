# Photos du site

Aucune photo n'a été fournie ni inventée. Déposez ici VOS photos, puis indiquez leur chemin dans `content/site.js` ou `content/vehicles.js`.

| Emplacement | Champ | Format conseillé |
|---|---|---|
| Logo | `site.logo` | SVG ou PNG transparent, hauteur ≥ 84 px |
| Icône d'onglet | `site.favicon` | PNG 512×512 ou SVG (sinon icône neutre `favicon.svg`) |
| Image de partage | `seo.og_image` | JPG 1200×630 |
| Fond du héro | `home.hero.background_image` | JPG/WebP 2400×1350, < 400 Ko |
| Accueil « à propos » | `home.about.image` | portrait 4:5, 1200×1500 |
| Page à propos | `about_page.image`, `about_page.sections[].image` | 16:10, 1920×1200 |
| Galerie | `about_page.gallery[]` | portrait 4:5 |
| Véhicules | `photos` de chaque fiche | 4:3 ou 16:10, 1600 px de large, WebP/JPG < 300 Ko |

Organisation conseillée pour les véhicules : `assets/images/vehicules/<id-du-vehicule>/1.jpg, 2.jpg…`
La première photo sert de vignette dans le catalogue. Renseignez toujours un texte alternatif (`alt`).
