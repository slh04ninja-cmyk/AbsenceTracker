# -*- coding: utf-8 -*-
"""Repare le residu de l'ancien bloc REGLAGES (accolade orpheline)."""
import re, io, os, shutil, subprocess

F = '/data/data/com.termux/files/home/AbsenceTrack-dev/AbsenceTrack-v2.html'
data = io.open(F, encoding='utf-8').read()

old = """appliquerTheme();
}

appliquerTheme();
appliquerPolice(); // Élèves décochés manuellement après sauvegarde
"""
new = """appliquerTheme();
"""
c = data.count(old)
print('occurrences:', c)
if c == 1:
    data = data.replace(old, new)
    io.open(F, 'w', encoding='utf-8').write(data)
    print('REPARE')
else:
    print('NON TROUVE')
    m = re.search(r'appliquerTheme\(\);\n.*?\n', data, re.DOTALL)
    i = data.find('function basculerTheme')
    print(repr(data[i - 200:i + 400]))

node = shutil.which('node') or shutil.which('nodejs')
if node:
    m = re.search(r'<script>(.*)</script>', data, re.DOTALL)
    tmp = '/data/data/com.termux/files/home/AbsenceTrack-dev/_check9.js'
    io.open(tmp, 'w', encoding='utf-8').write(m.group(1))
    p = subprocess.run([node, '--check', tmp], capture_output=True, text=True)
    print('NODE_CHECK', 'OK' if p.returncode == 0 else 'FAIL\n' + p.stderr[:2000])
for pat in ['appliquerPolice', 'TAILLES_POLICE', 'changerPolice', 'REGLAGES D']:
    print('RESIDU', pat, data.count(pat))
