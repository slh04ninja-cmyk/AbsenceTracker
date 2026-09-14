-- Banc d'essai : retirer une personne SANS casser l'historique (migration 0004).
-- On verifie surtout que le verrou de colonne tient toujours : le directeur peut changer le NOM
-- et ACTIF d'une fiche, jamais le ROLE (contre l'escalade de privileges).
-- ATTENDUS-ECHEC: 1b, 1e
-- 1b : le role d'une fiche reste verrouille (colonne non autorisee) — verrou volontaire.
-- 1e : un enseignant non plus ne peut pas se changer de role.

grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
grant usage on schema public to authenticated, anon;

insert into auth.users (id, email) values
 ('11111111-1111-1111-1111-111111111111', 'd@taalim.ma'),
 ('33333333-3333-3333-3333-333333333333', 'fr-prof1@taalim.ma');

insert into etablissements (id, code, nom) overriding system value values (1, 'X', 'Test');
insert into profils (id, auth_user_id, etablissement_id, email, code, nom, role) overriding system value values
 (1, '11111111-1111-1111-1111-111111111111', 1, 'd@taalim.ma',       'dir',     'Directeur',  'directeur'),
 (2, null,                                   1, 'fr-prof1@taalim.ma', 'fr-prof1','Prof FR',    'enseignant'),
 (3, '33333333-3333-3333-3333-333333333333', 1, 'fr2@taalim.ma',      'fr2',     'Prof FR 2',  'enseignant');
select setval(pg_get_serial_sequence('profils','id'), 100) as compteur;

\echo '################ RETIRER UNE PERSONNE (actif = false) ################'

\echo '--- 1a. le DIRECTEUR marque une fiche enseignante INACTIVE : doit PASSER'
set role authenticated;
set app.uid = '11111111-1111-1111-1111-111111111111';
update profils set actif = false where code = 'fr-prof1';
select count(*) as fiche_desactivee from profils where code = 'fr-prof1' and actif = false;

\echo '--- 1b. le DIRECTEUR tente de changer le ROLE d une fiche : doit ECHOUER'
update profils set role = 'surveillant' where code = 'fr2';

\echo '--- 1c. le directeur peut corriger un NOM (doit PASSER, et actif reste modifiable)'
update profils set nom = 'Prof FR 2 corrige' where code = 'fr2';
select count(*) as nom_corrige from profils where code = 'fr2' and nom = 'Prof FR 2 corrige';

\echo '--- 1d. un ENSEIGNANT ne peut PAS desactiver une autre fiche (0 ligne touchee)'
set app.uid = '33333333-3333-3333-3333-333333333333';
update profils set actif = false where code = 'dir';
select count(*) as directeur_toujours_actif from profils where code = 'dir' and actif = true;

\echo '--- 1e. un enseignant ne peut PAS se changer de role (doit ECHOUER)'
update profils set role = 'directeur' where code = 'fr2';

\echo '--- 1f. une fiche inactive reste la, avec son historique lisible (attendu 1)'
reset role;
select count(*) as fiches_inactives from profils where actif = false;
