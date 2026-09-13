#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""outils/build.py — assemble le livrable « un seul fichier » à partir de app/.

**La source de vérité, c'est app/** :
    app/index.html          la coquille (structure des pages, sans CSS ni JS)
    app/styles/*.css        8 feuilles, chargées dans l'ordre de la coquille
    app/js/*.js             18 modules, chargés dans l'ordre de la coquille

Le résultat est écrit dans ``AbsenceTrack-v2.html`` **à la racine** : c'est le fichier que
lisent les 37 suites de tests et celui qu'on copie sur le téléphone. Ne jamais l'éditer à la
main — il est produit ici (la CI le vérifie à chaque push).

  python3 outils/build.py             assemble le livrable + une copie dans dist/
  python3 outils/build.py --verifier  n'écrit rien : compare le livrable sur disque à app/
                                      (échoue si les deux ont divergé) — utilisé par la CI
"""
import hashlib, io, os, re, shutil, sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(RACINE, 'app')
LIVRABLE = os.path.join(RACINE, 'AbsenceTrack-v2.html')
DIST = os.path.join(RACINE, 'dist')

# premiere ligne de chaque fichier source : un repere, retire à l'assemblage
REPERE_CSS = re.compile(r'^/\* fichier: [^\n]*\*/\n')
REPERE_JS = re.compile(r'^// fichier: [^\n]*\n')


def sans_repere(chemin, motif):
    return motif.sub('', io.open(chemin, encoding='utf-8').read(), count=1)


def remplacer_bloc(texte, dossier, ouvrante, fermante, motif_repere):
    """remplace la suite contigue de references locales (styles/... ou js/...) par son contenu"""
    if dossier == 'styles':
        motif_tag = r'<link rel="stylesheet" href="styles/[^"]+">'
    else:
        motif_tag = r'<script src="js/[^"]+"></script>'
    trouve = re.search(motif_tag + r'(?:\s*' + motif_tag + r')*', texte)
    if not trouve:
        raise SystemExit('!! references locales introuvables dans app/index.html (%s)' % dossier)
    fichiers = re.findall(dossier + r'/([^"]+)', trouve.group(0))
    contenu = ''.join(sans_repere(os.path.join(APP, dossier, f), motif_repere) for f in fichiers)
    return texte[:trouve.start()] + ouvrante + contenu + fermante + texte[trouve.end():], fichiers


def assembler():
    texte = io.open(os.path.join(APP, 'index.html'), encoding='utf-8').read()
    texte, feuilles = remplacer_bloc(texte, 'styles', '<style>', '</style>', REPERE_CSS)
    texte, modules = remplacer_bloc(texte, 'js', '<script>', '</script>', REPERE_JS)
    return texte, feuilles, modules


def main():
    verifier = '--verifier' in sys.argv
    sortie, feuilles, modules = assembler()
    version = re.search(r'AbsenceTrack (v[\d.]+)', sortie)
    version = version.group(1) if version else 'v0'
    actuel = io.open(LIVRABLE, encoding='utf-8').read() if os.path.exists(LIVRABLE) else None
    identique = (actuel == sortie)
    print('sources    : %d feuilles CSS + %d modules JS' % (len(feuilles), len(modules)))
    print('version    : %s' % version)
    print('livrable   : %.0f Ko assemblés' % (len(sortie) / 1024))
    if verifier:
        print('identité   : %s' % ('OK — le livrable correspond exactement à app/'
                                   if identique else
                                   'DIFFÉRENT — app/ et le livrable ont divergé (reconstruire)'))
        return 0 if identique else 1
    if identique:
        print('écriture   : rien à faire, le livrable est déjà à jour')
    else:
        io.open(LIVRABLE, 'w', encoding='utf-8').write(sortie)
        print('écriture   : %s' % os.path.relpath(LIVRABLE, RACINE))
    os.makedirs(DIST, exist_ok=True)
    cible = os.path.join(DIST, 'AbsenceTrack-%s.html' % version)
    shutil.copyfile(LIVRABLE, cible)
    empreinte = hashlib.sha256(io.open(cible, 'rb').read()).hexdigest()[:16]
    print('copie      : %s   sha256 %s' % (os.path.relpath(cible, RACINE), empreinte))
    return 0


if __name__ == '__main__':
    sys.exit(main())
