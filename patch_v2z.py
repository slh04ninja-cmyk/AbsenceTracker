# -*- coding: utf-8 -*-
"""v3.5 -> v3.6 : centrer les elements du bloc motif dans leur div."""
import re, io, shutil, subprocess

F = '/data/data/com.termux/files/home/AbsenceTrack-dev/AbsenceTrack-v2.html'
data = io.open(F, encoding='utf-8').read()
results = []

def plain(label, old, new, n=1):
    global data
    c = data.count(old)
    ok = (c == n)
    results.append((label, ok, c))
    if ok:
        data = data.replace(old, new)
    return ok

plain('1-entete',
      '.motif-entete { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }',
      '.motif-entete { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 12px; text-align: center; }')

plain('2-chips',
      '.motif-chips { display: flex; flex-wrap: wrap; gap: 8px; }',
      '.motif-chips { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }')

plain('3-version', 'AbsenceTrack v3.5 \u2014 Prototype', 'AbsenceTrack v3.6 \u2014 Prototype')

io.open(F, 'w', encoding='utf-8').write(data)
fails = [r for r in results if not r[1]]
for label, ok, c in results:
    print(('PASS ' if ok else 'FAIL ') + label + ' (' + str(c) + ')')
print('TOTAL', len(results), 'PASS', len(results) - len(fails), 'FAIL', len(fails))
for pat, att in [('justify-content: center; gap: 10px', 1), ('.motif-chips { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }', 1)]:
    print('RESIDU', pat, data.count(pat), '(attendu', att, ')')

node = shutil.which('node') or shutil.which('nodejs')
mm = re.search(r'<script>(.*)</script>', data, re.DOTALL)
io.open('_check38.js', 'w', encoding='utf-8').write(mm.group(1))
p = subprocess.run([node, '--check', '_check38.js'], capture_output=True, text=True)
print('NODE_CHECK', 'OK' if p.returncode == 0 else 'FAIL\n' + p.stderr[:800])
