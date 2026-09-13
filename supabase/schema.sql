-- ============================================================================
-- AbsenceTrack — schéma de base de données (Supabase / PostgreSQL)
-- Version : 1.0  —  à valider avant exécution
-- ----------------------------------------------------------------------------
-- PRINCIPE : l'application EXIGE la connexion. Les données vivent uniquement
-- ici, jamais sur le téléphone. Conséquence : aucun risque de doublon entre
-- deux appareils, aucune synchronisation à gérer.
--
-- COMMENT APPLIQUER (quand tu auras validé) :
--   1. Créer le projet sur supabase.com (région Europe — la plus proche)
--   2. SQL Editor → coller TOUT ce fichier → Run
--   3. Authentication → Users → créer les 13 comptes (email + mot de passe)
--      puis insérer les lignes correspondantes dans public.profils (voir §9)
--   4. Settings → API → récupérer l'URL du projet et la clé "anon"
--      (clé PUBLIQUE uniquement — la clé "service_role" ne doit JAMAIS
--       entrer dans l'application)
--
-- SÉCURITÉ : tout est cloisonné par rôle côté serveur (RLS §8). Même si
-- quelqu'un extrait la clé publique de l'APK, il ne peut lire que ce que son
-- rôle autorise.
-- ============================================================================


-- ============================================================================
-- 1. TYPES ÉNUMÉRÉS (le métier, tel qu'il est déjà dans l'application)
-- ============================================================================

create type role_profil      as enum ('enseignant', 'surveillant', 'directeur');
create type type_signalement as enum ('absence', 'retard');
create type statut_signal    as enum ('absent',            -- non justifié
                                      'justifie_s',        -- justifié par un surveillant
                                      'justifie_d');       -- justifié par le directeur
create type moment_journee   as enum ('matin', 'apres-midi');
create type portee_periode   as enum ('journee', 'matin', 'apres-midi');


-- ============================================================================
-- 2. ÉTABLISSEMENT & ANNÉE SCOLAIRE
--    (une seule ligne pour l'instant — le champ existe pour rester extensible
--     si un jour plusieurs établissements arrivent)
-- ============================================================================

create table etablissements (
  id              bigint generated always as identity primary key,
  code            text not null unique,              -- code MASSAR de l'établissement
  nom             text not null,
  academie        text not null default '',
  direction       text not null default '',
  annee_libelle   text not null default '2026-2027',
  semestres       jsonb not null default '[]'::jsonb,-- [{nom:'1',debut:'2026-09-01',fin:'2027-01-15'}, ...]
  cree_le         timestamptz not null default now(),

  constraint etablissements_code_non_vide check (length(btrim(code)) > 0)
);


-- ============================================================================
-- 3. PROFILS (les 13 comptes : 11 enseignants, 2 surveillants, 1 directeur)
--    id = l'identifiant du compte de connexion (auth.users.id)
--    Le mot de passe vit dans auth.users, haché — PLUS RIEN en clair.
-- ============================================================================

-- IMPORTANT — la fiche (la personne) est SÉPARÉE du compte de connexion.
-- Le directeur importe ses tableaux de service AVANT de créer les comptes : un
-- enseignant doit donc pouvoir exister sans identifiants. Sa fiche naît de
-- l'import (nom lu dans le fichier, email inconnu) ; le lien vers son compte
-- (auth_user_id, email) est établi plus tard, par la fonction serveur qui
-- crée le compte. C'est ce qui permet le vrai parcours d'installation.
create table profils (
  id                bigint generated always as identity primary key,
  auth_user_id      uuid unique references auth.users(id) on delete set null,  -- NULL = fiche sans compte
  etablissement_id  bigint not null references etablissements(id) on delete restrict,
  email             text,                    -- rempli le jour où le compte est créé
  code              text,                    -- 'math-prof1' — identifiant métier
  nom               text not null,           -- nom affiché, lu dans les fichiers importés
  role              role_profil not null,
  matiere           text,                    -- déduite du tableau de service importé
  actif             boolean not null default true,
  cree_le           timestamptz not null default now(),

  constraint profils_code_unique       unique (etablissement_id, code),
  constraint profils_matiere_ens_seul  check (role = 'enseignant' or matiere is null),
  constraint profils_nom_non_vide      check (length(btrim(nom)) > 0),
  constraint profils_lien_coherent     check (auth_user_id is null or email is not null)
);

-- l'email doit rester unique, mais plusieurs fiches peuvent n'avoir aucun email
create unique index profils_email_unique on profils (lower(email)) where email is not null;
create index profils_etab_role_idx on profils (etablissement_id, role);
create index profils_auth_idx      on profils (auth_user_id) where auth_user_id is not null;


-- ============================================================================
-- 4. CLASSES & ÉLÈVES
-- ============================================================================

create table classes (
  id                bigint generated always as identity primary key,
  etablissement_id  bigint not null references etablissements(id) on delete cascade,
  nom               text not null,           -- 'TCSF-1', 'TCSF-2', 'TCSF-3'
  cree_le           timestamptz not null default now(),

  constraint classes_nom_unique unique (etablissement_id, nom)
);

create table eleves (
  id                bigint generated always as identity primary key,
  classe_id         bigint not null references classes(id) on delete cascade,
  code_massar       text,                    -- colonne C du fichier MASSAR
  nom               text not null,           -- nom de famille
  prenom            text not null,
  actif             boolean not null default true,
  cree_le           timestamptz not null default now(),

  -- le même code élève ne peut pas apparaître deux fois dans une classe
  constraint eleves_massar_unique unique (classe_id, code_massar)
);

create index eleves_classe_idx on eleves (classe_id) where actif;


-- ============================================================================
-- 5. TABLEAUX DE SERVICE (les séances hebdomadaires de chaque enseignant)
--    jour : 1 = lundi … 6 = samedi (aucune séance le dimanche)
-- ============================================================================

create table seances (
  id                bigint generated always as identity primary key,
  etablissement_id  bigint not null references etablissements(id) on delete cascade,
  prof_id           bigint not null references profils(id)   on delete cascade,
  classe_id         bigint not null references classes(id)   on delete cascade,
  jour              smallint not null,
  debut             time not null,
  fin               time not null,
  salle             text,
  matiere           text,
  cree_le           timestamptz not null default now(),

  constraint seances_jour_valide   check (jour between 1 and 6),
  constraint seances_horaires_valides check (fin > debut),
  -- un enseignant ne peut pas avoir deux fois le même créneau dans la même classe
  constraint seances_unique unique (prof_id, classe_id, jour, debut)
);

create index seances_prof_idx   on seances (prof_id, jour);
create index seances_classe_idx on seances (classe_id, jour);


-- ============================================================================
-- 6. SIGNALEMENTS (le cœur : les Ab / Rd)
--    RÈGLE MÉTIER SERVEUR : un élève ne peut avoir qu'UN SEUL signalement
--    pour une même journée et une même demi-journée — c'est exactement la
--    vérification que fait déjà l'application (même élève + même jour +
--    même séance = refusé). La contrainte empêche deux téléphones de créer
--    le même signalement.
--    NB : la règle « retard > 30 min devient une absence » est appliquée par
--    l'application ; le champ type reste la trace de la saisie d'origine.
-- ============================================================================

create table signalements (
  id                bigint generated always as identity primary key,
  etablissement_id  bigint not null references etablissements(id) on delete cascade,
  eleve_id          bigint not null references eleves(id)   on delete cascade,
  classe_id         bigint not null references classes(id)  on delete cascade,
  prof_id           bigint not null references profils(id)  on delete restrict,  -- enseignant concerné
  date_abs          date   not null,
  moment            moment_journee not null,
  heure             time   not null,          -- heure du signalement
  type              type_signalement not null,
  retard_minutes    integer,                  -- uniquement pour un retard
  statut            statut_signal not null default 'absent',
  motif             text,                     -- Maladie, Raison familiale, …
  decide_par        bigint references profils(id) on delete set null,  -- qui a approuvé
  decide_le         timestamptz,
  signale_par       bigint references profils(id) on delete set null,  -- qui a saisi
  cree_le           timestamptz not null default now(),
  maj_le            timestamptz not null default now(),

  -- LA règle métier, garantie par la base
  constraint signalements_unique_par_demi_journee unique (eleve_id, date_abs, moment),
  constraint signalements_retard_minutes check (
    (type = 'retard'  and retard_minutes is not null and retard_minutes > 0) or
    (type = 'absence' and retard_minutes is null)
  ),
  constraint signalements_decision_coherente check (
    (statut = 'absent'     and decide_par is null and decide_le is null) or
    (statut <> 'absent'    and decide_par is not null and decide_le is not null)
  )
);

create index signalements_jour_idx    on signalements (etablissement_id, date_abs desc);
create index signalements_eleve_idx   on signalements (eleve_id, date_abs desc);
create index signalements_prof_idx    on signalements (prof_id, date_abs desc);
create index signalements_absent_idx  on signalements (etablissement_id) where statut = 'absent';


-- ============================================================================
-- 7. FERMETURES, ABSENCES DU PERSONNEL, SÉANCES ANNULÉES
-- ============================================================================

-- Fermeture de l'établissement (vacances, fêtes, examens, réunion, travaux…)
create table fermetures (
  id                bigint generated always as identity primary key,
  etablissement_id  bigint not null references etablissements(id) on delete cascade,
  type              text not null,   -- Vacances | Fête religieuse | Fête nationale | Examens | Réunion | Travaux | Autre
  libelle           text,
  debut             date not null,
  fin               date not null,
  portee            portee_periode not null default 'journee',
  cree_par          bigint references profils(id) on delete set null,
  cree_le           timestamptz not null default now(),

  constraint fermetures_dates_valides check (fin >= debut)
);

-- Absence d'un membre du personnel (surveillant ou enseignant)
-- Pour un ENSEIGNANT : toutes ses séances de la période sont annulées
-- (l'application les déduit de son tableau de service).
create table absences_personnel (
  id                bigint generated always as identity primary key,
  etablissement_id  bigint not null references etablissements(id) on delete cascade,
  prof_id           bigint not null references profils(id) on delete cascade,
  role_absent       role_profil not null,    -- surveillant | enseignant
  debut             date not null,
  fin               date not null,
  portee            portee_periode not null default 'journee',
  motif             text,
  cree_par          bigint references profils(id) on delete set null,
  cree_le           timestamptz not null default now(),

  constraint absences_perso_dates_valides check (fin >= debut)
);

-- Annulation d'UNE séance précise (saisie manuelle, avec possibilité de rétablir)
create table annulations_seances (
  id                bigint generated always as identity primary key,
  etablissement_id  bigint not null references etablissements(id) on delete cascade,
  date_seance       date not null,
  classe_id         bigint not null references classes(id) on delete cascade,
  debut             time not null,
  fin               time,
  motif             text,
  cree_par          bigint references profils(id) on delete set null,
  cree_le           timestamptz not null default now(),

  -- on ne peut pas annuler deux fois la même séance
  constraint annulations_unique unique (classe_id, date_seance, debut)
);

create index fermetures_periode_idx   on fermetures (etablissement_id, debut, fin);
create index absences_perso_idx       on absences_personnel (prof_id, debut, fin);
create index annulations_date_idx     on annulations_seances (etablissement_id, date_seance);


-- ============================================================================
-- 8. SÉCURITÉ — CLOISONNEMENT PAR RÔLE (RLS)
--    Sans ça, la clé publique de l'application donnerait accès à tout.
-- ============================================================================

-- Qui suis-je ? (fonctions « security definer » : elles lisent profils sans
-- être bloquées par la RLS de profils elle-même)
create or replace function moi_role() returns role_profil
language sql stable security definer set search_path = public as $$
  select role from profils where auth_user_id = auth.uid()
$$;

create or replace function mon_etablissement() returns bigint
language sql stable security definer set search_path = public as $$
  select etablissement_id from profils where auth_user_id = auth.uid()
$$;

-- L'identifiant de PROFIL de la personne connectée (celui qui est stocké dans
-- les signalements) : distinct de l'identifiant de compte.
create or replace function mon_profil_id() returns bigint
language sql stable security definer set search_path = public as $$
  select id from profils where auth_user_id = auth.uid()
$$;

create or replace function est_directeur() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role from profils where auth_user_id = auth.uid()) = 'directeur', false)
$$;

create or replace function est_surv_ou_dir() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role from profils where auth_user_id = auth.uid())
                  in ('surveillant', 'directeur'), false)
$$;

create or replace function meme_etab(e bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select etablissement_id from profils where auth_user_id = auth.uid()) = e, false)
$$;

-- Horodatage automatique de la dernière modification
create or replace function maj_horodatage() returns trigger
language plpgsql as $$
begin
  new.maj_le := now();
  return new;
end $$;

create trigger signalements_maj_le before update on signalements
  for each row execute function maj_horodatage();


alter table etablissements     enable row level security;
alter table profils            enable row level security;
alter table classes            enable row level security;
alter table eleves             enable row level security;
alter table seances            enable row level security;
alter table signalements       enable row level security;
alter table fermetures         enable row level security;
alter table absences_personnel enable row level security;
alter table annulations_seances enable row level security;

-- ---- Établissement : tout le monde le lit, le directeur le modifie --------
create policy etab_lecture on etablissements for select to authenticated
  using (meme_etab(id));
create policy etab_modif on etablissements for update to authenticated
  using (est_directeur() and meme_etab(id)) with check (meme_etab(id));

-- ---- Profils : collègues visibles, modification par le directeur ----------
create policy profils_lecture on profils for select to authenticated
  using (meme_etab(etablissement_id));
create policy profils_modif_soi on profils for update to authenticated
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());
create policy profils_modif_dir on profils for update to authenticated
  using (est_directeur() and meme_etab(etablissement_id))
  with check (est_directeur() and role <> 'directeur');
-- Création / suppression de FICHES par le directeur : c'est ce que fait l'import
-- des tableaux de service, qui découvre des enseignants encore sans compte.
-- auth_user_id est forcé à NULL : le lien vers un compte ne se fait PAS depuis
-- l'application (c'est la fonction serveur qui le pose, avec la clé service).
create policy profils_creation on profils for insert to authenticated
  with check (est_directeur() and meme_etab(etablissement_id)
              and role <> 'directeur' and auth_user_id is null);
create policy profils_suppression on profils for delete to authenticated
  using (est_directeur() and meme_etab(etablissement_id) and role <> 'directeur');

-- VERROU DE COLONNE — indispensable : la RLS autorise la ligne, pas la colonne.
-- Sans ce qui suit, un enseignant inscrit dans « profils_modif_soi » pourrait
-- modifier SA ligne… et donc s'attribuer le rôle « directeur ». On limite donc
-- la modification à la SEULE colonne « nom » (le renommage fait par le directeur,
-- et la correction de son propre nom). Tout le reste — rôle, matière, actif,
-- établissement — devient impossible à changer depuis l'application.
revoke update on profils from authenticated;
grant  update (nom) on profils to authenticated;

-- ---- Classes, élèves, séances : lecture pour tous, écriture au directeur --
create policy classes_lecture on classes for select to authenticated
  using (meme_etab(etablissement_id));
create policy classes_ecriture on classes for all to authenticated
  using (est_directeur() and meme_etab(etablissement_id))
  with check (est_directeur() and meme_etab(etablissement_id));

create policy eleves_lecture on eleves for select to authenticated
  using (exists (select 1 from classes c where c.id = classe_id and meme_etab(c.etablissement_id)));
create policy eleves_ecriture on eleves for all to authenticated
  using (est_directeur() and exists (select 1 from classes c where c.id = classe_id and meme_etab(c.etablissement_id)))
  with check (est_directeur() and exists (select 1 from classes c where c.id = classe_id and meme_etab(c.etablissement_id)));

create policy seances_lecture on seances for select to authenticated
  using (meme_etab(etablissement_id));
create policy seances_ecriture on seances for all to authenticated
  using (est_directeur() and meme_etab(etablissement_id))
  with check (est_directeur() and meme_etab(etablissement_id));

-- ---- Signalements --------------------------------------------------------
-- LECTURE : l'enseignant ne voit QUE ses signalements ; surveillant et
-- directeur voient tout l'établissement.
create policy signalements_lecture on signalements for select to authenticated
  using (
    meme_etab(etablissement_id) and (
      est_surv_ou_dir() or prof_id = mon_profil_id()
    )
  );
-- ÉCRITURE : la saisie et la décision (approbation) sont du ressort du
-- surveillant et du directeur — c'est ce que fait déjà l'application.
create policy signalements_creation on signalements for insert to authenticated
  with check (est_surv_ou_dir() and meme_etab(etablissement_id) and signale_par = mon_profil_id());
create policy signalements_modif on signalements for update to authenticated
  using (est_surv_ou_dir() and meme_etab(etablissement_id))
  with check (est_surv_ou_dir() and meme_etab(etablissement_id));
create policy signalements_suppression on signalements for delete to authenticated
  using (est_surv_ou_dir() and meme_etab(etablissement_id));

-- ---- Fermetures, absences du personnel, annulations : directeur seul ------
create policy fermetures_lecture on fermetures for select to authenticated
  using (meme_etab(etablissement_id));
create policy fermetures_ecriture on fermetures for all to authenticated
  using (est_directeur() and meme_etab(etablissement_id))
  with check (est_directeur() and meme_etab(etablissement_id));

create policy absences_perso_lecture on absences_personnel for select to authenticated
  using (meme_etab(etablissement_id));
create policy absences_perso_ecriture on absences_personnel for all to authenticated
  using (est_directeur() and meme_etab(etablissement_id))
  with check (est_directeur() and meme_etab(etablissement_id));

create policy annulations_lecture on annulations_seances for select to authenticated
  using (meme_etab(etablissement_id));
create policy annulations_ecriture on annulations_seances for all to authenticated
  using (est_directeur() and meme_etab(etablissement_id))
  with check (est_directeur() and meme_etab(etablissement_id));


-- ============================================================================
-- 9. AMORÇAGE (à exécuter APRÈS avoir créé le compte du directeur)
--    AUCUNE donnée d'établissement n'est pré-remplie : classes, élèves, séances
--    et comptes enseignants viennent des FICHIERS IMPORTÉS par le directeur
--    après l'installation (listes MASSAR + tableaux de service + tableaux
--    d'élèves). Le directeur refera lui-même ses réels imports : les données du
--    prototype (TCSF-1/2/3, 36 élèves, 11 profs) sont des données de TEST et
--    ne doivent PAS être reprises.
-- ============================================================================
/*

-- 1) Le compte du directeur est créé dans Authentication → Users.
--    On lui donne sa fiche, et on crée l'établissement (il le complétera dans
--    l'application via « Informations de l'établissement »).
insert into etablissements (code, nom) values ('<code MASSAR>', '<nom de l établissement>');

insert into profils (auth_user_id, etablissement_id, email, nom, role)
values ('<uuid du compte directeur>', 1, 'd@taalim.ma', '<nom du directeur>', 'directeur');

-- 2) C'est tout. Ensuite, TOUT se fait dans l'application :
--    • Gestion → Importation des fichiers → Importer les listes MASSAR (xlsx)
--      → crée les classes et les élèves
--    • Importer les tableaux de services (xlsx ou FET)
--      → crée les fiches des enseignants + leurs séances
--    • Importer les tableaux d'élèves (xlsx ou FET) → complète les classes
--    • RH → Enseignants → créer le compte de chaque enseignant (email + mot de
--      passe) : la fonction serveur relie alors sa fiche à son compte.

-- Pourquoi aucune fiche d'enseignant n'est créée ici : un tableau de service
-- importé peut citer un enseignant qui n'a pas encore de compte. C'est prévu :
-- sa fiche existe sans identifiants, et le lien se fait à la création du compte.
*/

-- ============================================================================
-- 10. VUES DE LECTURE (pour les écrans Statistiques)
-- ============================================================================

-- Compteurs par élève — sert au seuil d'alerte (≥ 4 absences non justifiées)
create or replace view v_compteurs_eleves
with (security_invoker = true) as
select
  s.etablissement_id,
  s.eleve_id,
  e.nom || ' ' || e.prenom              as eleve,
  c.nom                                 as classe,
  count(*) filter (where s.statut = 'absent')                        as non_justifiees,
  count(*) filter (where s.type   = 'retard')                        as retards,
  count(*) filter (where s.statut <> 'absent')                       as justifiees,
  max(s.date_abs)                                                    as dernier_le
from signalements s
join eleves  e on e.id = s.eleve_id
join classes c on c.id = s.classe_id
group by s.etablissement_id, s.eleve_id, e.nom, e.prenom, c.nom;


-- ============================================================================
-- 11. RÉINITIALISATION D'UN MOT DE PASSE (à mettre en place plus tard)
--     Le mot de passe vit dans auth.users : l'application ne peut PAS y toucher
--     directement (c'est le but). Le bouton « définir un mot de passe » du
--     directeur passera donc par une petite fonction serveur (Edge Function)
--     qui utilise la clé « service_role » — clé qui ne quitte JAMAIS le serveur.
--     En attendant, le directeur réinitialise depuis Supabase :
--     Authentication → Users → choisir le compte → Reset password.
-- ============================================================================


-- ============================================================================
-- FIN — le schéma est prêt à être relu. Rien n'a été exécuté.
-- ============================================================================
