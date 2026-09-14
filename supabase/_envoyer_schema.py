#!/usr/bin/env python3
"""Envoie le plan de la base (les 9 tables + les regles) vers ton projet Supabase.

Le mot de passe de la base est demande a l'ecran : il ne s'affiche pas,
n'est ecrit nulle part, et n'est transmis a personne.

Usage :  python3 supabase/_envoyer_schema.py
"""
import getpass
import os
import subprocess
import sys

REF = "mtbadhxrezbbuzdtfpez"
HOTES = ["aws-0-eu-west-3.pooler.supabase.com",
         "aws-1-eu-west-3.pooler.supabase.com"]
RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOSSIER = os.path.join(RACINE, "supabase", "migrations")


def lancer(hote, mdp, args, transaction=False):
    cmd = ["psql", "-X", "-q", "--no-psqlrc", "-h", hote, "-p", "5432",
           "-U", "postgres." + REF, "-d", "postgres", "-v", "ON_ERROR_STOP=1"]
    if transaction:
        cmd.append("--single-transaction")
    cmd += args
    env = dict(os.environ)
    env["PGPASSWORD"] = mdp
    env["PGSSLMODE"] = "require"
    p = subprocess.run(cmd, capture_output=True, text=True, env=env, timeout=300)
    return p.returncode, ((p.stdout or "") + (p.stderr or "")).strip()


def question(hote, mdp, sql):
    code, sortie = lancer(hote, mdp, ["-t", "-A", "-c", sql])
    return (code, sortie)


def main():
    print("=" * 62)
    print("ENVOI DU PLAN DE LA BASE VERS SUPABASE")
    print("=" * 62)
    print("Projet : " + REF)
    print()
    print("Colle le mot de passe de base que tu as mis dans tes notes.")
    print("Il ne s'affichera PAS pendant que tu tapes, c'est normal.")
    print()
    try:
        mdp = getpass.getpass("Mot de passe de base : ")
    except Exception:
        mdp = ""
    if not mdp.strip():
        print()
        print("ECHEC   aucun mot de passe saisi - rien n'a ete fait.")
        print("        Relance la commande et colle-le au bon moment.")
        return 2
    mdp = mdp.strip()
    print()

    hote = None
    resultats = []
    for essai in HOTES:
        code, sortie = question(essai, mdp, "select current_user")
        resultats.append((essai, code, sortie))
        if code == 0:
            hote = essai
            print("OK      connexion a la base reussie")
            print("        (porte : %s)" % essai)
            break
    if not hote:
        # On ne conclut "mot de passe refuse" que si c'est la SEULE cause vue :
        # l'autre porte peut refuser pour une raison differente (mauvais serveur).
        refus = [r for r in resultats if "password authentication failed" in r[2]]
        if refus and len(refus) == len(resultats):
            print("ECHEC   mot de passe refuse.")
            print("        Verifie-le dans tes notes (majuscules et chiffres comptent).")
            return 3
        print("ECHEC   connexion impossible. Message du serveur :")
        for _, _, s in resultats:
            print("        " + s.splitlines()[0][:150] if s else "        (aucun message)")
        return 4

    # Deja envoye ?
    _, deja = question(hote, mdp, "select coalesce(to_regclass('public.profils')::text,'')")
    _, regles = question(hote, mdp, "select coalesce(to_regclass('public.v_signalements')::text,'')")
    print("-" * 62)

    for etiquette, present, fichier, quoi in [
            ("tables", deja.strip(), "0001_schema.sql", "les 9 tables et leurs regles d'acces"),
            ("regles metier", regles.strip(), "0002_regles_metier.sql", "les calculs (taux, seances dues)")]:
        if present:
            print("DEJA    %s : deja en place, on ne refait pas" % etiquette)
            continue
        chemin = os.path.join(DOSSIER, fichier)
        if not os.path.exists(chemin):
            print("ECHEC   fichier introuvable : " + chemin)
            return 5
        print("...     envoi de %s (%s)" % (quoi, fichier))
        code, sortie = lancer(hote, mdp, ["-f", chemin], transaction=True)
        if code != 0:
            print("ECHEC   l'envoi a echoue :")
            for ligne in sortie.splitlines()[:12]:
                print("        " + ligne)
            print("        (rien n'a ete enregistre : tout est annule)")
            return 6
        print("OK      %s envoyes" % quoi)

    print("-" * 62)
    _, n = question(hote, mdp, "select count(*) from information_schema.tables "
                               "where table_schema='public' and table_type='BASE TABLE'")
    _, v = question(hote, mdp, "select count(*) from information_schema.views "
                               "where table_schema='public'")
    _, r = question(hote, mdp, "select count(*) from pg_policies where schemaname='public'")
    print("Resultat : %s tables, %s vues, %s regles d'acces" % (n.strip(), v.strip(), r.strip()))
    print()
    print("C'EST FAIT. Dis-le moi : je verifie le tout de l'exterieur")
    print("(et je controle que la cle publique ne voit toujours rien).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
