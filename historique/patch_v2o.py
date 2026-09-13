# -*- coding: utf-8 -*-
"""v2.4 -> v2.5 : les popups passent AU-DESSUS de la barre haute (appbar z-index 100)."""
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

modales = ['modal-confirmation', 'modal-classe-detail', 'modal-absence-detail', 'modal-fiche-eleve']
for m in modales:
    old = '<div id="%s" class="' % m
    i = data.find(old)
    if i < 0:
        results.append(('z-' + m, False, 0)); continue
    j = data.find('>', i)
    tag = data[i:j]
    new_tag = tag.replace('z-50', 'z-50"', 1)  # placeholder garde-fou
    # injecte un style z-index eleve juste avant la fermeture du tag
    nouveau = tag + ' style="z-index: 200;"'
    ok = plain('z-' + m, tag, nouveau)

# securite : si un style existait deja, on evite les doublons
data = data.replace('" style="z-index: 200;" style=', '" style=')

plain('version', 'AbsenceTrack v2.4 \u2014 Prototype', 'AbsenceTrack v2.5 \u2014 Prototype')

io.open(F, 'w', encoding='utf-8').write(data)
fails = [r for r in results if not r[1]]
for label, ok, c in results:
    print(('PASS ' if ok else 'FAIL ') + label + ' (' + str(c) + ')')
print('TOTAL', len(results), 'PASS', len(results) - len(fails), 'FAIL', len(fails))

print('z-index 200 (modales):', data.count('style="z-index: 200;"'))
for m, att in [('modal-confirmation', 2), ('modal-classe-detail', 3), ('modal-absence-detail', 3), ('modal-fiche-eleve', 3)]:
    print('  ', m, data.count('id="%s"' % m))

node = shutil.which('node') or shutil.which('nodejs')
mm = re.search(r'<script>(.*)</script>', data, re.DOTALL)
io.open('_check25.js', 'w', encoding='utf-8').write(mm.group(1))
p = subprocess.run([node, '--check', '_check25.js'], capture_output=True, text=True)
print('NODE_CHECK', 'OK' if p.returncode == 0 else 'FAIL\n' + p.stderr[:1200])
print('DIVS', data.count('<div'), data.count('</div>'))
