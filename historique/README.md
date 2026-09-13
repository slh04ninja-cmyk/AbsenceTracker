# Historique — les 143 scripts de « patch » (avant Git)

Ce dossier contient les outils qui ont servi à faire évoluer l'application **avant la mise sous
Git** (09 → 13 septembre 2026, versions v1.9 → v3.86). Rien ici n'est utilisé par l'application
ni par les tests : **c'est une archive**.

## La méthode qu'ils appliquaient

Sur un fichier unique de 500 Ko, sans versionnage, chaque modification se faisait par un script
Python plutôt qu'à la main :

1. **déclarer l'intention** en tête du script (`# patch_v5z.py — v3.86 : CORRECTIF — ...`)
2. **remplacer des chaînes exactes, avec comptage d'occurrences** — si l'ancre a bougé ou
   apparaît deux fois, le script **refuse** au lieu de patcher au mauvais endroit
3. **vérifier à la fin** : validité du bloc JS (`node --check`), équilibre des `<div>`, résidus

C'était à la fois la sécurité, la traçabilité et le verrou d'idempotence — autrement dit le
contrôle de version avant Git.

## Pourquoi ils sont archivés

Ils sont **tous appliqués** : leurs ancres n'existent plus, les relancer échoue (au mieux).
Aucun fichier vivant ne les appelle. Git fait désormais ce travail, mieux : `git log`, `git diff`,
`git revert`, et la CI qui rejoue les 37 suites.

## La règle à partir de maintenant

- une modification courante = **édition directe + commit + CI** (plus de `patch_*.py`)
- un script reste justifié pour une **transformation mécanique de masse** — c'est exactement ce
  que sera le découpage du fichier en modules (phase 2), où le script est la *preuve* de la
  transformation

## Contenu

- `patch_v2*.py` → `patch_v5z.py` (108) : un script par version publiée
- `patch_lots*.py` (5) : variantes de thème par rôle
- `fix_*.py` (4), `test_v3m.py` : correctifs ponctuels (le second était mal nommé : ce n'est pas
  un test mais un patch)
- `_test_*.js`, `_cl.js`, `_d.js` : vérifications ponctuelles de l'époque, remplacées depuis par
  les 37 suites de `tests/`
- `_tableaux_js.txt`, `emploi_du_temps_TCSF-*.xlsx`, `tab_service_TCSLHF1.json` : fichiers de
  travail intermédiaires, lus par aucun code vivant
