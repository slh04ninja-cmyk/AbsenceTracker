# AbsenceTrack

> **Avant toute modification, lire [`AGENTS.md`](AGENTS.md)** : méthode de travail
> exigée par le propriétaire, commandes de construction et de vérification, accès à la base de
> données, règles métier à ne pas régresser et pièges déjà payés.

Application de gestion des absences et des annulations de séances pour un établissement
scolaire marocain (import des listes **MASSAR**, tableaux de service, emplois du temps **FET**).

**Le source est modulaire, le livrable reste un fichier unique.** Le code vit dans `app/`
(`index.html`, les feuilles de `app/styles/` et les **24 modules** de `app/js/`) ;
`outils/build.py` l'assemble dans `AbsenceTrack-v2.html`, le fichier qu'on ouvre sur le téléphone
(aucune installation) — c'est aussi celui que lisent les **49 suites de tests**.

> ⚠️ **`AbsenceTrack-v2.html` est un fichier produit : ne jamais l'éditer à la main.**
> On modifie `app/`, puis `python3 outils/build.py`. La CI vérifie à chaque push que les deux
> n'ont pas divergé (`build.py --verifier`).

## Les 3 rôles

| Rôle | Ce qu'il fait |
|---|---|
| **Enseignant** | l'appel de sa séance, signale les absences / retards (Ab / Rd) |
| **Surveillant** | approuve ou justifie les Ab/Rd, consulte les Stats |
| **Directeur** | tout, plus : RH & identifiants, Gestion (imports, fermetures, annulations), Historique, Stats, fiche élève |

## Structure du dépôt

```
app/index.html               la coquille : structure des pages
app/styles/                  8 feuilles CSS (base, cartes, thème sombre, formes, listes…)
app/js/                      18 modules JS dans l'ordre de chargement
AbsenceTrack-v2.html         LE LIVRABLE (assemblé — ne pas éditer)
dist/                        copies horodatées par version (générées)
tests/                       37 suites jsdom
   └── fixtures/              données de test réelles (relevés MASSAR, tableaux de service, arabe)
outils/verif.py              vérification : syntaxe + divs + nommage + porte Depot + suites (rapide / complet)
outils/build.py              assemble app/ -> livrable (+ --verifier pour la CI)
outils/pdf/                  générateur des PDF (identifiants, fiche) + tables arabes
outils/generateurs/          régénère les fixtures de tests/ à partir des fichiers xlsx
outils/verifications/        contrôles ciblés (arabe, modèle de données, emplois du temps, seed)
supabase/                    serveur : migrations/ (schéma 9 tables + règles métier) et tests/ (2 bancs d'essai)
fonts/                       police arabe (Noto Naskh) pour les PDF RTL
historique/                  archive : les 143 scripts de patch d'avant Git (voir son README)
.github/workflows/           tests.yml (les 37 suites), release.yml (livrable joint à la Release)
ARCHITECTURE.md              architecture cible et feuille de route
```

**La porte des données** : tout accès au stockage passe par `Depot` (`app/js/01-chargement.js`) —
c'est le seul endroit qui touche `localStorage`, et `verif.py` le vérifie. C'est cette porte qui
sera remplacée par Supabase.

Les suites se lancent **depuis la racine du dépôt** (leurs chemins de fixtures sont relatifs à
la racine, pas au dossier `tests/`) — `python3 outils/verif.py` s'en charge.


## Lancer les vérifications

```bash
npm ci                              # une fois (jsdom)
python3 outils/verif.py rapide      # ~20 s  : 6 suites sensibles + contrôles de forme
python3 outils/verif.py tout        # ~2 min : les 37 suites, 3 en parallèle
```

`verif.py` contrôle aussi : validité JS du bloc `<script>`, équilibre des `<div>`, label de
version, et **aucune classe `fa-<chiffre>`** (ce sont des icônes Font Awesome : elles
afficheraient un numéro dans l'interface).

## Construire le livrable

```bash
python3 outils/build.py             # app/ -> AbsenceTrack-v2.html + dist/AbsenceTrack-vX.Y.html
python3 outils/build.py --verifier  # contrôle : le livrable correspond-il à app/ ? (CI)
```

## Intégration continue

- `.github/workflows/tests.yml` — les 38 suites + vérification `build.py --verifier`
- `.github/workflows/sql.yml` — les migrations sur un vrai PostgreSQL + les 2 bancs d'essai (23 cas règles, 39 cas cloisonnement)
- `.github/workflows/release.yml` — sur un tag `v*`, le fichier unique est joint à la Release

## Sécurité

- La clé **`anon`** de Supabase peut vivre dans l'app (les règles **RLS** protègent les données).
- La clé **`service_role`** ne doit **jamais** entrer dans ce dépôt ni dans un fichier livré :
  elle reste dans les secrets du serveur (voir `.gitignore`).
- Aucun export MASSAR réel ni identifiant réel n'est commité : les données du prototype sont
  des données de test.

## Feuille de route

Voir `ARCHITECTURE.md` : découpage du fichier en modules, couche d'accès aux données,
branchement Supabase, bureau d'administration (Streamlit), APK Capacitor.
