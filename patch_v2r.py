# -*- coding: utf-8 -*-
"""v2.7 -> v2.8 : radius du bouton orange + meme style au popup Historique (fiche eleve)."""
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

# 1. radius + padding du bouton orange
plain('1-radius',
      '.btn-fermer { background: #ea580c; color: #fff; border: none; font-weight: 700; box-shadow: 0 6px 18px rgba(234,88,12,0.35); }',
      '.btn-fermer { background: #ea580c; color: #fff; border: none; border-radius: calc(var(--radius) / 2); padding: 14px 24px; font-weight: 700; box-shadow: 0 6px 18px rgba(234,88,12,0.35); }')

# 2. polices des boutons du popup fiche eleve (meme traitement que l'autre popup)
plain('2-polices',
      '#modal-absence-detail .btn-fermer, #modal-absence-detail #btn-justifier-absence { font-size: 17px; font-weight: 800; padding: 15px 20px; }',
      '''#modal-absence-detail .btn-fermer, #modal-absence-detail #btn-justifier-absence,
    #modal-fiche-eleve .btn-fermer, #modal-fiche-eleve .btn-primary { font-size: 17px; font-weight: 800; padding: 15px 20px; }''')

# 3. bouton Fermer du popup Historique (fiche eleve) en orange-rouge
plain('3-fermerFiche',
      '<button onclick="fermerFicheEleve()" class="btn-secondary flex-1">Fermer</button>',
      '<button onclick="fermerFicheEleve()" class="btn-fermer flex-1">Fermer</button>')

# 4. version
plain('4-version', 'AbsenceTrack v2.7 \u2014 Prototype', 'AbsenceTrack v2.8 \u2014 Prototype')

io.open(F, 'w', encoding='utf-8').write(data)
fails = [r for r in results if not r[1]]
for label, ok, c in results:
    print(('PASS ' if ok else 'FAIL ') + label + ' (' + str(c) + ')')
print('TOTAL', len(results), 'PASS', len(results) - len(fails), 'FAIL', len(fails))

for pat, att in [('btn-fermer', 6), ('border-radius: calc(var(--radius) / 2); padding: 14px 24px', 1),
                 ('#modal-fiche-eleve .btn-fermer', 1)]:
    c = data.count(pat)
    print('RESIDU', repr(pat), c, 'OK' if c == att else '!!ATTENDU ' + str(att))

node = shutil.which('node') or shutil.which('nodejs')
mm = re.search(r'<script>(.*)</script>', data, re.DOTALL)
io.open('_check29.js', 'w', encoding='utf-8').write(mm.group(1))
p = subprocess.run([node, '--check', '_check29.js'], capture_output=True, text=True)
print('NODE_CHECK', 'OK' if p.returncode == 0 else 'FAIL\n' + p.stderr[:1200])
print('DIVS', data.count('<div'), data.count('</div>'))
