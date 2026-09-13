# -*- coding: utf-8 -*-
"""v3.3 -> v3.4 : ligne Type du popup dashboard coloree (Absence rouge / Retard orange)."""
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

plain('1-type',
      "  document.getElementById('detail-type').textContent = libelleType(abs.type);",
      """  const elType = document.getElementById('detail-type');
  const estRetard = abs.type === 'retard';
  const estExclusion = abs.type === 'exclusion';
  const couleurType = estRetard ? '#f59e0b' : (estExclusion ? '#64748b' : '#ef4444');
  elType.innerHTML = '<span style="color: ' + couleurType + '; font-weight: 800;">' + libelleType(abs.type) + '</span>';""")

plain('2-version', 'AbsenceTrack v3.3 \u2014 Prototype', 'AbsenceTrack v3.4 \u2014 Prototype')

io.open(F, 'w', encoding='utf-8').write(data)
fails = [r for r in results if not r[1]]
for label, ok, c in results:
    print(('PASS ' if ok else 'FAIL ') + label + ' (' + str(c) + ')')
print('TOTAL', len(results), 'PASS', len(results) - len(fails), 'FAIL', len(fails))
for pat, att in [('couleurType', 2), ('#f59e0b', 4), ('libelleType(abs.type)', 2)]:
    print('RESIDU', pat, data.count(pat), '(attendu', att, ')')

node = shutil.which('node') or shutil.which('nodejs')
mm = re.search(r'<script>(.*)</script>', data, re.DOTALL)
io.open('_check36.js', 'w', encoding='utf-8').write(mm.group(1))
p = subprocess.run([node, '--check', '_check36.js'], capture_output=True, text=True)
print('NODE_CHECK', 'OK' if p.returncode == 0 else 'FAIL\n' + p.stderr[:1000])
print('DIVS', data.count('<div'), data.count('</div>'))
