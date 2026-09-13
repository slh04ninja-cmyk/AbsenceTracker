# -*- coding: utf-8 -*-
"""v3.7 -> v3.8 : cartes eleves unifiees (bg theme clair, height, margin) Dashboard/Historique."""
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

# 1. CSS : classe commune
plain('1-css', '  </style>\n</head>',
      """    /* ===== CARTES ELEVES UNIFIEES (Dashboard / Historique, theme clair) ===== */
    .carte-eleve { background: linear-gradient(135deg, #eff6ff 0%, #ffffff 55%, #f8fafc 100%); border: 1px solid #bfdbfe; border-radius: 14px; box-shadow: 0 4px 14px rgba(30,58,138,0.08); padding: 10px 14px; margin: 8px 0; height: 60px; box-sizing: border-box; display: flex; align-items: center; justify-content: space-between; gap: 10px; cursor: pointer; overflow: hidden; }
    .carte-eleve:hover { box-shadow: 0 6px 18px rgba(30,58,138,0.14); }
    .carte-eleve:active { transform: scale(0.99); }
    .carte-eleve .absence-card-ligne { flex: 1; min-width: 0; }
    body.theme-sombre .carte-eleve { background: #1e293b !important; border-color: #334155 !important; box-shadow: none; }
  </style>
</head>""")

# 2. Dashboard : carte eleve
plain('2-dashboard', "card.className = 'absence-card';", "card.className = 'absence-card carte-eleve';")

# 3. Historique : carte eleve
plain('3-historique',
      """    item.className = 'flex justify-between items-center rounded-xl bg-white';
    item.style = 'margin: 4px 0; padding: 8px 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.04); cursor: pointer;';""",
      """    item.className = 'carte-eleve';""")

# 4. version
plain('4-version', 'AbsenceTrack v3.7 \u2014 Prototype', 'AbsenceTrack v3.8 \u2014 Prototype')

io.open(F, 'w', encoding='utf-8').write(data)
fails = [r for r in results if not r[1]]
for label, ok, c in results:
    print(('PASS ' if ok else 'FAIL ') + label + ' (' + str(c) + ')')
print('TOTAL', len(results), 'PASS', len(results) - len(fails), 'FAIL', len(fails))
for pat, att in [('carte-eleve', 5), ("'absence-card carte-eleve'", 1)]:
    print('RESIDU', pat, data.count(pat), '(attendu', att, ')')

node = shutil.which('node') or shutil.which('nodejs')
mm = re.search(r'<script>(.*)</script>', data, re.DOTALL)
io.open('_check40.js', 'w', encoding='utf-8').write(mm.group(1))
p = subprocess.run([node, '--check', '_check40.js'], capture_output=True, text=True)
print('NODE_CHECK', 'OK' if p.returncode == 0 else 'FAIL\n' + p.stderr[:1000])
print('DIVS', data.count('<div'), data.count('</div>'))
