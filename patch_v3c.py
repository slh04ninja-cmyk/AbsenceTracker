# -*- coding: utf-8 -*-
"""v3.8 -> v3.9 : fond Classe supprime, cartes Historique = format Dashboard, margin bottom 1px."""
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

# 1. plus de fond sur la classe (dashboard)
plain('1-classe',
      '.absence-card-classe { font-size: 12px; color: #475569; font-weight: 600; background: #eef2f7; padding: 5px 10px; border-radius: 8px; white-space: nowrap; }',
      '.absence-card-classe { font-size: 12px; color: #64748b; font-weight: 600; white-space: nowrap; }')
plain('1b-classeSombre',
      'body.theme-sombre .absence-card-classe { background: #273549; color: #cbd5e1; }',
      'body.theme-sombre .absence-card-classe { background: transparent !important; color: #94a3b8; }')

# 2. margin bottom = 1px
plain('2-margin',
      '.carte-eleve { background: linear-gradient(135deg, #eff6ff 0%, #ffffff 55%, #f8fafc 100%); border: 1px solid #bfdbfe; border-radius: 14px; box-shadow: 0 4px 14px rgba(30,58,138,0.08); padding: 10px 14px; margin: 8px 0;',
      '.carte-eleve { background: linear-gradient(135deg, #eff6ff 0%, #ffffff 55%, #f8fafc 100%); border: 1px solid #bfdbfe; border-radius: 14px; box-shadow: 0 4px 14px rgba(30,58,138,0.08); padding: 10px 14px; margin: 0 0 1px;')
plain('2b-totalCss',
      '    .carte-eleve .absence-card-ligne { flex: 1; min-width: 0; }',
      """    .carte-eleve .absence-card-ligne { flex: 1; min-width: 0; }
    .carte-eleve-total { font-size: 13px; font-weight: 800; color: #1d4ed8; white-space: nowrap; }
    body.theme-sombre .carte-eleve-total { color: #93c5fd; }""")

# 3. carte historique = meme format que la carte dashboard
plain('3-historique',
      """    item.innerHTML = `
      <div>
        <p class="font-bold text-gray-800 text-sm">${x.nom}</p>
        <p class="text-xs text-gray-500">${x.classe}</p>
      </div>
      <span class="text-sm font-bold text-blue-600">${x.count}</span>
    `;""",
      """    item.innerHTML = `
      <div class="absence-card-ligne">
        <span class="absence-card-name">${x.nom}</span>
        <span class="absence-card-classe">${x.classe}</span>
        <span class="carte-eleve-total">${x.count}</span>
        <i class="fas fa-chevron-right absence-card-icon"></i>
      </div>
    `;""")

# 4. version
plain('4-version', 'AbsenceTrack v3.8 \u2014 Prototype', 'AbsenceTrack v3.9 \u2014 Prototype')

io.open(F, 'w', encoding='utf-8').write(data)
fails = [r for r in results if not r[1]]
for label, ok, c in results:
    print(('PASS ' if ok else 'FAIL ') + label + ' (' + str(c) + ')')
print('TOTAL', len(results), 'PASS', len(results) - len(fails), 'FAIL', len(fails))
for pat, att in [('background: #eef2f7', 0), ('margin: 0 0 1px', 1), ('carte-eleve-total', 3), ('absence-card-ligne', 3)]:
    print('RESIDU', pat, data.count(pat), '(attendu', att, ')')

node = shutil.which('node') or shutil.which('nodejs')
mm = re.search(r'<script>(.*)</script>', data, re.DOTALL)
io.open('_check41.js', 'w', encoding='utf-8').write(mm.group(1))
p = subprocess.run([node, '--check', '_check41.js'], capture_output=True, text=True)
print('NODE_CHECK', 'OK' if p.returncode == 0 else 'FAIL\n' + p.stderr[:1000])
