#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""outils/verif.py — vérification du prototype AbsenceTrack.

  python3 outils/verif.py rapide [suite ...]   contrôles de forme + suites les plus sensibles (~20 s)
  python3 outils/verif.py tout                 les 37 suites, 3 en parallèle (~2 min)

Contrôles de forme : validité JS du bloc <script>, équilibre des <div>, label de version,
et aucune classe `fa-<chiffre>` (icônes Font Awesome « chiffres » : elles affichent un numéro
dans l'interface — bug v3.85).

Sortie : rien d'autre que les échecs = tout va bien. Code retour 0/1 (utilisé par la CI).
"""
import io, os, re, sys, subprocess, time
from concurrent.futures import ThreadPoolExecutor

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# le source peut être à la racine (aujourd'hui) ou dans app/ (après le découpage)
SOURCES = ['AbsenceTrack-v2.html', os.path.join('app', 'index.html')]

# suites qui attrapent le plus de régressions (écran élève, gestion, RH, listes, popups)
SUITES_RAPIDES = ['test_gestion.js', 'test_v354.js', 'test_v380.js', 'test_sd.js',
                  'test_dir.js', 'test_tableau.js']


def source():
    for c in SOURCES:
        p = os.path.join(RACINE, c)
        if os.path.exists(p):
            return p
    return None


def trouver_suites():
    """les suites vivent à la racine ou dans tests/"""
    trouvees = {}
    for dossier in (RACINE, os.path.join(RACINE, 'tests')):
        if not os.path.isdir(dossier):
            continue
        for f in sorted(os.listdir(dossier)):
            if f.startswith('test_') and f.endswith('.js'):
                trouvees[f] = os.path.join(dossier, f)
    return trouvees


def controles_forme():
    html = source()
    if not html:
        print('!! aucune source trouvée (%s)' % ', '.join(SOURCES))
        return False
    s = io.open(html, encoding='utf-8').read()
    blocs = re.findall(r'<script>(.*?)</script>', s, re.S)
    tmp = os.path.join(RACINE, '_verif_bloc.js')
    io.open(tmp, 'w', encoding='utf-8').write(max(blocs, key=len))
    r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
    os.remove(tmp)
    o, n = s.count('<div'), s.count('</div>')
    ver = re.search(r'AbsenceTrack (v[\d.]+)', s)
    fa = re.findall(r'class="[^"]*\bfa-[0-9]\b[^"]*"', s)
    print('source     : %s' % os.path.relpath(html, RACINE))
    print('syntaxe JS : %s' % ('OK' if r.returncode == 0 else 'CASSÉE -> ' + r.stderr[:200]))
    print('divs       : %d / %d %s' % (o, n, 'OK' if o == n else 'DÉSÉQUILIBRE'))
    print('version    : %s' % (ver.group(1) if ver else '??'))
    if fa:
        print('!! classes fa-<chiffre> (icônes Font Awesome => affichent un numéro) : %s' % fa[:3])
    return r.returncode == 0 and o == n and not fa


def lancer(item):
    nom, chemin = item
    t0 = time.time()
    try:
        r = subprocess.run(['node', chemin], capture_output=True, text=True,
                           cwd=RACINE, timeout=300)
        lignes = (r.stdout or '').strip().split('\n')
        ok = 'TOUT OK' in (lignes[-1] if lignes else '')
    except subprocess.TimeoutExpired:
        ok = False
    return nom, ok, time.time() - t0


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else 'rapide'
    ok_forme = controles_forme()
    dispo = trouver_suites()
    if mode == 'rapide':
        noms = sys.argv[2:] or SUITES_RAPIDES
        noms = [s if s.endswith('.js') else s + '.js' for s in noms]
    else:
        noms = list(dispo)
    a_lancer = [(n, dispo[n]) for n in noms if n in dispo]
    absentes = [n for n in noms if n not in dispo]
    if absentes:
        print('suites introuvables : %s' % ', '.join(absentes))
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=3) as ex:
        res = list(ex.map(lancer, a_lancer))
    duree = time.time() - t0
    ko = [n for n, ok, _ in res if not ok]
    for n, _, d in sorted(res, key=lambda x: -x[2])[:3]:
        print('  plus lente : %-28s %.1f s' % (n, d))
    print('suites : %d lancées en %.0f s (3 en parallèle) — échecs : %s'
          % (len(a_lancer), duree, ', '.join(ko) if ko else 'AUCUN'))
    return 0 if (ok_forme and not ko and not absentes) else 1


if __name__ == '__main__':
    sys.exit(main())
