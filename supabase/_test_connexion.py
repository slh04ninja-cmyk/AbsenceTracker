#!/usr/bin/env python3
"""Test de connexion a un projet Supabase : etat des lieux.

Usage :
    python3 supabase/_test_connexion.py <URL> <CLE_PUBLIQUE>
    SUPABASE_URL=... SUPABASE_ANON=... python3 supabase/_test_connexion.py

LECTURES SEULEMENT : ce script ne modifie rien sur le serveur.
Sortie : une ligne par controle, avec OK / ATTENTION / ECHEC.
"""
import base64
import json
import os
import sys
import urllib.error
import urllib.request

TABLES = ["etablissements", "profils", "classes", "eleves", "seances",
          "signalements", "fermetures", "absences_personnel", "annulations_seances"]
VUES = ["v_signalements", "v_seances_annulees"]


def nettoyer(v):
    v = (v or "").strip().strip('"').strip("'").rstrip("/")
    if v and not v.startswith("http"):
        v = "https://" + v
    return v


def appel(url, cle, chemin):
    req = urllib.request.Request(url + chemin)
    req.add_header("apikey", cle)
    req.add_header("Authorization", "Bearer " + cle)
    req.add_header("Accept", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as rep:
            return rep.status, rep.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as err:
        return err.code, err.read().decode("utf-8", "replace")
    except Exception as err:
        return 0, str(err)


def role_de_la_cle(cle):
    """Lit le role inscrit dans une cle JWT (sans jamais afficher la cle)."""
    try:
        corps = cle.split(".")[1]
        corps += "=" * (-len(corps) % 4)
        return json.loads(base64.urlsafe_b64decode(corps)).get("role", "")
    except Exception:
        return ""


def dire(etat, texte):
    print("%-9s %s" % (etat, texte))


def main():
    url = nettoyer(sys.argv[1] if len(sys.argv) > 1 else os.environ.get("SUPABASE_URL"))
    cle = (sys.argv[2] if len(sys.argv) > 2 else os.environ.get("SUPABASE_ANON") or "").strip()
    print("=" * 62)
    print("TEST DE CONNEXION SUPABASE")
    print("=" * 62)
    if not url or not cle:
        dire("ECHEC", "il manque l'URL ou la cle publique")
        print("       usage : python3 supabase/_test_connexion.py <URL> <CLE>")
        return 2
    print("URL      : " + url)
    role = role_de_la_cle(cle)
    if len(cle) < 20:
        print("Cle      : (trop courte : %d caracteres - copie incomplete ?)" % len(cle))
    else:
        print("Cle      : %s... (%d caracteres)" % (cle[:10], len(cle)))
    print("-" * 62)

    if role == "service_role" or cle.startswith("sb_secret_"):
        dire("ARRET", "!!! C'EST LA CLE SECRETE (service_role / secret) !!!")
        dire("", "Elle ouvre TOUT le serveur. Ne la partage JAMAIS, meme avec moi.")
        dire("", "Supprime ce message et reprends la cle 'anon public' / 'publishable'.")
        return 3
    if role == "anon" or cle.startswith("sb_publishable_"):
        dire("OK", "type de cle : publique (celle qu'on veut)")
    else:
        dire("ATTENTION", "type de cle non reconnu (role=%r) - je verifie quand meme" % role)

    # 1. La cle est-elle acceptee, et la porte de service (Data API) ouverte ?
    #    NE PAS tester la racine /rest/v1/ : elle refuse les cles publiques
    #    ("Only secret API keys can be used for this endpoint") -> fausse alerte.
    code, corps = appel(url, cle, "/rest/v1/profils?select=id&limit=1")
    if code == 200:
        dire("OK", "Data API ouverte et cle acceptee")
    elif code == 404 and "PGRST205" in corps:
        dire("OK", "cle acceptee (les tables ne sont pas encore envoyees)")
    elif code == 401:
        dire("ECHEC", "la cle est refusee (401) : " + corps[:120])
    else:
        dire("ECHEC", "reponse inattendue %s : %s" % (code, corps[:160]))

    # 2. Le service de connexion (Auth)
    code, corps = appel(url, cle, "/auth/v1/health")
    if code == 200:
        dire("OK", "service de connexion (Auth) joignable")
    else:
        dire("ATTENTION", "Auth : reponse %s" % code)

    # 3. Les 9 tables du schema 0001
    presentes, absentes = [], []
    for nom in TABLES:
        code, corps = appel(url, cle, "/rest/v1/%s?select=*&limit=1" % nom)
        if code == 200:
            presentes.append(nom)
        else:
            absentes.append(nom)
    if not presentes:
        dire("ATTENTION", "aucune table : le schema (0001) n'est pas encore envoye")
    elif absentes:
        dire("ATTENTION", "%d/%d tables presentes, absentes : %s"
             % (len(presentes), len(TABLES), ", ".join(absentes)))
    else:
        dire("OK", "les %d tables du schema sont en place" % len(TABLES))

    # 4. PREUVE du cloisonnement : la cle publique ne doit RIEN voir
    code, corps = appel(url, cle, "/rest/v1/profils?select=id&limit=5")
    if code == 200:
        try:
            lignes = json.loads(corps)
        except Exception:
            lignes = None
        if lignes == []:
            dire("OK", "cloisonnement actif : la cle publique ne lit AUCUNE fiche")
        elif lignes:
            dire("ALERTE", "la cle publique lit %d fiche(s) de profil : A CORRIGER" % len(lignes))
        else:
            dire("ATTENTION", "reponse illisible")
    elif code in (401, 403):
        dire("OK", "acces refuse a profils (401/403) : cloisonnement actif")
    elif code == 404:
        dire("ATTENTION", "table profils absente - schema pas encore envoye")
    else:
        dire("ATTENTION", "profils : reponse %s" % code)

    # 5. Les regles metier (0002)
    vues = []
    for nom in VUES:
        code, corps = appel(url, cle, "/rest/v1/%s?select=*&limit=1" % nom)
        vues.append((nom, code))
    if all(c in (200, 401, 403) for _, c in vues):
        dire("OK", "les vues des regles metier (0002) sont en place")
    else:
        dire("ATTENTION", "regles metier (0002) pas encore envoyees")
    print("-" * 62)
    print("Rappel : ce test ne fait que LIRE, il n'a rien modifie.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
