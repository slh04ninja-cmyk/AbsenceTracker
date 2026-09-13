# -*- coding: utf-8 -*-
"""Corrige les appels restants vers l'entete Derniere modification."""
import re, io, shutil, subprocess

F = '/data/data/com.termux/files/home/AbsenceTrack-dev/AbsenceTrack-v2.html'
data = io.open(F, encoding='utf-8').read()

for old, new in [('mettreAJourCompteur();', 'mettreAJourEnteteListe();'),
                 ('mettreAJourResumeClasse();', 'mettreAJourEnteteListe();')]:
    c = data.count(old)
    print('remplace', old, '->', c)
    data = data.replace(old, new)

io.open(F, 'w', encoding='utf-8').write(data)

for pat in ['mettreAJourCompteur', 'mettreAJourResumeClasse', 'mettreAJourEnteteListe',
            'classe-resume', 'count-absents', 'derniere-modif']:
    print('RESIDU', pat, data.count(pat))

node = shutil.which('node') or shutil.which('nodejs')
m = re.search(r'<script>(.*)</script>', data, re.DOTALL)
tmp = '/data/data/com.termux/files/home/AbsenceTrack-dev/_check12.js'
io.open(tmp, 'w', encoding='utf-8').write(m.group(1))
p = subprocess.run([node, '--check', tmp], capture_output=True, text=True)
print('NODE_CHECK', 'OK' if p.returncode == 0 else 'FAIL\n' + p.stderr[:1500])
print('DIVS', data.count('<div'), data.count('</div>'))
