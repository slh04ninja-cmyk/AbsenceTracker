-- ============================================================================
-- AbsenceTrack — migration 0002 : LES RÈGLES MÉTIER, DANS LA BASE
--
-- Ces règles n'étaient appliquées que par l'application. Les écrire ici fait
-- qu'elles sont garanties pour TOUS les clients (l'app mobile aujourd'hui, le
-- bureau d'administration ensuite) : impossible qu'ils divergent, et impossible
-- de les contourner depuis un téléphone.
--
--   R1. un retard de plus de 30 minutes compte comme une ABSENCE
--   R2. un élève ne peut avoir qu'UN SEUL signalement non justifié
--       (dès qu'il est justifié, la place se libère)
--   R3. les séances annulées viennent de 2 sources, sans doublon
--       (la saisie directe prime sur l'absence du professeur)
--   R4. les séances DUES (dénominateur du taux de présence) excluent les
--       fermetures, les annulations et les absences des professeurs
--   R5. un signalement tombant pendant une fermeture ne compte pas dans les
--       statistiques  (même règle que le texte affiché dans le formulaire)
--
-- La règle « un seul signalement par élève et par demi-journée » est déjà une
-- contrainte de la table signalements (migration 0001) : rien à ajouter.
--
-- ⚠️ Les vues sont créées en `security_invoker = true` : sans cela, une vue
-- s'exécuterait avec les droits de son propriétaire et contournerait la RLS
-- (cloisonnement par rôle de la migration 0001).
-- ============================================================================


-- ---------------------------------------------------------------------------
-- R1 — le type EFFECTIF d'un signalement (règle des 30 minutes)
-- ---------------------------------------------------------------------------
create or replace function type_effectif(p_type type_signalement, p_retard_minutes integer)
returns type_signalement
language sql immutable
as $$
  select case
           when p_type = 'retard' and coalesce(p_retard_minutes, 0) > 30
             then 'absence'::type_signalement
           else p_type
         end
$$;

comment on function type_effectif(type_signalement, integer) is
  'R1 : un retard de plus de 30 minutes compte comme une absence.'
  ' ATTENTION au sens de retard_minutes : ce n''est PAS la duree du retard de l''eleve,'
  ' mais le temps ecoule entre l''heure du signalement et son approbation'
  ' (ou maintenant s''il n''est toujours pas approuve) — c''est la regle de l''application :'
  ' un retard non approuve dans les 30 minutes devient une absence.';


-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- R2 — « un seul signalement NON JUSTIFIÉ par élève » : VOLONTAIREMENT PAS ICI
--
-- L'application refuse de saisir un 2e Ab/Rd tant que le premier n'est pas
-- justifié. C'est une règle de TRAVAIL (elle pousse à traiter les dossiers),
-- pas un invariant de données : l'écrire ici casserait deux choses légitimes
--   * l'import d'un historique (le bureau d'administration saisira des mois
--     d'absences non justifiées d'un coup) ;
--   * le cas réel d'un élève absent lundi ET mardi avant tout traitement.
-- Elle reste donc dans l'application (garde `basculerEnAttente`), et le banc
-- d'essai `tests/verif_regles.sql` vérifie explicitement que la base ACCEPTE
-- plusieurs non justifiés — pour que personne ne l'y remette par erreur.
-- L'invariant dur, lui, est bien en base (migration 0001) : un seul
-- signalement par élève, par jour et par demi-journée.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- Élèves actifs (les « sortis » ne comptent plus dans les effectifs)
-- ---------------------------------------------------------------------------
create or replace view v_eleves_actifs
with (security_invoker = true) as
  select e.id, e.classe_id, e.code_massar, e.nom, e.prenom,
         c.nom as classe, c.etablissement_id
    from eleves e
    join classes c on c.id = e.classe_id
   where e.actif;


-- ---------------------------------------------------------------------------
-- Signalements enrichis : type effectif, nom de l'élève, classe, enseignant
-- ---------------------------------------------------------------------------
create or replace view v_signalements
with (security_invoker = true) as
  select s.id,
         s.etablissement_id,
         s.date_abs,
         s.moment,
         s.heure,
         s.type                              as type_saisi,
         type_effectif(s.type, s.retard_minutes) as type_effectif,
         s.retard_minutes,
         s.statut,
         (s.statut = 'absent')               as non_justifie,
         s.motif,
         s.decide_le,
         s.eleve_id,
         e.nom || ' ' || coalesce(e.prenom, '') as eleve,
         e.code_massar,
         s.classe_id,
         c.nom                               as classe,
         s.prof_id,
         p.nom                               as enseignant
    from signalements s
    join eleves  e on e.id = s.eleve_id
    join classes c on c.id = s.classe_id
    left join profils p on p.id = s.prof_id;


-- ---------------------------------------------------------------------------
-- R3 — les séances annulées, 2 sources fusionnées sans doublon
--      source « saisie »      : annulation d'une séance précise, à la main
--      source « absence_prof » : toutes les séances de l'enseignant absent
--      En cas de doublon (les deux sources), la saisie directe prime.
-- ---------------------------------------------------------------------------
create or replace view v_seances_annulees
with (security_invoker = true) as
with toutes as (
  select a.etablissement_id,
         a.classe_id,
         a.date_seance,
         a.debut,
         a.fin,
         a.motif,
         'saisie'::text as source,
         null::bigint   as prof_id,
         a.cree_le
    from annulations_seances a
  union all
  select s.etablissement_id,
         s.classe_id,
         j::date                as date_seance,
         s.debut,
         s.fin,
         ap.motif,
         'absence_prof'::text   as source,
         s.prof_id,
         ap.cree_le
    from absences_personnel ap
    join lateral generate_series(ap.debut::timestamp, ap.fin::timestamp, interval '1 day') as j on true
    join seances s
      on s.prof_id = ap.prof_id
     and s.jour = extract(isodow from j)::smallint
   where ap.portee = 'journee'
      or (ap.portee = 'matin'      and s.debut <  time '12:00')
      or (ap.portee = 'apres-midi' and s.debut >= time '12:00')
)
select distinct on (classe_id, date_seance, debut)
       etablissement_id, classe_id, date_seance, debut, fin, motif, source, prof_id
  from toutes
 order by classe_id, date_seance, debut, (source = 'saisie') desc, cree_le;


-- ---------------------------------------------------------------------------
-- R4 — les séances DUES d'une classe sur une période
--      = les séances du tableau de service, moins tout ce qui est annulé
--        (fermetures de l'établissement + vue R3)
--      C'est le dénominateur du taux de présence, celui qui manquait à
--      l'application (elle le déduisait des signalements eux-mêmes).
-- ---------------------------------------------------------------------------
create or replace function seances_annulees_classe(p_classe bigint, p_debut date, p_fin date)
returns table (date_seance date, debut time, fin time, source text, motif text)
language sql stable
as $$
  -- fermetures de l'établissement (elles annulent les séances du jour)
  select j::date, s.debut, s.fin, 'fermeture'::text, f.libelle
    from generate_series(p_debut::timestamp, p_fin::timestamp, interval '1 day') as j
    join fermetures f
      on j::date between f.debut and f.fin
    join seances s
      on s.classe_id = p_classe
     and s.jour = extract(isodow from j)::smallint
     and (f.portee = 'journee'
          or (f.portee = 'matin'      and s.debut <  time '12:00')
          or (f.portee = 'apres-midi' and s.debut >= time '12:00'))
  union all
  -- annulations saisies + absences de professeurs (vue R3)
  select v.date_seance, v.debut, v.fin, v.source, v.motif
    from v_seances_annulees v
   where v.classe_id = p_classe
     and v.date_seance between p_debut and p_fin
$$;

create or replace function seances_dues(p_classe bigint, p_debut date, p_fin date)
returns table (date_seance date, debut time, fin time)
language sql stable
as $$
  select j::date, s.debut, s.fin
    from generate_series(p_debut::timestamp, p_fin::timestamp, interval '1 day') as j
    join seances s
      on s.classe_id = p_classe
     and s.jour = extract(isodow from j)::smallint
   where not exists (
     select 1 from seances_annulees_classe(p_classe, p_debut, p_fin) a
      where a.date_seance = j::date and a.debut = s.debut
   )
$$;


-- ---------------------------------------------------------------------------
-- R5 — les absences qui comptent vraiment : signalements effectivement
--      « absence » (R1) et hors période de fermeture (R5)
-- ---------------------------------------------------------------------------
create or replace function absences_comptees(p_classe bigint, p_debut date, p_fin date)
returns table (eleve_id bigint, date_abs date, moment moment_journee)
language sql stable
as $$
  select v.eleve_id, v.date_abs, v.moment
    from v_signalements v
   where v.classe_id = p_classe
     and v.date_abs between p_debut and p_fin
     and v.type_effectif = 'absence'
     and not exists (
       select 1 from fermetures f
        where f.etablissement_id = v.etablissement_id
          and v.date_abs between f.debut and f.fin
          and (f.portee = 'journee'
               or (f.portee = 'matin'      and v.moment = 'matin')
               or (f.portee = 'apres-midi' and v.moment = 'apres-midi'))
     )
$$;


-- ---------------------------------------------------------------------------
-- Taux de présence d'une classe, avec son détail auditable
--   places = effectif actif x séances dues      (le vrai dénominateur)
--   taux   = (places - absences comptées) / places
-- ---------------------------------------------------------------------------
create or replace function taux_presence(p_classe bigint, p_debut date, p_fin date)
returns table (effectif integer, seances_dues integer, places integer,
               absences integer, taux numeric, detail text)
language sql stable
as $$
  with e as (
    select count(*)::int as n from eleves where classe_id = p_classe and actif
  ), d as (
    select count(*)::int as n from seances_dues(p_classe, p_debut, p_fin)
  ), a as (
    select count(*)::int as n from absences_comptees(p_classe, p_debut, p_fin)
  ), p as (
    select greatest(e.n * d.n, 1) as n from e, d
  ), t as (
    select round(greatest(0, least(100, (p.n - a.n)::numeric / p.n * 100))) as v from p, a
  )
  select e.n, d.n, p.n, a.n, t.v,
         e.n || ' élève(s) · ' || d.n || ' séance(s) due(s) · ' || a.n || ' absence(s)'
    from e, d, p, a, t
$$;


-- ---------------------------------------------------------------------------
-- Taux de présence de l'établissement (toutes classes à effectif actif)
-- ---------------------------------------------------------------------------
create or replace function taux_presence_etablissement(p_debut date, p_fin date)
returns table (effectif integer, seances_dues integer, places integer,
               absences integer, taux numeric, detail text)
language sql stable
as $$
  with tot as (
    select coalesce(sum(t.effectif), 0)::int     as effectif,
           coalesce(sum(t.places), 0)::int        as places,
           coalesce(sum(t.absences), 0)::int      as absences,
           coalesce(sum(t.seances_dues), 0)::int  as seances_dues,
           count(*)::int                          as nb_classes
      from classes c
      cross join lateral taux_presence(c.id, p_debut, p_fin) t
  ), p as (
    select greatest(places, 1) as n, effectif, absences, seances_dues, nb_classes from tot
  )
  select effectif, seances_dues, n as places, absences,
         round(greatest(0, least(100, (n - absences)::numeric / n * 100))),
         effectif || ' élève(s) · ' || seances_dues || ' séance(s) due(s) · ' || absences || ' absence(s)'
    from p
$$;


-- ---------------------------------------------------------------------------
-- Totaux d'un élève sur une période (le même calcul que la fiche élève)
-- ---------------------------------------------------------------------------
create or replace function totaux_eleve(p_eleve bigint,
                                        p_debut date default date '1900-01-01',
                                        p_fin   date default date '2100-01-01')
returns table (absences integer, retards integer, non_justifies integer, justifies integer)
language sql stable
as $$
  with sig as (
    select v.type_effectif, v.non_justifie
      from v_signalements v
     where v.eleve_id = p_eleve
       and v.date_abs between p_debut and p_fin
  )
  select count(*) filter (where type_effectif = 'absence')::int,
         count(*) filter (where type_effectif = 'retard')::int,
         count(*) filter (where non_justifie)::int,
         count(*) filter (where not non_justifie)::int
    from sig
$$;
