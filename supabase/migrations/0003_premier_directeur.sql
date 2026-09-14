-- ============================================================================
-- AbsenceTrack — 0003 : LA PORTE DU PREMIER DIRECTEUR
-- ----------------------------------------------------------------------------
-- POURQUOI CETTE PORTE EXISTE
--   La RLS interdit volontairement de creer une fiche « directeur » depuis
--   l'application (policy profils_creation : role <> 'directeur') et aucune
--   policy n'autorise la creation d'un etablissement. Sans porte dediee, le
--   tout premier directeur ne pourrait jamais entrer dans sa propre base.
--
-- COMMENT ELLE EST PROTEGEE
--   C'est une fonction « security definer » : elle agit avec les droits de son
--   proprietaire (donc sans RLS), MAIS :
--     - elle refuse de s'ouvrir des que l'etablissement a deja un directeur ;
--     - elle refuse tout compte qui possede deja une fiche ;
--     - elle est interdite aux visiteurs anonymes (revoke ci-dessous).
--   Elle ne permet donc QUE l'installation initiale.
--
-- ELLE SERT AUSSI A UN 2e ETABLISSEMENT
--   Chaque code d'etablissement peut avoir son premier directeur : c'est ce qui
--   permettra d'installer la meme application dans une autre ecole.
-- ============================================================================

create or replace function premier_directeur(
  p_code_etab text,
  p_nom_etab  text,
  p_nom       text,
  p_academie  text  default '',
  p_direction text  default '',
  p_annee     text  default '2026-2027',
  p_semestres jsonb default '[]'::jsonb
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_etab bigint;
  v_moi  bigint;
  v_mail text;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise.';
  end if;

  -- un compte = une seule fiche, definitivement
  select id into v_moi from profils where auth_user_id = auth.uid();
  if v_moi is not null then
    raise exception 'Ce compte a deja une fiche (id %).', v_moi;
  end if;

  if coalesce(length(btrim(p_code_etab)), 0) = 0 then
    raise exception 'Le code de l''etablissement est obligatoire.';
  end if;
  if coalesce(length(btrim(p_nom_etab)), 0) = 0 then
    raise exception 'Le nom de l''etablissement est obligatoire.';
  end if;

  select id into v_etab from etablissements where code = btrim(p_code_etab);
  if v_etab is not null
     and exists (select 1 from profils where etablissement_id = v_etab and role = 'directeur') then
    raise exception 'Cet etablissement a deja un directeur.';
  end if;

  if v_etab is null then
    insert into etablissements (code, nom, academie, direction, annee_libelle, semestres)
    values (btrim(p_code_etab), btrim(p_nom_etab), coalesce(p_academie, ''),
            coalesce(p_direction, ''), coalesce(p_annee, '2026-2027'),
            coalesce(p_semestres, '[]'::jsonb))
    returning id into v_etab;
  end if;

  v_mail := nullif(auth.jwt() ->> 'email', '');
  insert into profils (auth_user_id, etablissement_id, email, nom, role)
  values (auth.uid(), v_etab, v_mail, btrim(p_nom), 'directeur')
  returning id into v_moi;

  return v_moi;
end $$;

comment on function premier_directeur(text, text, text, text, text, text, jsonb) is
  'Cree l''etablissement et la fiche du PREMIER directeur. Refuse si l''etablissement a deja un directeur ou si le compte a deja une fiche.';

-- La porte n'est PAS ouverte aux visiteurs anonymes.
revoke execute on function premier_directeur(text, text, text, text, text, text, jsonb) from public, anon;
grant  execute on function premier_directeur(text, text, text, text, text, text, jsonb) to authenticated;
