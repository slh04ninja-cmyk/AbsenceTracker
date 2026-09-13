# Architecture cible — AbsenceTrack

État de départ mesuré : `AbsenceTrack-v2.html` = **6637 lignes / 499 Ko** dont **JS 5103 (76 %)**,
HTML 983, CSS 550 — **285 fonctions**, **44 accès directs `localStorage`**, 227 `getElementById`,
**151 `onclick` en ligne**, et **53 sections déjà balisées** par des commentaires `// =====`.

## Principe : monolithe modulaire + livrable « un seul fichier »

> ⚠️ `AbsenceTrack-v2.html` est un **fichier produit** (assemblé depuis `app/`) : ne jamais
> l'éditer à la main. On modifie `app/`, on lance `python3 outils/build.py` ; la CI refuse
> un push où les deux ont divergé (`build.py --verifier`).

Le **source** devient modulaire ; la **livraison** reste un fichier unique (ton canal actuel :
fichier → téléphone, puis APK Capacitor). Le build réassemble tout.

```
AbsenceTrack/
├─ app/                     ← FAIT (phase 2, étape 1) : la source de vérité
│   ├─ index.html            la coquille : structure des pages (sans CSS ni JS)
│   ├─ styles/               8 feuilles : 00-base, 01-cartes-compactes-direction, 02-theme-sombre, 03-bloc-motif-de-justification, 04-cartes-eleves-unifiees-dashboard, 05-lots-par-role-clair-enseignant, 06-menus-deroulants-select, 07-listes-deroulantes-personnalisees
│   └─ js/                   18 modules, dans l ordre de chargement :
│       00-noyau
│       01-chargement
│       02-tableaux-service
│       03-comptes
│       04-gestion
│       05-formulaires
│       06-rh
│       07-socle
│       08-enseignant
│       09-stats
│       10-surveillant
│       11-directeur
│       12-imports
│       13-fiches
│       14-theme-lots
│       15-donnees-test
│       16-init
│       17-listes-deroulantes
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
2. 🔑 **Aucun `localStorage` en dehors de la porte `Depot`** ✅ *(fait — phase 3, étape 1)* :
   `Depot.lire/lireJSON/ecrire/ecrireJSON/effacer` vit dans `app/js/01-chargement.js` et les
   **43 accès** qui étaient éparpillés dans 12 modules passent par elle. `verif.py` refuse tout
   `localStorage` ailleurs. C'est ce qui rend Supabase possible sans toucher au métier : le jour
   où les données vivent sur le serveur, seule cette porte change.
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
| **2. Découpage** ✅ | Fait : `app/` = 18 modules JS + 8 feuilles CSS, assemblés par `build.py` — **preuve : le fichier reconstruit est identique au bit près** (511 285 o) | fait |
| **3. Porte des données** ✅ | Fait : porte `Depot` dans `01-chargement.js` (43 accès → 1 interface), contrôlée par `verif.py` | fait |
| **3bis. Règles métier en SQL** | vues + contraintes dans `supabase/migrations/` (prérequis du bureau Streamlit) | 1 session |
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
