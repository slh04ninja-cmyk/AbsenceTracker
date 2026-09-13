#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""outils/build.py — construit le livrable « un seul fichier ».

Aujourd'hui (source unique) : recopie AbsenceTrack-v2.html -> dist/AbsenceTrack-<version>.html
et imprime version, taille et empreinte sha256 (traçabilité du livrable).

Après le découpage (phase 2) : assemblera src/index.html + src/styles/*.css + src/js/*.js
dans un seul fichier, dans l'ordre fixé ici — c'est ce fichier assemblé qu'on envoie au
téléphone et que la Release publie.

  python3 outils/build.py            # construit dans dist/
  python3 outils/build.py --verifier # vérifie que le fichier reconstruit est identique
                                     # (au label de version près) : garde-fou du découpage
"""
import hashlib, io, os, re, shutil, sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(RACINE, 'dist')
SOURCE = os.path.join(RACINE, 'AbsenceTrack-v2.html')


def version_de(texte):
    m = re.search(r'AbsenceTrack (v[\d.]+)', texte)
    return m.group(1) if m else 'v0.0'


def main():
    verifier = '--verifier' in sys.argv
    if not os.path.exists(SOURCE):
        print('source absente : %s' % SOURCE)
        return 1
    texte = io.open(SOURCE, encoding='utf-8').read()
    ver = version_de(texte)
    os.makedirs(DIST, exist_ok=True)
    cible = os.path.join(DIST, 'AbsenceTrack-%s.html' % ver)
    shutil.copyfile(SOURCE, cible)
    octets = io.open(cible, 'rb').read()
    print('livrable : %s' % os.path.relpath(cible, RACINE))
    print('version  : %s' % ver)
    print('taille   : %.0f Ko' % (len(octets) / 1024))
    print('sha256   : %s' % hashlib.sha256(octets).hexdigest()[:16])
    if verifier:
        identique = cible and io.open(cible, encoding='utf-8').read() == texte
        print('identité : %s' % ('OK (reconstruction fidèle)' if identique else 'DIFFÉRENTE'))
        return 0 if identique else 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
