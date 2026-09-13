# -*- coding: utf-8 -*-
"""v2.9 -> v3.0 : historique = uniquement les Ab/Rd regles (justifies)."""
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

plain('1-filtre',
      """  const map = {};
  absences.forEach(a => {
    const cle = a.eleveId + '|' + a.classe;
    if (!map[cle]) map[cle] = { nom: a.nom, classe: a.classe, count: 0, dernier: '' };
    map[cle].count++;""",
      """  const map = {};
  absences.forEach(a => {
    // On ignore les Ab/Rd non regles (statut Non justifiee)
    if (a.statut !== 'justifie_s' && a.statut !== 'justifie_d') return;
    const cle = a.eleveId + '|' + a.classe;
    if (!map[cle]) map[cle] = { nom: a.nom, classe: a.classe, count: 0, dernier: '' };
    map[cle].count++;""")

plain('2-message', "'<p class=\"text-gray-500 text-center py-8\">Aucun historique</p>'",
      "'<p class=\"text-gray-500 text-center py-8\">Aucun Ab/Rd réglé</p>'")

plain('3-version', 'AbsenceTrack v2.9 \u2014 Prototype', 'AbsenceTrack v3.0 \u2014 Prototype')

io.open(F, 'w', encoding='utf-8').write(data)
fails = [r for r in results if not r[1]]
for label, ok, c in results:
    print(('PASS ' if ok else 'FAIL ') + label + ' (' + str(c) + ')')
print('TOTAL', len(results), 'PASS', len(results) - len(fails), 'FAIL', len(fails))
print('RESIDU filtre:', data.count('non regles (statut Non justifiee)'), '| message:', data.count('Aucun Ab/Rd réglé'))

node = shutil.which('node') or shutil.which('nodejs')
mm = re.search(r'<script>(.*)</script>', data, re.DOTALL)
io.open('_check31.js', 'w', encoding='utf-8').write(mm.group(1))
p = subprocess.run([node, '--check', '_check31.js'], capture_output=True, text=True)
print('NODE_CHECK', 'OK' if p.returncode == 0 else 'FAIL\n' + p.stderr[:1200])

test = '''
const absences = [
  { eleveId: 1, classe: 'A', nom: 'Regle',    statut: 'justifie_s', dateISO: '2026-09-05', heure: '10:00' },
  { eleveId: 1, classe: 'A', nom: 'Regle',    statut: 'justifie_d', dateISO: '2026-09-06', heure: '08:00' },
  { eleveId: 1, classe: 'A', nom: 'Regle',    statut: 'absent',    dateISO: '2026-09-07', heure: '09:00' },
  { eleveId: 2, classe: 'A', nom: 'NonRegle', statut: 'absent',    dateISO: '2026-09-09', heure: '11:00' },
  { eleveId: 2, classe: 'A', nom: 'NonRegle', statut: 'absent',    dateISO: '2026-09-08', heure: '09:00' },
  { eleveId: 3, classe: 'A', nom: 'Mixte',    statut: 'justifie_d', dateISO: '2026-09-02', heure: '09:00' },
  { eleveId: 3, classe: 'A', nom: 'Mixte',    statut: 'absent',    dateISO: '2026-09-03', heure: '09:00' }
];
const map = {};
absences.forEach(a => {
  if (a.statut !== 'justifie_s' && a.statut !== 'justifie_d') return;
  const cle = a.eleveId + '|' + a.classe;
  if (!map[cle]) map[cle] = { nom: a.nom, classe: a.classe, count: 0, dernier: '' };
  map[cle].count++;
  const dt = String(a.dateISO || '') + ' ' + String(a.heure || '');
  if (dt > map[cle].dernier) map[cle].dernier = dt;
});
const liste = Object.values(map).sort((a, b) => {
  if (b.count !== a.count) return b.count - a.count;
  return String(b.dernier).localeCompare(String(a.dernier));
});
console.log('affiches:', liste.map(x => x.nom + '=' + x.count).join(' | ') || 'aucun');
console.log('NonRegle visible ?', liste.some(x => x.nom === 'NonRegle'));
'''
io.open('_test_filtre.js', 'w', encoding='utf-8').write(test)
print('TEST:', subprocess.run([node, '_test_filtre.js'], capture_output=True, text=True).stdout.strip())
