# -*- coding: utf-8 -*-
"""Correctif : remplacer le bloc statut du popup dashboard par la ligne Historique."""
import re, io, shutil, subprocess

F = '/data/data/com.termux/files/home/AbsenceTrack-dev/AbsenceTrack-v2.html'
data = io.open(F, encoding='utf-8').read()

old = """  const badgeContainer = document.getElementById('detail-statut-badge');
  const textColor = abs.statut === 'justifie_s' ? 'text-blue-600' : abs.statut === 'justifie_d' ? 'text-green-600' : 'text-red-600';
  badgeContainer.innerHTML = '<span class="text-sm font-bold ' + textColor + '">' + libelleStatut(abs.statut) + '</span>';"""
new = """  const lignesEleve = absences.filter(a => a.eleveId === abs.eleveId && a.classe === abs.classe);
  const nbAbsEleve = lignesEleve.filter(a => (a.type || 'absence') !== 'retard').length;
  const nbRetEleve = lignesEleve.filter(a => a.type === 'retard').length;
  document.getElementById('detail-historique').textContent =
    nbAbsEleve + ' ' + (nbAbsEleve < 2 ? 'absence' : 'absences') + ' · ' + nbRetEleve + ' ' + (nbRetEleve < 2 ? 'retard' : 'retards');"""

c = data.count(old)
print('occurrences:', c)
if c == 1:
    data = data.replace(old, new)
    io.open(F, 'w', encoding='utf-8').write(data)
    print('OK')
for pat, att in [('detail-statut-badge', 0), ('detail-historique', 2), ('nbAbsEleve', 3), ('libelleStatut', 3)]:
    print('RESIDU', pat, data.count(pat), '(attendu', att, ')')
node = shutil.which('node') or shutil.which('nodejs')
mm = re.search(r'<script>(.*)</script>', data, re.DOTALL)
io.open('_check35.js', 'w', encoding='utf-8').write(mm.group(1))
p = subprocess.run([node, '--check', '_check35.js'], capture_output=True, text=True)
print('NODE_CHECK', 'OK' if p.returncode == 0 else 'FAIL\n' + p.stderr[:1200])
