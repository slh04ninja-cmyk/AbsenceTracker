# Architecture cible — AbsenceTrack

État de départ mesuré : `AbsenceTrack-v2.html` = **6637 lignes / 499 Ko** dont **JS 5103 (76 %)**,
HTML 983, CSS 550 — **285 fonctions**, **44 accès directs `localStorage`**, 227 `getElementById`,
**151 `onclick` en ligne**, et **53 sections déjà balisées** par des commentaires `// =====`.

## Principe : monolithe modulaire + livrable « un seul fichier »

Le **source** devient modulaire ; la **livraison** reste un fichier unique (ton canal actuel :
fichier → téléphone, puis APK Capacitor). Le build réassemble tout.

```
AbsenceTrack/
├─ app/
│   ├─ index.html            coquille : structure des pages (0 CSS, 0 JS)
│   ├─ styles/               8 fichiers : base, composants, cartes, formulaires, rôles, sombre,
│   │                        animations, impression
│   └─ js/                   13 fichiers, ordre de chargement fixé par build.py
│       00-noyau.js  constantes, état global, palettes, année scolaire
│       01-utils.js  dates, libellés, cleNomEleve, calculs Ab/Rd
│       02-depot.js  🔑 TOUTES les données (la couche qui manque aujourd'hui)
│       10-ui.js     toasts, modales, confirmation, menus, cascade, thème
│       20-auth.js   comptes, connexion, rôles, mots de passe
│       30-appel.js  enseignant : appel, signalements Ab/Rd
│       31-approbation.js  surveillant/directeur : approbations, justifications
│       32-stats.js  statistiques (partagées dir/surveillant)
│       33-historique.js   historique, fiche élève, export xlsx
│       40-imports.js      MASSAR, FET, tableaux de service, dédoublonnage
│       41-rh.js           personnel, identifiants, PDF
│       42-gestion.js      fermetures, annulations, établissement
│       50-init.js         démarrage
├─ bureau/                   poste d'administration Python/Streamlit (VPS ou Streamlit Cloud)
│   ├─ app.py  pages/ (Import · Identifiants · Rapports · Suivi)
│   └─ .streamlit/secrets.toml   IGNORÉ (service_role ici uniquement)
├─ backend/supabase/         migrations/*.sql · tests RLS · README
├─ outils/                   build.py · verif.py
├─ tests/                    37 suites jsdom (inchangées)
└─ dist/                     AbsenceTrack-vX.Y.html  (artefact, publié en Release)
```

## Les 5 règles

1. **Un fichier = un domaine**, ≤ 400 lignes, un seul titre `// =====`.
2. 🔑 **Aucun `localStorage` en dehors de `02-depot.js`** : les 44 accès deviennent une seule
   porte. C'est ce qui rend Supabase possible sans toucher au métier.
3. **Sens unique** : `UI → domaines → dépôt → stockage`. Le métier n'appelle plus `afficherX()`
   directement : il émet un événement (`absences.changees`) que l'UI écoute.
4. **Une seule façon de faire de l'UI** (déjà la règle du projet) : 1 modale, 1 carte, 1 toast,
   1 menu déroulant, 1 gabarit de hauteur de bouton — ces helpers vivent dans `10-ui.js`.
5. **Le build estampille version + sha256** → plus de contrôle manuel du label.

## Les règles métier descendent dans PostgreSQL

Pour que l'app **et** le bureau Streamlit ne divergent jamais, les règles vivent dans la base :
« un seul Ab/Rd non justifié par élève et par demi-journée » (**contrainte d'unicité**),
« retard > 30 min → absence », totaux et taux de présence (**vues SQL**), cloisonnement des rôles
(**21 politiques RLS**, déjà écrites et testées). Les deux interfaces restent **minces**.

## Feuille de route (chaque étape doit laisser les 37 suites vertes)

| Phase | Contenu | Effort |
|---|---|---|
| **1. GitHub** | dépôt + `.gitignore` + CI (`tests.yml`) + baseline taggée | ~1 h |
| **2. Découpage** | CSS → 8 fichiers (preuve « reconstruction identique »), puis JS → 13 fichiers | 1 session |
| **3. Porte des données** | `02-depot.js` (les 44 accès → 1 interface) + règles métier en SQL | 1 session |
| **4. Supabase** | projet, migrations, comptes réels, `DepotSupabase` derrière la même interface, bascule par drapeau `local`/`serveur` | 1-2 sessions |
| **5. Bureau Streamlit** | Import, Identifiants PDF (RTL arabe), Rapports — sur VPS (Termux ne peut pas : pas de roues `pyarrow`/`pandas` pour Android) | quelques jours |
| **6. APK Capacitor** | l'app pointe sur le serveur | 1 session |

## Points de vigilance

- **Migration des données** à la bascule Supabase : ce que le directeur a en local doit monter au
  serveur **une fois** (export/import explicite, pas de magie).
- **Origine `localStorage`** : ouvrir l'app par une URL (GitHub Pages…) change l'origine et repart
  d'une base vide. Supabase règle le sujet.
- **Secrets** : `anon` dans l'app, `service_role` **uniquement** côté serveur (bureau/VPS).
- **Nommage des classes** : jamais un préfixe réservé (`fa-*` = Font Awesome, utilitaires
  Tailwind). Toujours un préfixe maison : `cascade-`, `fiche-`, `ton-`, `sd-`.
