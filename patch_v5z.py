# -*- coding: utf-8 -*-
# patch_v5z.py — v3.86 : CORRECTIF — les classes de delai fa-1..fa-4 affichaient des chiffres
#   Font Awesome definit .fa-1:before{content:"\31"} ... .fa-9 (les icones « chiffres »).
#   Mes classes de cascade s'appelaient fa-1..fa-4 -> un chiffre 1,2,3,4 s'affichait devant
#   chaque bloc de la fiche eleve. Renommees cascade-1..cascade-4 (aucun risque de collision).
#   + garde-fou : plus aucune classe d'element ne doit commencer par « fa- » hors icone <i>.
import io, re, sys, subprocess

F = '/data/data/com.termux/files/home/AbsenceTrack-dev/AbsenceTrack-v2.html'
s = io.open(F, encoding='utf-8').read()
rapport = []


def rem(nom, ancien, nouveau, n=1):
    global s
    c = s.count(ancien)
    if c != n:
        print('ECHEC %s : %d occurrence(s) au lieu de %d' % (nom, c, n))
        sys.exit(1)
    s = s.replace(ancien, nouveau)
    rapport.append('%s : %d' % (nom, c))


# 1. les 4 regles CSS
rem('CSS cascade-1', '#modal-fiche-eleve .fiche-anim.fa-1 { animation-delay: 0.04s; }',
    '#modal-fiche-eleve .fiche-anim.cascade-1 { animation-delay: 0.04s; }')
rem('CSS cascade-2', '#modal-fiche-eleve .fiche-anim.fa-2 { animation-delay: 0.12s; }',
    '#modal-fiche-eleve .fiche-anim.cascade-2 { animation-delay: 0.12s; }')
rem('CSS cascade-3', '#modal-fiche-eleve .fiche-anim.fa-3 { animation-delay: 0.20s; }',
    '#modal-fiche-eleve .fiche-anim.cascade-3 { animation-delay: 0.20s; }')
rem('CSS cascade-4', '#modal-fiche-eleve .fiche-anim.fa-4 { animation-delay: 0.30s; }',
    '#modal-fiche-eleve .fiche-anim.cascade-4 { animation-delay: 0.30s; }')

# 2. les 4 blocs dans le HTML
rem('bloc en-tete', 'fiche-anim fa-1" style="flex-shrink: 0;">\n      <span style="width: 32px;',
    'fiche-anim cascade-1" style="flex-shrink: 0;">\n      <span style="width: 32px;')
rem('bloc infos', 'fiche-anim fa-2"', 'fiche-anim cascade-2"')
rem('bloc historique', 'fiche-anim fa-3"', 'fiche-anim cascade-3"')
rem('bloc pied', 'fiche-anim fa-4"', 'fiche-anim cascade-4"')

# 3. commentaire mis a jour
rem('commentaire', "            .fiche-anim.fa-1/2/3/4", "            .fiche-anim.cascade-1/2/3/4") if '            .fiche-anim.fa-1/2/3/4' in s else None
if '/* Cascade d\'ouverture de la FICHE ELEVE' in s:
    s = s.replace("/* Cascade d'ouverture de la FICHE ELEVE : en-tete, carte infos, carte historique, boutons */",
                  "/* Cascade d'ouverture de la FICHE ELEVE (classes cascade-N : jamais « fa-N »,\n       qui sont des icones Font Awesome « chiffre » et afficheraient un numero !) */")
    rapport.append('commentaire cascade : 1')

rem('label version', 'AbsenceTrack v3.85 — Prototype', 'AbsenceTrack v3.86 — Prototype')

# ---------- verification : plus aucune classe « fa-<chiffre> » hors icone ----------
restes = re.findall(r'class="[^"]*\bfa-[0-9]\b[^"]*"', s)
print('classes fa-<chiffre> restantes :', len(restes), restes[:3])

io.open(F, 'w', encoding='utf-8').write(s)

sc = re.findall(r'<script>(.*?)</script>', s, re.S)
bloc = max(sc, key=len)
tmp = '/data/data/com.termux/files/home/AbsenceTrack-dev/_check_v5z.js'
io.open(tmp, 'w', encoding='utf-8').write(bloc)
r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
print('node --check :', 'OK' if r.returncode == 0 else r.stderr[:300])
print('divs : %d / %d' % (s.count('<div'), s.count('</div>')))
print('cascade-N dans le fichier :', len(re.findall(r'cascade-[1-4]', s)))
for x in rapport:
    print(' -', x)
