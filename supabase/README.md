# AbsenceTrack — base de données (Supabase / PostgreSQL)

Ce dossier contient **uniquement le côté serveur**. Le prototype HTML n'est pas
touché : il continue de fonctionner comme avant tant que rien n'est branché.

| Fichier | Rôle |
|---|---|
| `schema.sql` | Le schéma complet : tables, règles métier, cloisonnement par rôle. **Rien n'est exécuté tant que tu ne le valides pas.** |
| `verif_schema.sql` | Le banc d'essai : **39 cas** (doit-passer / doit-échouer). |
| `_verifier.sh` | Lance un PostgreSQL local, applique `schema.sql` en mode strict, joue les vérifications et rend le verdict. |
| `_rapport.py` | Transforme la sortie brute en tableau lisible. |
| `_maj_schema_v2.py` | Le correctif appliqué au schéma après la précision sur le parcours réel (fiche ⇄ compte). |

## Rien n'est pré-rempli — c'est voulu

Les classes et les professeurs du prototype sont des **données de test** et ne
seront **pas reprises**. Le vrai parcours, après installation :

1. **Le directeur crée son compte** (Supabase Auth) → sa fiche + son établissement
2. Il ouvre **Gestion → Importation des fichiers** et importe :
   - **les listes MASSAR** (xlsx) → crée les **classes** et les **élèves**
   - **les tableaux de services** (xlsx ou **FET**) → crée les **fiches des enseignants** + leurs **séances**
   - **les tableaux d'élèves** (xlsx ou FET) → complète les classes
3. Il crée ensuite les **comptes de connexion** de ses enseignants (email + mot de
   passe) : la fiche existante est **reliée** à son compte.

C'est pour ça que la base sépare **la fiche** (la personne, créée par l'import)
du **compte** (les identifiants) : un enseignant peut avoir ses séances avant
d'avoir son mot de passe. Le lien `auth_user_id` est posé par la fonction
serveur, jamais depuis l'application.

## Comment appliquer (quand le schéma sera validé)

1. Créer le projet sur **supabase.com** (région Europe — la plus proche)
2. **SQL Editor** → coller tout `schema.sql` → *Run*
3. **Authentication → Users** → créer le compte du directeur
4. Décommenter la section `9. AMORÇAGE` de `schema.sql`, mettre l'UUID du compte
   directeur → *Run*
5. **Settings → API** → noter l'URL du projet et la clé **anon** (clé publique).
   La clé **service_role** ne doit JAMAIS entrer dans l'application.

## Rejouer les vérifications sur le téléphone

```bash
bash supabase/_verifier.sh
```

Le script démarre le PostgreSQL local (socket `~/pgsock`, port 5439), crée une
base neuve, applique le schéma **en mode strict** (la moindre erreur arrête tout)
puis déroule les 39 cas et affiche le verdict.

## Ce que la base garantit (vérifié, pas supposé)

**Règles métier**
- un élève ne peut avoir **qu'un seul signalement par jour et par demi-journée** — la règle exacte déjà appliquée par l'application ;
- un **retard** doit porter sa durée en minutes ;
- un signalement **justifié** doit porter **qui** a décidé et **quand** ;
- pas deux fois **le même créneau** pour un enseignant ; horaires cohérents ;
- pas deux fois **le même code élève** dans une classe (autorisé d'une classe à l'autre) ;
- une fermeture ne peut pas finir avant de commencer ;
- un surveillant ne peut pas recevoir de matière ;
- **une fiche d'enseignant peut exister sans compte** et porter ses séances (import avant les comptes) ;
- **plusieurs fiches sans email** coexistent (les profs importés) ;
- à l'inverse, **on ne relie pas un compte sans email** (lien incohérent refusé).

**Cloisonnement par rôle**
- un **enseignant** ne voit **que ses propres signalements** — jamais ceux de son collègue ;
- un **surveillant** voit tout l'établissement, saisit et approuve ;
- seul le **directeur** gère classes, élèves, séances, fermetures, absences du personnel, annulations, et crée les **fiches** ;
- une personne **sans connexion** ne voit **rien** ;
- **un enseignant ne peut pas s'attribuer le rôle « directeur »** (verrou de colonne) ;
- un directeur peut corriger **son** nom, mais **pas celui d'un autre directeur**.

## Reste à faire

- [ ] Fonction serveur (Edge Function) : créer / réinitialiser le **compte** d'un
      enseignant et **relier** sa fiche — c'est la seule clé `service_role`, côté serveur
- [ ] Branchage de l'application : couche d'accès aux données + vraie connexion
- [ ] Écrire les données importées **sur le serveur** (aujourd'hui l'import écrit en local)
