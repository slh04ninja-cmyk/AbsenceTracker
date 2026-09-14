-- Banc d'essai de la « porte du premier directeur » (migration 0003).
-- Base NEUVE : les migrations ne creent aucune donnee, donc aucun etablissement
-- et aucune fiche au depart. On rejoue exactement le parcours d'installation.
-- ATTENDUS-ECHEC: 1a, 1c, 1d, 1i, 1j

grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
grant execute on function auth.jwt() to authenticated, anon;
grant usage on schema public to authenticated, anon;

insert into auth.users (id, email) values
 ('11111111-1111-1111-1111-111111111111', 'directeur@taalim.ma'),
 ('77777777-7777-7777-7777-777777777777', 'directeur2@taalim.ma'),
 ('22222222-2222-2222-2222-222222222222', 'vide@taalim.ma');

\echo '################ LA PORTE DU PREMIER DIRECTEUR ################'

\echo '--- 1a. un visiteur ANONYME ne peut pas ouvrir la porte : doit ECHOUER'
set role anon;
select premier_directeur('ETAB-X', 'Etablissement X', 'Directeur X');

\echo '--- 1b. un compte connecte SANS fiche cree l etablissement et sa fiche : doit PASSER'
set role authenticated;
set app.uid = '11111111-1111-1111-1111-111111111111';
set app.email = 'directeur@taalim.ma';
select premier_directeur('ETAB-X', 'Etablissement X', 'Directeur X', 'Grand Casablanca-Settat', 'Settat') as fiche_creee;

\echo '--- 1c. le MEME compte rappelle la porte : doit ECHOUER'
select premier_directeur('ETAB-Y', 'Etablissement Y', 'Directeur X');

\echo '--- 1d. un AUTRE compte sur un etablissement qui a DEJA un directeur : doit ECHOUER'
set app.uid = '77777777-7777-7777-7777-777777777777';
set app.email = 'directeur2@taalim.ma';
select premier_directeur('ETAB-X', 'Etablissement X', 'Directeur 2');

\echo '--- 1e. la fiche creee porte le role directeur, le compte et l email (attendu 1)'
reset role;
select count(*) as fiche_directeur_complete from profils
 where role = 'directeur'
   and auth_user_id = '11111111-1111-1111-1111-111111111111'
   and email = 'directeur@taalim.ma';

\echo '--- 1f. l etablissement a bien ete cree avec son code et son nom (attendu 1)'
select count(*) as etablissement_cree from etablissements
 where code = 'ETAB-X' and nom = 'Etablissement X' and direction = 'Settat';

\echo '--- 1g. un compte sur un DEUXIEME etablissement : doit PASSER'
set role authenticated;
set app.uid = '77777777-7777-7777-7777-777777777777';
set app.email = 'directeur2@taalim.ma';
select premier_directeur('ETAB-Y', 'Etablissement Y', 'Directeur 2') as fiche_2;

\echo '--- 1h. chaque etablissement a bien SON propre directeur (attendu 2)'
reset role;
select count(*) as deux_directeurs_deux_ecoles from profils where role = 'directeur';

\echo '--- 1i. un compte qui a DEJA une fiche ne peut pas en ouvrir une autre : doit ECHOUER'
set role authenticated;
set app.uid = '11111111-1111-1111-1111-111111111111';
set app.email = 'directeur@taalim.ma';
select premier_directeur('ETAB-Z', 'Etablissement Z', 'Directeur X');

\echo '--- 1j. code d etablissement vide : doit ECHOUER'
set app.uid = '22222222-2222-2222-2222-222222222222';
set app.email = 'vide@taalim.ma';
select premier_directeur('   ', 'Sans code', 'Quelqu un');
