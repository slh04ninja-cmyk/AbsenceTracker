# -*- coding: utf-8 -*-
"""v3.2 -> v3.3 : popup dashboard : ligne Statut -> Historique (nb absences/retards)."""
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

# 1. HTML : ligne Statut -> Historique
plain('1-html',
      '<div class="flex justify-between py-2 border-b border-gray-200"><span class="text-xs font-bold text-gray-500">Statut</span><span class="text-sm font-semibold" id="detail-statut-badge"></span></div>',
      '<div class="flex justify-between py-2 border-b border-gray-200"><span class="text-xs font-bold text-gray-500">Historique</span><span class="text-sm font-semibold text-gray-800" id="detail-historique">-</span></div>')

# 2. JS : remplir Historique (nb absences / retards de l'eleve)
plain('2-js',
      """  const badgeContainer = document.getElementById('detail-statut-badge');
  const badgeClass = abs.statut === 'justifie_s' ? 'badge-info' : abs.statut === 'justifie_d' ? 'badge-success' : 'badge-danger';
  badgeContainer.innerHTML = '<span class="badge ' + badgeClass + '">' + libelleStatut(abs.statut) + '</span>';""",
      """  const lignesEleve = absences.filter(a => a.eleveId === abs.eleveId && a.classe === abs.classe);
  const nbAbsEleve = lignesEleve.filter(a => (a.type || 'absence') !== 'retard').length;
  const nbRetEleve = lignesEleve.filter(a => a.type === 'retard').length;
  document.getElementById('detail-historique').textContent =
    nbAbsEleve + ' ' + (nbAbsEleve < 2 ? 'absence' : 'absences') + ' · ' + nbRetEleve + ' ' + (nbRetEleve < 2 ? 'retard' : 'retards');""")

# 3. version
plain('3-version', 'AbsenceTrack v3.2 \u2014 Prototype', 'AbsenceTrack v3.3 \u2014 Prototype')

io.open(F, 'w', encoding='utf-8').write(data)
fails = [r for r in results if not r[1]]
for label, ok, c in results:
    print(('PASS ' if ok else 'FAIL ') + label + ' (' + str(c) + ')')
print('TOTAL', len(results), 'PASS', len(results) - len(fails), 'FAIL', len(fails))
for pat, att in [('detail-statut-badge', 0), ('detail-historique', 2), ('>Historique</span>', 1),
                 ("nbAbsEleve < 2 ? 'absence'", 1)]:
    c = data.count(pat)
    print('RESIDU', repr(pat), c, 'OK' if c == att else '!!ATTENDU ' + str(att))

node = shutil.which('node') or shutil.which('nodejs')
mm = re.search(r'<script>(.*)</script>', data, re.DOTALL)
io.open('_check34.js', 'w', encoding='utf-8').write(mm.group(1))
p = subprocess.run([node, '--check', '_check34.js'], capture_output=True, text=True)
print('NODE_CHECK', 'OK' if p.returncode == 0 else 'FAIL\n' + p.stderr[:1000])
print('DIVS', data.count('<div'), data.count('</div>'))
