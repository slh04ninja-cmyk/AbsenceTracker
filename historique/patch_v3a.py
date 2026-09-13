# -*- coding: utf-8 -*-
"""v3.6 -> v3.7 : fond du bloc details eleve identique au bloc motifs (theme clair)."""
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

# 1. HTML : classe dediee
plain('1-html',
      '<div class="bg-gray-50 rounded-2xl p-4 space-y-0" id="absence-detail-content">',
      '<div class="detail-carte rounded-2xl p-4 space-y-0" id="absence-detail-content">')

# 2. CSS : meme fond que le bloc motif, en clair seulement
plain('2-css', '  </style>\n</head>',
      """    .detail-carte { background: linear-gradient(135deg, #eff6ff 0%, #ffffff 55%, #f8fafc 100%); border: 1px solid #bfdbfe; box-shadow: 0 4px 14px rgba(30,58,138,0.08); }
    body.theme-sombre .detail-carte { background: #273549 !important; border-color: #334155 !important; box-shadow: none; }
  </style>
</head>""")

# 3. version
plain('3-version', 'AbsenceTrack v3.6 \u2014 Prototype', 'AbsenceTrack v3.7 \u2014 Prototype')

io.open(F, 'w', encoding='utf-8').write(data)
fails = [r for r in results if not r[1]]
for label, ok, c in results:
    print(('PASS ' if ok else 'FAIL ') + label + ' (' + str(c) + ')')
print('TOTAL', len(results), 'PASS', len(results) - len(fails), 'FAIL', len(fails))
for pat, att in [('detail-carte', 2), ('id="absence-detail-content"', 1)]:
    print('RESIDU', pat, data.count(pat), '(attendu', att, ')')

node = shutil.which('node') or shutil.which('nodejs')
mm = re.search(r'<script>(.*)</script>', data, re.DOTALL)
io.open('_check39.js', 'w', encoding='utf-8').write(mm.group(1))
p = subprocess.run([node, '--check', '_check39.js'], capture_output=True, text=True)
print('NODE_CHECK', 'OK' if p.returncode == 0 else 'FAIL\n' + p.stderr[:800])
print('DIVS', data.count('<div'), data.count('</div>'))
