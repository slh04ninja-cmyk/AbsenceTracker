#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""~/abs2/sonde_annulations.py — ce que la BASE dit des seances annulees.

Outil de VERIFICATION (lecture seule) : se connecte comme l'application
(meme adresse, meme cle publique, un compte reel) et affiche exactement
les tables qui nourrissent la carte « Seances annulees » du Dashboard
surveillant/directeur :

    annulations_seances   -> les annulations (saisie directe + deduites d'une absence)
    absences_personnel    -> les absences du personnel (qui annulent des seances)
    seances               -> l'emploi du temps, pour recalculer ce que l'app deduit

Usage : python3 ~/abs2/sonde_annulations.py
Aucun mot de passe n'est affiche.
"""
import io
import json
import os
import sys
import urllib.error
import urllib.request

BASE = "https://fgrkjrttcbuflykligfw.supabase.co"
CLE = "sb_publishable_q2lOylqVGhUCuHw9kQ7JgQ_Ske0LC9b"


def paires():
    """Tous les couples (identifiant, mot de passe) connus sur ce telephone."""
    trouves = {}
    fichier = os.path.expanduser("~/abs2/comptes.json")
    if os.path.exists(fichier):
        try:
            for mail, mdp in json.loads(io.open(fichier, encoding="utf-8").read()).items():
                trouves.setdefault(mail, []).append(("comptes.json", mdp))
        except Exception as e:
            print("lecture comptes.json impossible :", e)
    try:
        sys.path.insert(0, os.path.expanduser("~/at-comptes"))
        from faire_page import PERSONNES  # noqa: E402
        for _ordre, _nom, mail, mdp in PERSONNES:
            trouves.setdefault(mail, []).append(("faire_page", mdp))
    except Exception as e:
        print("lecture faire_page impossible :", e)
    return trouves


def appel(chemin, methode="GET", corps=None, jeton=None):
    entetes = {"apikey": CLE, "Authorization": "Bearer " + (jeton or CLE)}
    if corps is not None:
        entetes["Content-Type"] = "application/json"
    donnees = json.dumps(corps).encode() if corps is not None else None
    requete = urllib.request.Request(BASE + chemin, data=donnees, headers=entetes, method=methode)
    try:
        with urllib.request.urlopen(requete, timeout=45) as rep:
            return rep.status, json.loads(rep.read().decode() or "null")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode() or "null")
        except Exception:
            return e.code, None
    except Exception as e:
        return 0, str(e)


def connecter():
    for mail, essais in paires().items():
        for source, mdp in essais:
            statut, reponse = appel("/auth/v1/token?grant_type=password", "POST",
                                    {"email": mail, "password": mdp})
            if statut == 200 and isinstance(reponse, dict) and reponse.get("access_token"):
                print("connexion :", mail, "(mot de passe : " + source + ")")
                return reponse["access_token"]
    return None


def main():
    jeton = connecter()
    if not jeton:
        print("AUCUN compte ne se connecte avec les mots de passe enregistres sur ce telephone.")
        print("Il faut le mot de passe d'un compte (directeur, surveillant ou professeur).")
        return 1

    for table, ordre in (("annulations_seances", "date"),
                         ("absences_personnel", "debut")):
        statut, lignes = appel("/rest/v1/%s?select=*&order=%s" % (table, ordre), jeton=jeton)
        if isinstance(lignes, list):
            print("\n=== %s : %d ligne(s) ===  (code %s)" % (table, len(lignes), statut))
            for ligne in lignes:
                print("   " + json.dumps(ligne, ensure_ascii=False))
        else:
            print("\n=== %s : lecture refusee ou vide ===  code %s  %s" % (table, statut, lignes))

    for table in ("seances", "signalements", "classes", "eleves"):
        statut, lignes = appel("/rest/v1/%s?select=id" % table, jeton=jeton)
        if isinstance(lignes, list):
            print("%-14s : %d ligne(s)  (code %s)" % (table, len(lignes), statut))
        else:
            print("%-14s : refusee  code %s" % (table, statut))
    return 0


if __name__ == "__main__":
    sys.exit(main())
