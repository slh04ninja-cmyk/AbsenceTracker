# Migrations — le schéma et les règles, rejouables

Les migrations s'appliquent **dans l'ordre du nom** et décrivent l'état voulu de la base.
Aucune n'est modifiée après coup : un changement se fait dans une **nouvelle** migration.

| Fichier | Contenu |
|---|---|
| `0001_schema.sql` | 9 tables, les types, le cloisonnement par rôle (21 politiques RLS) |
| `0002_regles_metier.sql` | les règles métier en SQL : type effectif (30 min), séances annulées (2 sources), séances dues, taux de présence, totaux |

## Ce que la base garantit (et ce qu'elle ne garantit pas)

**Garanti par la base** — impossible à contourner depuis un client :

- un seul signalement par élève, par jour et par demi-journée (contrainte d'unicité) ;
- un retard a forcément sa durée, une absence n'en a pas ;
- un signalement justifié a forcément son décideur et sa date ;
- un enseignant ne peut pas se promouvoir directeur (verrou de colonne + RLS) ;
- un compte ne voit que ce que son rôle autorise (RLS, y compris à travers les vues) ;
- les règles de calcul (retard > 30 min = absence, séances dues, taux de présence…) sont
  **écrites une seule fois** : l'app mobile et le bureau d'administration lisent les mêmes.

**Volontairement PAS en base** :

- « un seul Ab/Rd **non justifié** par élève » — c'est une règle de **travail** de l'application
  (elle pousse à traiter les dossiers). L'inscrire ici empêcherait d'importer un historique
  (le bureau saisira des mois d'absences d'un coup). Le banc d'essai vérifie explicitement que
  la base **accepte** plusieurs non justifiés, pour que personne ne l'y remette par erreur.

## Appliquer sur Supabase

```bash
# avec la CLI Supabase
supabase db push                     # applique migrations/ dans l'ordre

# ou à la main, dans l'éditeur SQL du tableau de bord : coller 0001 puis 0002
```

Les vues sont créées en `security_invoker = true` : sans cela une vue s'exécuterait avec les
droits de son propriétaire et **contournerait la RLS**.

## Vérifier localement (recommandé avant tout envoi)

```bash
bash supabase/_verifier.sh          # Termux : démarre le PostgreSQL local au besoin
```

Le harnais crée **une base neuve par banc d'essai**, applique toutes les migrations en mode
strict, puis joue :

- `tests/verif_schema.sql` — 39 cas : contraintes + cloisonnement par rôle (15 refus voulus)
- `tests/verif_regles.sql` — 23 cas : les règles métier et les calculs (1 refus voulu)

Chaque banc d'essai annonce ses cas par `\echo --- Na. libellé` et la liste des refus attendus
dans un en-tête `-- ATTENDUS-ECHEC: …` ; `_rapport.py` en tire un verdict (et sort en erreur si
un cas se comporte autrement que prévu).

⚠️ Piège déjà rencontré : deux bancs d'essai sur la **même** base se contaminent (données et
droits) — d'où la base neuve par banc.
