-- Vérification réelle du schéma (v2) : contraintes métier + cloisonnement par rôle.
-- Simule Supabase : rôle « authenticated » + auth.uid() lue dans une variable de
-- session, pour se mettre dans la peau de chaque utilisateur.
--
-- Le parcours réel est simulé : l'établissement est VIDE au départ, le directeur
-- importe ses fichiers (les classes, les élèves et les fiches d'enseignants se
-- créent à ce moment-là), et les comptes viennent après.
--
-- Attendus au moment du §2 : 7 fiches (5 avec compte, 2 sans), 3 élèves,
-- 2 séances, 4 puis 5 signalements.

-- ATTENDUS-ECHEC: 1b, 1d, 1g, 1i, 1j, 1l, 1n, 1o, 1r, 2e, 2h, 2l, 2n, 2p, 2q
-- (les cas qui DOIVENT etre refuses par la base ; le reste doit passer)

grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;

-- Droits que Supabase accorde d'office aux utilisateurs connectés :
-- sans eux, ce n'est pas la RLS qui s'applique mais un simple refus de droit.
grant usage on schema public to authenticated, anon;

-- ---------- jeu de données ----------
insert into auth.users (id, email) values
 ('11111111-1111-1111-1111-111111111111', 'd@taalim.ma'),
 ('77777777-7777-7777-7777-777777777777', 'd2@taalim.ma'),
 ('22222222-2222-2222-2222-222222222222', 's1@taalim.ma'),
 ('33333333-3333-3333-3333-333333333333', 'fr-prof1@taalim.ma'),
 ('44444444-4444-4444-4444-444444444444', 'math-prof1@taalim.ma'),
 ('55555555-5555-5555-5555-555555555555', 'sans-fiche@taalim.ma');

insert into etablissements (id, code, nom) overriding system value values (1, 'X', 'Test');

-- La fiche et le compte sont dissociés : « eps-new » est une fiche créée par
-- l'import d'un tableau de service, avant que le compte n'existe.
insert into profils (auth_user_id, etablissement_id, email, code, nom, role, matiere) values
 ('11111111-1111-1111-1111-111111111111', 1, 'd@taalim.ma',         'dir',        'Directeur',     'directeur',  null),
 ('77777777-7777-7777-7777-777777777777', 1, 'd2@taalim.ma',        'dir2',       'Directeur 2',   'directeur',  null),
 ('22222222-2222-2222-2222-222222222222', 1, 's1@taalim.ma',        null,         'Surveillant 1', 'surveillant',null),
 ('33333333-3333-3333-3333-333333333333', 1, 'fr-prof1@taalim.ma',  'fr-prof1',   'سامية الحاضي', 'enseignant', 'Français'),
 ('44444444-4444-4444-4444-444444444444', 1, 'math-prof1@taalim.ma','math-prof1', 'أيوب الكمرة',  'enseignant', 'Maths');
insert into profils (etablissement_id, email, code, nom, role, matiere) values
 (1, null, 'eps-new', 'أستاذ مربّي بدني (importé)', 'enseignant', 'EPS');

insert into classes (id, etablissement_id, nom) overriding system value values (1, 1, 'TCSF-1');
insert into eleves (id, classe_id, code_massar, nom, prenom) overriding system value values
 (1, 1, 'M001', 'El Amrani', 'Mehdi'),
 (2, 1, 'M002', 'Berrada',   'Imane');
-- un tableau de service valide (créneau de référence)
insert into seances (etablissement_id, prof_id, classe_id, jour, debut, fin, salle, matiere)
values (1, (select id from profils where code = 'math-prof1'), 1, 1, '15:00', '17:00', 'S1', 'Maths');

-- les id explicites ci-dessus ne font pas avancer les compteurs automatiques
select setval(pg_get_serial_sequence('etablissements','id'), 100) as etab,
       setval(pg_get_serial_sequence('classes','id'), 100) as classes,
       setval(pg_get_serial_sequence('eleves','id'), 100) as eleves;

\echo '################ 1. CONTRAINTES METIER ################'

\echo '--- 1a. signalement normal : doit PASSER'
insert into signalements (etablissement_id, eleve_id, classe_id, prof_id, date_abs, moment, heure, type, statut, signale_par)
values (1, 1, 1, (select id from profils where code = 'fr-prof1'), '2026-09-01', 'matin', '08:05', 'absence', 'absent',
        (select id from profils where code is null and role = 'surveillant' limit 1));

\echo '--- 1b. MEME eleve + MEME jour + MEME demi-journee : doit ECHOUER (doublon)'
insert into signalements (etablissement_id, eleve_id, classe_id, prof_id, date_abs, moment, heure, type, statut, signale_par)
values (1, 1, 1, (select id from profils where code = 'fr-prof1'), '2026-09-01', 'matin', '09:05', 'absence', 'absent',
        (select id from profils where code is null and role = 'surveillant' limit 1));

\echo '--- 1c. meme eleve mais APRES-MIDI : doit PASSER'
insert into signalements (etablissement_id, eleve_id, classe_id, prof_id, date_abs, moment, heure, type, statut, signale_par)
values (1, 1, 1, (select id from profils where code = 'fr-prof1'), '2026-09-01', 'apres-midi', '14:05', 'absence', 'absent',
        (select id from profils where code is null and role = 'surveillant' limit 1));

\echo '--- 1d. retard SANS duree : doit ECHOUER'
insert into signalements (etablissement_id, eleve_id, classe_id, prof_id, date_abs, moment, heure, type, statut, signale_par)
values (1, 2, 1, (select id from profils where code = 'fr-prof1'), '2026-09-02', 'matin', '08:05', 'retard', 'absent',
        (select id from profils where code is null and role = 'surveillant' limit 1));

\echo '--- 1e. retard AVEC duree 45 min : doit PASSER'
insert into signalements (etablissement_id, eleve_id, classe_id, prof_id, date_abs, moment, heure, type, retard_minutes, statut, signale_par)
values (1, 2, 1, (select id from profils where code = 'fr-prof1'), '2026-09-02', 'matin', '08:05', 'retard', 45, 'absent',
        (select id from profils where code is null and role = 'surveillant' limit 1));

\echo '--- 1f. signalement d un AUTRE enseignant (maths) : doit PASSER'
insert into signalements (etablissement_id, eleve_id, classe_id, prof_id, date_abs, moment, heure, type, statut, signale_par)
values (1, 2, 1, (select id from profils where code = 'math-prof1'), '2026-09-03', 'matin', '09:05', 'absence', 'absent',
        (select id from profils where code is null and role = 'surveillant' limit 1));

\echo '--- 1g. justifie SANS decideur : doit ECHOUER'
update signalements set statut = 'justifie_s' where eleve_id = 2 and prof_id = (select id from profils where code = 'fr-prof1');

\echo '--- 1h. justifie AVEC decideur : doit PASSER'
update signalements set statut = 'justifie_s',
       decide_par = (select id from profils where role = 'surveillant' limit 1), decide_le = now()
 where eleve_id = 2 and prof_id = (select id from profils where code = 'fr-prof1');
select count(*) as justifies_avec_decideur from signalements where statut = 'justifie_s' and decide_par is not null;

\echo '--- 1i. horaire inversé dans un tableau de service : doit ECHOUER'
insert into seances (etablissement_id, prof_id, classe_id, jour, debut, fin) values
 (1, (select id from profils where code = 'math-prof1'), 1, 2, '17:00', '15:00');

\echo '--- 1j. code élève duplique dans la meme classe : doit ECHOUER'
insert into eleves (classe_id, code_massar, nom, prenom) values (1, 'M001', 'Doublon', 'Test');

\echo '--- 1k. code élève dupliqué mais dans une AUTRE classe : doit PASSER'
insert into classes (etablissement_id, nom) values (1, 'TCSF-2');
insert into eleves (classe_id, code_massar, nom, prenom)
  values ((select id from classes where nom = 'TCSF-2'), 'M001', 'El Amrani', 'Ahmed');

\echo '--- 1l. matiere interdite a un surveillant : doit ECHOUER'
insert into profils (etablissement_id, nom, role, matiere) values (1, 'Surveillant fautif', 'surveillant', 'EPS');

\echo '--- 1m. fiche de surveillant sans matiere et sans compte : doit PASSER'
insert into profils (etablissement_id, nom, role) values (1, 'Surveillant 3', 'surveillant');

\echo '--- 1n. deux fois le meme creneau pour un prof : doit ECHOUER'
insert into seances (etablissement_id, prof_id, classe_id, jour, debut, fin) values
 (1, (select id from profils where code = 'math-prof1'), 1, 1, '15:00', '16:00');

\echo '--- 1o. fermeture avec fin avant debut : doit ECHOUER'
insert into fermetures (etablissement_id, type, debut, fin) values (1, 'Vacances', '2026-10-07', '2026-10-01');

\echo '--- 1p. IMPORT : une fiche d enseignant SANS compte peut porter des seances (doit PASSER)'
insert into seances (etablissement_id, prof_id, classe_id, jour, debut, fin, salle, matiere) values
 (1, (select id from profils where code = 'eps-new'), 1, 3, '10:00', '12:00', 'Plateau', 'EPS');
select count(*) as seances_du_prof_importe from seances where prof_id = (select id from profils where code = 'eps-new');

\echo '--- 1q. plusieurs fiches SANS email (plusieurs profs pas encore crees) : doit PASSER'
insert into profils (etablissement_id, nom, role, matiere) values (1, 'Prof importe 2', 'enseignant', 'SVT');
insert into profils (etablissement_id, nom, role, matiere) values (1, 'Prof importe 3', 'enseignant', 'Arabe');
select count(*) as fiches_sans_email from profils where email is null;

\echo '--- 1r. lier un compte SANS email : doit ECHOUER (lien incoherent)'
insert into profils (auth_user_id, etablissement_id, nom, role, matiere)
values ('55555555-5555-5555-5555-555555555555', 1, 'Compte orphelin', 'enseignant', 'Info');

-- on remet le jeu de donnees a plat pour le §2
delete from profils where nom in ('Prof importe 2', 'Prof importe 3');


\echo ''
\echo '################ 2. CLOISONNEMENT PAR ROLE (RLS) ################'

\echo '--- 2a. ENSEIGNANT (fr-prof1) : ne voit que SES signalements (attendu 3)'
set role authenticated;
set app.uid = '33333333-3333-3333-3333-333333333333';
select count(*) as vus_par_l_enseignant from signalements;

\echo '--- 2b. ENSEIGNANT : ne voit JAMAIS celui de son collegue de maths (attendu 0)'
select count(*) as signalements_de_maths_vus from signalements where prof_id = (select id from profils where code = 'math-prof1');

\echo '--- 2c. ENSEIGNANT : peut lire ses collegues, les eleves et les tableaux (attendu 7 / 3 / 2)'
select (select count(*) from profils) as profils, (select count(*) from eleves) as eleves, (select count(*) from seances) as seances;

\echo '--- 2d. ENSEIGNANT : ne peut PAS supprimer un eleve (0 ligne touchee, eleves reste a 3)'
delete from eleves where id = 2;
select count(*) as eleves_restants from eleves;

\echo '--- 2e. ENSEIGNANT : ne peut PAS saisir un signalement (doit ECHOUER)'
insert into signalements (etablissement_id, eleve_id, classe_id, prof_id, date_abs, moment, heure, type, statut, signale_par)
values (1, 2, 1, (select id from profils where code = 'fr-prof1'), '2026-09-04', 'matin', '08:05', 'absence', 'absent',
        (select id from profils where code = 'fr-prof1'));

\echo '--- 2f. SURVEILLANT : voit TOUT l etablissement (attendu 4)'
set app.uid = '22222222-2222-2222-2222-222222222222';
select count(*) as vus_par_le_surveillant from signalements;

\echo '--- 2g. SURVEILLANT : peut saisir et approuver (doit PASSER)'
insert into signalements (etablissement_id, eleve_id, classe_id, prof_id, date_abs, moment, heure, type, statut, signale_par)
values (1, 2, 1, (select id from profils where code = 'math-prof1'), '2026-09-05', 'matin', '08:05', 'absence', 'absent',
        mon_profil_id());
update signalements set statut = 'justifie_s', decide_par = mon_profil_id(), decide_le = now()
 where date_abs = '2026-09-05';
select date_abs, statut, (decide_par = mon_profil_id()) as decide_par_le_surveillant
  from signalements where date_abs = '2026-09-05';

\echo '--- 2h. SURVEILLANT : ne peut PAS creer de fermeture (doit ECHOUER)'
insert into fermetures (etablissement_id, type, debut, fin) values (1, 'Vacances', '2026-10-01', '2026-10-07');

\echo '--- 2i. SURVEILLANT : ne peut PAS toucher aux eleves (0 ligne modifiee)'
update eleves set nom = 'Pirate' where id = 2;
select nom as nom_inchange from eleves where id = 2;

\echo '--- 2j. DIRECTEUR : voit tout et peut gerer (attendu 5 signalements / 1 fermeture)'
set app.uid = '11111111-1111-1111-1111-111111111111';
select count(*) as vus_par_le_directeur from signalements;
insert into fermetures (etablissement_id, type, libelle, debut, fin) values (1, 'Vacances', 'Toussaint', '2026-10-01', '2026-10-07');
select count(*) as fermetures from fermetures;

\echo '--- 2k. DIRECTEUR : peut renommer un enseignant (doit PASSER)'
update profils set nom = 'سامية الحاضي (corrigé)' where code = 'fr-prof1';
select code, nom from profils where code = 'fr-prof1';

\echo '--- 2l. DIRECTEUR : ne peut PAS modifier un AUTRE directeur (doit ECHOUER)'
update profils set nom = 'Pirate' where id = (select id from profils where code = 'dir2');
select nom as nom_du_directeur_2_inchange from profils where code = 'dir2';

\echo '--- 2m. DIRECTEUR : peut creer la FICHE d un enseignant importé, sans compte (doit PASSER)'
insert into profils (etablissement_id, code, nom, role, matiere) values (1, 'ang-new', 'Prof anglais', 'enseignant', 'Anglais');
select code, nom, auth_user_id as compte, email from profils where code = 'ang-new';

\echo '--- 2n. DIRECTEUR : ne peut PAS creer une fiche « directeur » (doit ECHOUER)'
insert into profils (etablissement_id, nom, role) values (1, 'Faux directeur', 'directeur');

\echo '--- 2o. DIRECTEUR : peut supprimer une fiche d enseignant, pas celle d un directeur'
delete from profils where code = 'ang-new';
delete from profils where code = 'dir2';
select count(*) as fiches_restantes from profils;

\echo '--- 2p. ENSEIGNANT : tente de se promouvoir DIRECTEUR — doit ECHOUER'
set app.uid = '33333333-3333-3333-3333-333333333333';
update profils set role = 'directeur' where auth_user_id = auth.uid();
select role as role_toujours_enseignant from profils where auth_user_id = auth.uid();

\echo '--- 2q. ENSEIGNANT : tente de changer d etablissement — doit ECHOUER'
update profils set etablissement_id = 999 where auth_user_id = auth.uid();
select etablissement_id as etablissement_inchange from profils where auth_user_id = auth.uid();

\echo '--- 2r. ENSEIGNANT : peut corriger SON propre nom (doit PASSER)'
update profils set nom = 'سامية الحاضي (2)' where auth_user_id = auth.uid();
select nom as nom_corrige from profils where auth_user_id = auth.uid();

\echo '--- 2s. ENSEIGNANT : ne peut PAS renommer un collegue (0 ligne)'
update profils set nom = 'Pirate' where code = 'math-prof1';
select nom as nom_du_collegue_inchange from profils where code = 'math-prof1';

\echo '--- 2t. DIRECTEUR : absences du personnel + annulation de seance (doit PASSER)'
set app.uid = '11111111-1111-1111-1111-111111111111';
insert into absences_personnel (etablissement_id, prof_id, role_absent, debut, fin, portee, motif, cree_par)
values (1, (select id from profils where code = 'fr-prof1'), 'enseignant', '2026-09-08', '2026-09-08', 'journee', 'Maladie', mon_profil_id());
insert into annulations_seances (etablissement_id, date_seance, classe_id, debut, fin, motif, cree_par)
values (1, '2026-09-14', 1, '08:00', '10:00', 'Réunion', mon_profil_id());
select (select count(*) from absences_personnel) as absences_personnel, (select count(*) from annulations_seances) as annulations;

\echo '--- 2u. SANS CONNEXION (anon) : ne voit RIEN (attendu 0)'
reset role;
set role anon;
select count(*) as vus_sans_connexion from signalements;

\echo ''
\echo '################ 3. VUE STATISTIQUES ################'
reset role;
set role authenticated;
set app.uid = '11111111-1111-1111-1111-111111111111';
select eleve, classe, non_justifiees, retards, justifiees from v_compteurs_eleves order by eleve;

reset role;
\echo '################ FIN DES VERIFICATIONS ################'
