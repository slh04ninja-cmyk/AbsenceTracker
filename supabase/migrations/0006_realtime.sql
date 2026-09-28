-- ============================================================================
-- AbsenceTrack — 0006 : LA BASE PREVIENT LE TELEPHONE (temps reel)
-- ----------------------------------------------------------------------------
-- POURQUOI
--   Jusqu'ici le telephone decouvrait les changements des autres en RELISANT la
--   base toutes les 5 secondes. Cela marche, mais :
--     - un changement met jusqu'a 5 s a arriver sur l'ecran du collegue ;
--     - chaque telephone relit TOUTE la base en boucle, meme quand il ne s'est
--       rien passe (donnees, batterie, reseau).
--   Desormais la base envoie un EVENEMENT a chaque ligne qui bouge : le telephone
--   relecture immediatement. Le tour periodique de l'application reste en place,
--   ralenti, comme filet de securite (voir app/js/24-realtime.js).
--
-- CE QUI CHANGE
--   Les 8 tables de travail sont inscrites dans la publication « supabase_realtime » :
--   c'est ce qui autorise le serveur Realtime a annoncer leurs changements.
--   Rien d'autre : ni donnee, ni regle, ni droit n'est touche.
--
-- CE QU'ELLE NE CHANGE PAS
--   - le cloisonnement : un telephone ne recoit QUE les lignes qu'il avait deja le
--     droit de LIRE (les politiques RLS s'appliquent aux evenements comme aux
--     requetes) ;
--   - l'application : elle reagit aux evenements en relisant la base par le meme
--     chemin qu'avant (21-lire.js), donc aucune regle de travail n'est modifiee.
--
-- APPLICATION
--   Sur le projet Supabase AbsenceTrack2 : coller ce fichier dans l'editeur SQL,
--   ou « supabase db push ». Rejouable : elle ne fait rien si c'est deja en place.
--   Secours (si le role postgres ne peut pas modifier la publication) : tableau de
--   bord Supabase > Database > Publications > cocher les 8 tables.
-- ============================================================================

do $$
declare
  t text;
begin
  -- la publication « supabase_realtime » existe sur Supabase ; on la cree si elle
  -- est absente (base locale de verification) pour que la migration soit rejouable
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'create publication supabase_realtime';
  end if;

  foreach t in array array['classes', 'eleves', 'profils', 'seances', 'signalements',
                           'annulations_seances', 'absences_personnel', 'fermetures'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
