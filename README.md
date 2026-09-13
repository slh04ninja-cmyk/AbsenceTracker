# AbsenceTrack

Application de gestion des absences et des annulations de séances pour un établissement
scolaire marocain (import des listes **MASSAR**, tableaux de service, emplois du temps **FET**).

Aujourd'hui : **une seule page HTML** (`AbsenceTrack-v2.html`) — Tailwind CDN + Font Awesome +
XLSX + parser FET maison, données en `localStorage`. Livrable : un fichier unique qu'on ouvre
sur le téléphone (aucune installation).

## Les 3 rôles

| Rôle | Ce qu'il fait |
|---|---|
| **Enseignant** | l'appel de sa séance, signale les absences / retards (Ab / Rd) |
| **Surveillant** | approuve ou justifie les Ab/Rd, consulte les Stats |
| **Directeur** | tout, plus : RH & identifiants, Gestion (imports, fermetures, annulations), Historique, Stats, fiche élève |

## Structure du dépôt

```
AbsenceTrack-v2.html      l'application (source unique aujourd'hui)
supabase/                 schéma serveur : schema.sql (9 tables, 21 règles RLS), tests
fonts/                    police arabe (Noto Naskh) pour les PDF RTL
test_*.js                 37 suites de tests (jsdom) — chargées depuis le fichier réel
outils/verif.py           vérification : syntaxe + divs + nommage + suites (rapide / complet)
outils/build.py           construit le livrable « un seul fichier » (dist/)
package.json              jsdom épinglé (npm ci en CI)
ARCHITECTURE.md           architecture cible et feuille de route
```

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
python3 outils/build.py             # -> dist/AbsenceTrack-vX.Y.html (+ sha256)
```

## Intégration continue

- `.github/workflows/tests.yml` — les 37 suites à chaque push / pull request
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
