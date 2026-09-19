#!/usr/bin/env python3
"""Cree la base du projet Supabase AbsenceTrack2 (et la complete si besoin).

Le fichier fait 4 choses, dans cet ordre :
  1. se connecter (mot de passe demande a l'ecran : il n'est JAMAIS ecrit dans un fichier) ;
  2. creer la table de suivi « _migrations » (ce qui a deja ete applique) ;
  3. appliquer les fichiers de migrations NON appliques, dans l'ordre, chacun dans SA
     transaction — un fichier rate ne laisse donc rien a moitie fait ;
  4. afficher la photo de l'etat : tables, regles de cloisonnement, nombre de lignes.

Un fichier deja applique n'est jamais rejoue. S'il a ete MODIFIE apres coup, le script
s'arrete : notre regle est « un changement = un NOUVEAU fichier », jamais une retouche.

Usage :
    python3 supabase/_creer_base.py            # -> le vrai projet Supabase
    python3 supabase/_creer_base.py --local    # -> repetition sur le PostgreSQL du poste
"""
import getpass
import hashlib
import os
import pathlib
import subprocess
import sys

REF = "fgrkjrttcbuflykligfw"
HOTES = ["aws-1-eu-west-3.pooler.supabase.com",      # trouve le 15/09 : c'est la que vit ce projet
         "aws-0-eu-west-3.pooler.supabase.com"]
SOCK_LOCAL = os.path.expanduser("~/pgsock")
PORT_LOCAL = "5439"
BASE_LOCALE = "abs2verif"
ICI = pathlib.Path(__file__).resolve().parent
MIGRATIONS = sorted((ICI / "migrations").glob("*.sql"))

# Ce que Supabase fournit d'avance : le schema « auth », les roles, les fonctions.
# En repetition locale, il faut donc le fabriquer.
FAUX_SUPABASE = """
create role authenticated; create role anon; create role service_role;
"""
FAUX_SUPABASE_TOLERANT = """
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
create or replace function auth.jwt() returns jsonb language sql stable as
  $$ select jsonb_build_object('email', nullif(current_setting('app.email', true), '')) $$;
alter default privileges in schema public grant all on tables to authenticated, anon;
alter default privileges in schema public grant all on sequences to authenticated, anon;
alter default privileges in schema public grant all on functions to authenticated, anon;
create extension if not exists pgcrypto;
"""


def psql(serveur, user, base, args, mdp=None):
    cmd = ["psql", "-X", "-q", "--no-psqlrc"] + serveur + ["-U", user, "-d", base] + args
    env = dict(os.environ)
    if mdp is not None:
        env["PGPASSWORD"] = mdp
        env["PGSSLMODE"] = "require"
    p = subprocess.run(cmd, capture_output=True, text=True, env=env, timeout=600)
    return p.returncode, ((p.stdout or "") + (p.stderr or "")).strip()


def question(serveur, user, base, sql, mdp=None):
    return psql(serveur, user, base, ["-t", "-A", "-c", sql], mdp)


def empreinte(chemin):
    return hashlib.sha256(chemin.read_bytes()).hexdigest()[:16]


def trouver_porte(mdp):
    """La connexion directe de Supabase est en IPv6 seul : on passe par le regroupement (IPv4)."""
    essais = []
    for hote in HOTES:
        serveur = ["-h", hote, "-p", "5432"]
        code, sortie = question(serveur, "postgres." + REF, "postgres", "select current_user", mdp)
        essais.append((hote, code, sortie))
        if code == 0:
            return serveur, hote, essais
    return None, None, essais


def photo(serveur, user, mdp, base):
    """Ce que contient la base : tables, cloisonnement, lignes."""
    q = lambda sql: question(serveur, user, base, sql, mdp)[1]
    tables = [t for t in q("select tablename from pg_tables where schemaname = 'public' order by 1").split("\n") if t]
    print("    %d table(s) : %s" % (len(tables), ", ".join(tables)))
    if not tables:
        return 1
    regles = q("select count(*) from pg_policies where schemaname = 'public'")
    print("    %s regle(s) de cloisonnement (RLS)" % regles)
    without = q("select tablename from pg_tables where schemaname = 'public' and not rowsecurity order by 1")
    print("    tables SANS cloisonnement : %s" % (without.replace("\n", ", ") if without else "aucune"))
    vues = [v for v in q("select viewname from pg_views where schemaname = 'public' order by 1").split("\n") if v]
    print("    %d vue(s) : %s" % (len(vues), ", ".join(vues)))
    lignes = 0
    for t in tables:
        n = int(q('select count(*) from public."%s"' % t) or 0)
        lignes += n
    print("    %d ligne(s) de donnees au total" % lignes)
    return 0


def main():
    local = "--local" in sys.argv
    print("=" * 66)
    if local:
        print("REPETITION LOCALE (rien n'est envoye sur Supabase)")
        print("=" * 66)
        serveur, user, base = ["-h", SOCK_LOCAL, "-p", PORT_LOCAL], "postgres", BASE_LOCALE
        # --garder : on repart de la base locale existante (pour verifier qu'un 2e passage
        # ne rejoue rien). Sans ce mot, on repart d'une base vide.
        if "--garder" not in sys.argv:
            psql(["-h", SOCK_LOCAL, "-p", PORT_LOCAL], "postgres", "postgres", ["-c", "drop database if exists " + BASE_LOCALE])
            psql(["-h", SOCK_LOCAL, "-p", PORT_LOCAL], "postgres", "postgres", ["-c", "create database " + BASE_LOCALE])
            code, sortie = psql(serveur, user, base, ["-c", FAUX_SUPABASE_TOLERANT])
            if code:
                print("ECHEC   environnement Supabase factice : " + sortie[:300]); return 2
            print("OK      base locale vide + environnement Supabase factice")
        else:
            print("OK      on garde la base locale telle quelle")
        mdp = None
    else:
        print("PROJET SUPABASE : AbsenceTrack2 (%s)" % REF)
        print("=" * 66)
        mdp = os.environ.get("ABS2_MDP", "").strip()
        if not mdp:
            print("Colle le mot de passe de la base (Project Settings > Database).")
            print("Il ne s'affiche pas pendant la frappe, et il n'est ecrit nulle part.")
            mdp = getpass.getpass("Mot de passe : ").strip()
        if not mdp:
            print("ECHEC   aucun mot de passe : rien n'a ete fait."); return 2
        serveur, hote, essais = trouver_porte(mdp)
        if not serveur:
            refus = [e for e in essais if "password authentication failed" in e[2]]
            if refus and len(refus) == len(essais):
                print("ECHEC   mot de passe refuse (verifie-le, majuscules et chiffres comptent).")
            else:
                print("ECHEC   connexion impossible :")
                for h, c, s in essais:
                    print("        %s -> %s" % (h, s[:120]))
            return 3
        print("OK      connecte (porte : %s)" % hote)
        base, user = "postgres", "postgres." + REF

    psql(serveur, user, base, ["-c",
        "create table if not exists _migrations (fichier text primary key, empreinte text not null, applique_le timestamptz not null default now())"], mdp)
    lignes = question(serveur, user, base, "select fichier || '|' || empreinte from _migrations", mdp)[1]
    deja = {}
    for l in lignes.split("\n"):
        if "|" in l:
            nom, emp = (l.strip().split("|") + [""])[:2]
            deja[nom] = emp

    a_faire, retouches = [], []
    for f in MIGRATIONS:
        e = empreinte(f)
        if f.name not in deja:
            a_faire.append(f.name)
        elif deja[f.name] != e:
            retouches.append(f.name)
    if retouches:
        print("ECHEC   deja applique(s) MAIS modifie(s) depuis : " + ", ".join(retouches))
        print("        Regle : un changement = un NOUVEAU fichier. Rien n'a ete touche.")
        return 4
    if not a_faire:
        print("OK      tous les fichiers etaient deja appliques")
    for nom in a_faire:
        f = ICI / "migrations" / nom
        code, sortie = psql(serveur, user, base, ["--single-transaction", "-v", "ON_ERROR_STOP=1",
                                                  "-f", str(f), "-c",
                                                  "insert into _migrations (fichier, empreinte) values ('%s', '%s')" % (nom, empreinte(f))], mdp)
        print(("OK      " if code == 0 else "ECHEC   ") + nom + ("" if code == 0 else " -> " + sortie[:300]))
        if code:
            print("        (ce fichier n'a rien laisse : il tournait dans une seule transaction)")
            return 5

    print()
    print("PHOTO DE LA BASE")
    res = photo(serveur, user, mdp, base)
    print()
    print("VERDICT : " + ("base prete." if res == 0 else "base incomplete."))
    return res


if __name__ == "__main__":
    sys.exit(main())
