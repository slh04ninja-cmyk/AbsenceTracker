-- ============================================================================
-- AbsenceTrack — 0005 : L'INSTALLATION SE FAIT TOUTE SEULE
-- ----------------------------------------------------------------------------
-- POURQUOI
--   L'application va etre livree a d'autres etablissements dont les directeurs
--   ne connaissent rien a l'informatique. Personne ne doit avoir a ouvrir un
--   terminal, a ecrire du SQL, ni a demander quoi que ce soit a quelqu'un.
--
-- CE QUE CETTE MIGRATION AJOUTE
--   1. etat_etablissement(code) : l'application demande, AVANT toute connexion,
--      si le code de l'ecole est libre ou deja installe. Elle ne revele que
--      l'etat, jamais le contenu.
--   2. rattacher_mon_compte() : un membre du personnel qui a recu une fiche
--      (nom + son adresse, creee par le directeur) ouvre l'application, cree
--      son compte, et se relie tout seul a SA fiche. La porte verifie que
--      l'adresse correspond EXACTEMENT et que la fiche n'a pas deja de compte.
--
-- CE QU'ELLE NE PERMET PAS
--   - creer une fiche « directeur » (la porte 0003 reste la seule, une fois) ;
--   - se relier a la fiche de quelqu'un d'autre (l'adresse est comparee) ;
--   - deviner les codes des ecoles : etat_etablissement ne dit pas le nom.
-- ============================================================================

-- 1. L'ETABLISSEMENT EST-IL DEJA INSTALLE ? ----------------------------------
create or replace function etat_etablissement(p_code text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when coalesce(length(btrim(p_code)), 0) = 0 then 'code_vide'
    when not exists (select 1 from etablissements where code = btrim(p_code)) then 'libre'
    when exists (select 1
                   from etablissements e
                   join profils p on p.etablissement_id = e.id
                  where e.code = btrim(p_code) and p.role = 'directeur') then 'installe'
    else 'sans_directeur'
  end;
$$;

comment on function etat_etablissement(text) is
  'Etat d''installation d''un etablissement : code_vide, libre, installe ou sans_directeur. Ouverte avant connexion, ne revele aucune donnee.';

revoke execute on function etat_etablissement(text) from public;
grant  execute on function etat_etablissement(text) to anon, authenticated;

-- 2. LE PERSONNEL SE RATTACHE A SA PROPRE FICHE ------------------------------
create or replace function rattacher_mon_compte()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mail  text;
  v_id    bigint;
  v_nb    integer;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise.';
  end if;

  if exists (select 1 from profils where auth_user_id = auth.uid()) then
    raise exception 'Ce compte est deja relie a une fiche.';
  end if;

  v_mail := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
  if v_mail = '' then
    raise exception 'Ce compte n''a pas d''adresse : le directeur doit la corriger.';
  end if;

  select count(*), min(id) into v_nb, v_id
    from profils
   where auth_user_id is null
     and actif
     and lower(btrim(coalesce(email, ''))) = v_mail;

  if v_nb = 0 then
    raise exception 'Aucune fiche ne correspond a l''adresse %. Demandez au directeur d''ajouter votre fiche, puis reessayez.', v_mail;
  end if;

  if v_nb > 1 then
    raise exception 'Plusieurs fiches portent l''adresse % : le directeur doit en corriger une.', v_mail;
  end if;

  update profils set auth_user_id = auth.uid() where id = v_id;
  return v_id;
end $$;

comment on function rattacher_mon_compte() is
  'Relie le compte connecte a SA fiche (meme adresse, fiche sans compte). Refuse tout le reste.';

revoke execute on function rattacher_mon_compte() from public, anon;
grant  execute on function rattacher_mon_compte() to authenticated;

-- 3. COMPTE RENDU : ce que la base sait faire maintenant ---------------------
select proname as fonction, pg_get_function_arguments(oid) as arguments
  from pg_proc
 where proname in ('premier_directeur', 'etat_etablissement', 'rattacher_mon_compte')
 order by proname;
