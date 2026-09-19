#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""~/abs2/dump_base.py — copie de LECTURE SEULE de la base AbsenceTrack2.

Ecrit un fichier JSON par table dans ~/abs2/base_json/ (usage : verifier hors
ligne ce que l'application affiche avec les donnees reelles du serveur).
Ne modifie RIEN. Le mot de passe n'est jamais affiche.
"""
import io
import json
import os
import subprocess

HOTE = "aws-1-eu-west-3.pooler.supabase.com"
USER = "postgres.fgrkjrttcbuflykligfw"
BASE = "postgres"
TABLES = ["etablissements", "classes", "eleves", "profils", "seances",
          "signalements", "absences_personnel", "annulations_seances", "fermetures"]

SORTIE = os.path.expanduser("~/abs2/base_json")


def main():
    mdp = os.environ.get("ABS2_MDP", "").strip()
    if not mdp:
        print("ABS2_MDP absent : lance avec  ABS2_MDP='...' python3 ~/abs2/dump_base.py")
        return 1
    os.makedirs(SORTIE, exist_ok=True)
    env = dict(os.environ, PGPASSWORD=mdp, PGSSLMODE="require")
    for table in TABLES:
        sql = "select coalesce(json_agg(t), '[]') from (select * from %s order by 1) t;" % table
        p = subprocess.run(["psql", "-X", "-q", "--no-psqlrc", "-A", "-t",
                            "-h", HOTE, "-p", "5432", "-U", USER, "-d", BASE, "-c", sql],
                           capture_output=True, text=True, env=env, timeout=300)
        texte = (p.stdout or "").strip()
        if not texte:
            print("%-20s : ECHEC  %s" % (table, (p.stderr or "").strip()[:120]))
            continue
        lignes = json.loads(texte)
        io.open(os.path.join(SORTIE, table + ".json"), "w", encoding="utf-8").write(
            json.dumps(lignes, ensure_ascii=False, indent=1))
        print("%-20s : %d ligne(s)" % (table, len(lignes)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
