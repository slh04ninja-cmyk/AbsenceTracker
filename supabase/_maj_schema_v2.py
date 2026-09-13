# -*- coding: utf-8 -*-
"""_maj_schema_v2.py — corrige le schema suite a la precision utilisateur :
« le directeur, apres l'installation, telecharge les fichiers xlsx et fet ».
Donc RIEN n'est pre-rempli : ni classes, ni eleves, ni seances, ni comptes.
Consequence : une fiche d'enseignant doit pouvoir exister SANS compte de connexion.
On separe donc la FICHE (la personne) du COMPTE (auth.users).
"""
import io, re, sys

F = 'schema.sql'
s = io.open(F, encoding='utf-8').read()
ok = True

def rem(pattern, repl, label, count=1, flags=0, all_=False):
    global s, ok
    n = len(re.findall(pattern, s, flags))
    if n != count:
        print('!! %s : %d occurrence(s) (attendu %d)' % (label, n, count)); ok = False; return
    s = re.sub(pattern, repl, s, count=0 if all_ else count, flags=flags)
    print('OK %s : %d' % (label, n))

# ---------- 1. profils : la fiche devient independante du compte ----------
old_profils = """create table profils (
  id                uuid primary key references auth.users(id) on delete cascade,
  etablissement_id  bigint not null references etablissements(id) on delete restrict,
  email             text not null,
  code              text,                    -- 'math-prof1' — identifiant métier utilisé partout
  nom               text not null,           -- nom affiché, modifiable par le directeur
  role              role_profil not null,
  matiere           text,                    -- uniquement pour les enseignants
  actif             boolean not null default true,
  cree_le           timestamptz not null default now(),

  constraint profils_email_unique      unique (email),
  constraint profils_code_unique       unique (etablissement_id, code),
  constraint profils_matiere_ens_seul  check (role = 'enseignant' or matiere is null)
);

create index profils_etab_role_idx on profils (etablissement_id, role);"""
new_profils = """-- IMPORTANT — la fiche (la personne) est SÉPARÉE du compte de connexion.
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
create index profils_auth_idx      on profils (auth_user_id) where auth_user_id is not null;"""
rem(re.escape(old_profils), lambda m: new_profils, 'profils : fiche separee du compte')

# ---------- 2. les cles etrangeres vers profils passent en bigint ----------
rem(re.escape('prof_id           uuid   not null references profils(id)   on delete cascade,'),
    lambda m: 'prof_id           bigint not null references profils(id)   on delete cascade,',
    'seances.prof_id -> bigint')
rem(re.escape('prof_id           uuid   not null references profils(id)  on delete restrict,  -- enseignant concerné'),
    lambda m: 'prof_id           bigint not null references profils(id)  on delete restrict,  -- enseignant concerné',
    'signalements.prof_id -> bigint')
rem(re.escape('decide_par        uuid references profils(id) on delete set null,  -- qui a approuvé'),
    lambda m: 'decide_par        bigint references profils(id) on delete set null,  -- qui a approuvé',
    'signalements.decide_par -> bigint')
rem(re.escape('signale_par       uuid references profils(id) on delete set null,  -- qui a saisi'),
    lambda m: 'signale_par       bigint references profils(id) on delete set null,  -- qui a saisi',
    'signalements.signale_par -> bigint')
rem(re.escape('prof_id           uuid   not null references profils(id) on delete cascade,'),
    lambda m: 'prof_id           bigint not null references profils(id) on delete cascade,',
    'absences_personnel.prof_id -> bigint')
rem(r'cree_par          uuid references profils\(id\) on delete set null,',
    lambda m: 'cree_par          bigint references profils(id) on delete set null,',
    'cree_par -> bigint (x3)', count=3, all_=True)

# ---------- 3. les fonctions de securite visent maintenant le compte ----------
rem(r'from profils where id = auth\.uid\(\)',
    lambda m: 'from profils where auth_user_id = auth.uid()',
    'fonctions de securite : auth_user_id (x5)', count=5, all_=True)

# nouveau : identifiant de profil de la personne connectee
anchor = """create or replace function est_directeur() returns boolean"""
rem(re.escape(anchor),
    lambda m: """-- L'identifiant de PROFIL de la personne connectée (celui qui est stocké dans
-- les signalements) : distinct de l'identifiant de compte.
create or replace function mon_profil_id() returns bigint
language sql stable security definer set search_path = public as $$
  select id from profils where auth_user_id = auth.uid()
$$;

create or replace function est_directeur() returns boolean""",
    'nouvelle fonction mon_profil_id()')

# ---------- 4. politiques ----------
rem(re.escape('using (id = auth.uid()) with check (id = auth.uid());'),
    lambda m: 'using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());',
    'politique profils_modif_soi')
rem(re.escape('est_surv_ou_dir() or prof_id = auth.uid()'),
    lambda m: 'est_surv_ou_dir() or prof_id = mon_profil_id()',
    'politique signalements_lecture')
rem(re.escape('and signale_par = auth.uid()'),
    lambda m: 'and signale_par = mon_profil_id()',
    'politique signalements_creation')

# creation / suppression de fiches par le directeur (import des tableaux de service)
rem(re.escape("""-- (aucune insertion/suppression : les comptes se creent via Supabase Auth)"""),
    lambda m: """-- Création / suppression de FICHES par le directeur : c'est ce que fait l'import
-- des tableaux de service, qui découvre des enseignants encore sans compte.
-- auth_user_id est forcé à NULL : le lien vers un compte ne se fait PAS depuis
-- l'application (c'est la fonction serveur qui le pose, avec la clé service).
create policy profils_creation on profils for insert to authenticated
  with check (est_directeur() and meme_etab(etablissement_id)
              and role <> 'directeur' and auth_user_id is null);
create policy profils_suppression on profils for delete to authenticated
  using (est_directeur() and meme_etab(etablissement_id) and role <> 'directeur');""",
    'politiques de creation/suppression de fiches')

# ---------- 5. section d'amorcage : conforme au vrai parcours ----------
i = s.index('-- 9. AMORÇAGE')
j = s.index('-- ============================================================================\n-- 10.')
nouvelle_section = """-- 9. AMORÇAGE (à exécuter APRÈS avoir créé le compte du directeur)
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

"""
s = s[:i] + nouvelle_section + s[j:]
print('OK section 9 (amorcage) reecrite')

if not ok:
    print('=== PATCH ANNULE (comptages non conformes) ==='); sys.exit(1)

io.open(F, 'w', encoding='utf-8').write(s)
print('ecrit %s (%d octets)' % (F, len(s.encode('utf-8'))))
