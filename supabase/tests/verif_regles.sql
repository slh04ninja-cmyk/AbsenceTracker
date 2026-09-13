-- ============================================================================
-- Vérification des RÈGLES MÉTIER (migration 0002) sur PostgreSQL réel.
--
-- Convention : chaque cas s'annonce par « \echo --- Na. libellé » (psql affiche
-- le libellé, le rapport s'y accroche).
--   * un cas qui doit ÊTRE REFUSÉ produit une erreur  -> listé dans ATTENDUS-ECHEC
--   * un cas de CALCUL ne doit produire AUCUNE erreur (sinon une assertion a levé)
-- ATTENDUS-ECHEC: 2b
-- ============================================================================
\set ON_ERROR_STOP off

-- ---------- jeu de données ----------
-- Lundi 2026-09-07 (jour 1), mardi 2026-09-08 (jour 2)
insert into etablissements (id, code, nom) overriding system value values (1, 'X', 'Test');
insert into classes (id, etablissement_id, nom) overriding system value values (1, 1, 'TCSF-1');
insert into profils (id, etablissement_id, email, code, nom, role, matiere) overriding system value values
 (10, 1, 'd@taalim.ma',      'dir',   'Directeur',     'directeur',  null),
 (11, 1, 's1@taalim.ma',     null,    'Surveillant 1', 'surveillant',null),
 (12, 1, 'math-prof1@taalim.ma', 'math-prof1', 'Prof Maths',   'enseignant', 'Maths'),
 (13, 1, 'fr-prof1@taalim.ma',   'fr-prof1',   'Prof Français','enseignant', 'Français');
insert into eleves (id, classe_id, code_massar, nom, prenom, actif) overriding system value values
 (1, 1, 'M001', 'El Amrani', 'Mehdi',  true),
 (2, 1, 'M002', 'Berrada',   'Imane',  true),
 (3, 1, 'M003', 'Ouazzani',  'Karim',  false);      -- élève sorti : hors effectif
-- tableau de service : prof maths -> lundi 08h et lundi 14h ; prof français -> mardi 08h
insert into seances (id, etablissement_id, prof_id, classe_id, jour, debut, fin, matiere) overriding system value values
 (1, 1, 12, 1, 1, '08:00', '09:00', 'MATH'),
 (2, 1, 12, 1, 1, '14:00', '15:00', 'MATH'),
 (3, 1, 13, 1, 2, '08:00', '09:00', 'FR');

-- ---------------------------------------------------------------------------
-- R1 : la règle des 30 minutes
-- ---------------------------------------------------------------------------
\echo --- 1a. un retard de 20 min reste un retard
do $$ begin
  if type_effectif('retard', 20) <> 'retard' then
    raise exception 'attendu retard, obtenu %', type_effectif('retard', 20);
  end if;
end $$;

\echo --- 1b. un retard de 31 min devient une absence
do $$ begin
  if type_effectif('retard', 31) <> 'absence' then
    raise exception 'attendu absence, obtenu %', type_effectif('retard', 31);
  end if;
end $$;

\echo --- 1c. 30 minutes pile reste un retard (la règle est « plus de 30 »)
do $$ begin
  if type_effectif('retard', 30) <> 'retard' then
    raise exception 'attendu retard, obtenu %', type_effectif('retard', 30);
  end if;
end $$;

\echo --- 1d. une absence saisie reste une absence
do $$ begin
  if type_effectif('absence', null) <> 'absence' then
    raise exception 'attendu absence';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- R2 : plusieurs non justifiés sont ACCEPTÉS (règle de travail de l'app, pas un
--      invariant de données : il faut pouvoir importer un historique)
-- ---------------------------------------------------------------------------
-- (pas d'id force : on laisse la sequence identity attribuer, sinon la suite entre en collision)
insert into signalements (etablissement_id, eleve_id, classe_id, prof_id,
                          date_abs, moment, heure, type, retard_minutes, statut, signale_par)
  values (1, 1, 1, 12, '2026-09-07', 'matin', '08:05', 'absence', null, 'absent', 12);

\echo --- 2a. un 2e non justifié pour le MEME élève, un AUTRE jour : accepté (import possible)
insert into signalements (etablissement_id, eleve_id, classe_id, prof_id,
                          date_abs, moment, heure, type, retard_minutes, statut, signale_par)
  values (1, 1, 1, 12, '2026-09-08', 'matin', '08:05', 'absence', null, 'absent', 12);

\echo --- 2b. un 2e signalement le MEME jour et la MEME demi-journée : refusé
insert into signalements (etablissement_id, eleve_id, classe_id, prof_id,
                          date_abs, moment, heure, type, retard_minutes, statut, signale_par)
  values (1, 1, 1, 12, '2026-09-07', 'matin', '09:30', 'retard', 10, 'absent', 12);

\echo --- 2c. le MEME jour, mais sur l AUTRE demi-journee : accepte
insert into signalements (etablissement_id, eleve_id, classe_id, prof_id,
                          date_abs, moment, heure, type, retard_minutes, statut, motif,
                          decide_par, decide_le, signale_par)
  values (1, 1, 1, 12, '2026-09-07', 'apres-midi', '14:05', 'absence', null, 'justifie_s', 'Maladie',
          11, now(), 12);

\echo --- 2d. un autre élève a son propre non justifié
insert into signalements (etablissement_id, eleve_id, classe_id, prof_id,
                          date_abs, moment, heure, type, retard_minutes, statut, signale_par)
  values (1, 2, 1, 12, '2026-09-07', 'matin', '08:05', 'retard', 15, 'absent', 12);

-- ---------------------------------------------------------------------------
-- R3 : les séances annulées, 2 sources sans doublon (la saisie prime)
-- ---------------------------------------------------------------------------
-- annulation saisie à la main : lundi 08h
insert into annulations_seances (etablissement_id, date_seance, classe_id, debut, fin, motif)
  values (1, '2026-09-07', 1, '08:00', '09:00', 'Séance non assurée');
-- absence du prof de maths : toute la journée du lundi
insert into absences_personnel (id, etablissement_id, prof_id, role_absent, debut, fin, portee, motif)
  overriding system value values (1, 1, 12, 'enseignant', '2026-09-07', '2026-09-07', 'journee', 'Maladie');

\echo --- 3a. les 2 séances du lundi sont annulées (une par saisie, une par absence du prof)
do $$ declare n int; begin
  select count(*) into n from v_seances_annulees where classe_id = 1 and date_seance = '2026-09-07';
  if n <> 2 then raise exception 'attendu 2 séances annulées le lundi, obtenu %', n; end if;
end $$;

\echo --- 3b. la séance saisie à la main garde sa source (« saisie » prime, pas de doublon)
do $$ declare s text; begin
  select source into s from v_seances_annulees
   where classe_id = 1 and date_seance = '2026-09-07' and debut = '08:00';
  if s <> 'saisie' then raise exception 'attendu source saisie, obtenu %', s; end if;
end $$;

\echo --- 3c. la 2e seance du lundi vient bien de l absence du professeur
do $$ declare s text; begin
  select source into s from v_seances_annulees
   where classe_id = 1 and date_seance = '2026-09-07' and debut = '14:00';
  if s <> 'absence_prof' then raise exception 'attendu absence_prof, obtenu %', s; end if;
end $$;

\echo --- 3d. la seance du mardi (autre prof) reste intacte
do $$ declare n int; begin
  select count(*) into n from v_seances_annulees where classe_id = 1 and date_seance = '2026-09-08';
  if n <> 0 then raise exception 'attendu 0 annulation le mardi, obtenu %', n; end if;
end $$;

\echo --- 3e. une absence de prof limitee au MATIN n annule que les seances du matin
insert into absences_personnel (id, etablissement_id, prof_id, role_absent, debut, fin, portee, motif)
  overriding system value values (2, 1, 12, 'enseignant', '2026-09-14', '2026-09-14', 'matin', 'Formation');
do $$ declare n int; begin
  select count(*) into n from v_seances_annulees
   where classe_id = 1 and date_seance = '2026-09-14' and debut >= time '12:00';
  if n <> 0 then raise exception 'la séance de l''après-midi ne devait pas être annulée (% trouvée)', n; end if;
end $$;

-- ---------------------------------------------------------------------------
-- R4 : les séances dues (dénominateur du taux de présence)
-- ---------------------------------------------------------------------------
\echo --- 4a. semaine du 14/09 : matin annule, apres-midi du (+ le mardi)
do $$ declare n int; begin
  select count(*) into n from seances_dues(1, '2026-09-14', '2026-09-15');
  if n <> 2 then raise exception 'attendu 2 séances dues, obtenu %', n; end if;
end $$;

\echo --- 4b. la fermeture annule toutes les seances de la periode
insert into fermetures (etablissement_id, type, libelle, debut, fin, portee)
  values (1, 'Vacances', 'Test', '2026-09-21', '2026-09-22', 'journee');
do $$ declare n int; begin
  select count(*) into n from seances_dues(1, '2026-09-21', '2026-09-22');
  if n <> 0 then raise exception 'attendu 0 séance due pendant la fermeture, obtenu %', n; end if;
end $$;

\echo --- 4c. une fermeture du MATIN laisse la seance de l apres-midi due
insert into fermetures (etablissement_id, type, libelle, debut, fin, portee)
  values (1, 'Réunion', 'Matin', '2026-09-28', '2026-09-28', 'matin');
do $$ declare n int; begin
  select count(*) into n from seances_dues(1, '2026-09-28', '2026-09-28');
  if n <> 1 then raise exception 'attendu 1 séance due (l''après-midi), obtenu %', n; end if;
end $$;

-- ---------------------------------------------------------------------------
-- R5 et totaux : ce qui compte vraiment dans les statistiques
-- ---------------------------------------------------------------------------
\echo --- 5a. une absence signalée pendant une fermeture ne compte pas
insert into signalements (etablissement_id, eleve_id, classe_id, prof_id,
                          date_abs, moment, heure, type, retard_minutes, statut,
                          decide_par, decide_le, signale_par)
  values (1, 2, 1, 12, '2026-09-21', 'matin', '08:05', 'absence', null, 'justifie_d',
          10, now(), 12);
do $$ declare n int; begin
  select count(*) into n from absences_comptees(1, '2026-09-21', '2026-09-22');
  if n <> 0 then raise exception 'l''absence en fermeture ne devait pas compter (% trouvée)', n; end if;
end $$;

\echo --- 5b. les totaux de l eleve appliquent la regle des 30 minutes
insert into signalements (etablissement_id, eleve_id, classe_id, prof_id,
                          date_abs, moment, heure, type, retard_minutes, statut, signale_par)
  values (1, 2, 1, 12, '2026-09-15', 'matin', '08:05', 'retard', 45, 'absent', 12);
do $$ declare t record; begin
  select * into t from totaux_eleve(2);
  -- élève 2 : retard 15 min (07/09, non justifié) + absence justifiée (21/09)
  --           + retard 45 min (15/09, non justifié) qui compte comme une ABSENCE
  if t.absences <> 2 then raise exception 'attendu 2 absences, obtenu %', t.absences; end if;
  if t.retards <> 1 then raise exception 'attendu 1 retard, obtenu %', t.retards; end if;
  if t.non_justifies <> 2 then raise exception 'attendu 2 non justifiés, obtenu %', t.non_justifies; end if;
  if t.justifies <> 1 then raise exception 'attendu 1 justifié, obtenu %', t.justifies; end if;
end $$;

\echo --- 5c. le taux de présence prend les séances DUES comme dénominateur
do $$ declare r record; begin
  -- mardi 08/09 : 1 séance due (08h-09h), effectif actif 2 -> 2 places
  -- 1 absence ce jour-là (celle de l'élève 1, le matin) -> (2-1)/2 = 50 %
  select * into r from taux_presence(1, '2026-09-08', '2026-09-08');
  if r.effectif <> 2 then raise exception 'effectif attendu 2, obtenu %', r.effectif; end if;
  if r.seances_dues <> 1 then raise exception 'séances dues attendues 1, obtenu %', r.seances_dues; end if;
  if r.places <> 2 then raise exception 'places attendues 2, obtenu %', r.places; end if;
  if r.absences <> 1 then raise exception 'absences attendues 1, obtenu %', r.absences; end if;
  if r.taux <> 50 then raise exception 'taux attendu 50 %%, obtenu %', r.taux; end if;
  if r.detail is null or r.detail = '' then raise exception 'le détail auditable est vide'; end if;
end $$;

\echo --- 5d. le taux de l etablissement agrege les classes
do $$ declare r record; begin
  select * into r from taux_presence_etablissement('2026-09-08', '2026-09-08');
  if r.effectif <> 2 or r.seances_dues <> 1 or r.places <> 2 or r.taux <> 50 then
    raise exception 'agrégat inattendu : % élèves / % séances / % places / % %%',
      r.effectif, r.seances_dues, r.places, r.taux;
  end if;
end $$;

\echo --- 5e. les eleves « sortis » sont exclus de l effectif, sans signalement
do $$ declare n int; begin
  select count(*) into n from v_eleves_actifs where classe_id = 1;
  if n <> 2 then raise exception 'attendu 2 élèves actifs, obtenu %', n; end if;
  select count(*) into n from v_signalements where classe_id = 1 and eleve_id = 3;
  if n <> 0 then raise exception 'aucun signalement attendu pour l''élève sorti'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Cloisonnement : les vues ne doivent PAS contourner la RLS
-- ---------------------------------------------------------------------------
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

\echo --- 6a. un compte inconnu ne voit AUCUN signalement à travers la vue
set role authenticated;
set app.uid = '00000000-0000-0000-0000-0000000000ff';
do $$ declare n int; begin
  select count(*) into n from v_signalements;
  if n <> 0 then raise exception 'un compte inconnu a vu % signalement(s)', n; end if;
end $$;
reset role;

\echo --- 6b. le surveillant de l etablissement voit les signalements
insert into auth.users (id, email) values ('22222222-2222-2222-2222-222222222222', 's1@taalim.ma')
  on conflict do nothing;
update profils set auth_user_id = '22222222-2222-2222-2222-222222222222' where id = 11;
set role authenticated;
set app.uid = '22222222-2222-2222-2222-222222222222';
do $$ declare n int; begin
  select count(*) into n from v_signalements;
  if n < 1 then raise exception 'le surveillant ne voit rien (% signalement)', n; end if;
end $$;
reset role;
