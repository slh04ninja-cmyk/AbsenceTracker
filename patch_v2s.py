# -*- coding: utf-8 -*-
"""v2.8 -> v2.9 : tri de l'historique = total Ab/Rd decroissant puis datetime."""
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

plain('1-tri',
      """  const map = {};
  absences.forEach(a => {
    const cle = a.eleveId + '|' + a.classe;
    if (!map[cle]) map[cle] = { nom: a.nom, classe: a.classe, count: 0 };
    map[cle].count++;
  });
  const liste = Object.values(map).sort((a, b) => b.count - a.count);""",
      """  const map = {};
  absences.forEach(a => {
    const cle = a.eleveId + '|' + a.classe;
    if (!map[cle]) map[cle] = { nom: a.nom, classe: a.classe, count: 0, dernier: '' };
    map[cle].count++;
    const dt = String(a.dateISO || '') + ' ' + String(a.heure || '');
    if (dt > map[cle].dernier) map[cle].dernier = dt;
  });
  // Tri : total (Ab+Rd) decroissant, puis datetime la plus recente
  const liste = Object.values(map).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return String(b.dernier).localeCompare(String(a.dernier));
  });""")

plain('2-version', 'AbsenceTrack v2.8 \u2014 Prototype', 'AbsenceTrack v2.9 \u2014 Prototype')

io.open(F, 'w', encoding='utf-8').write(data)
fails = [r for r in results if not r[1]]
for label, ok, c in results:
    print(('PASS ' if ok else 'FAIL ') + label + ' (' + str(c) + ')')
print('TOTAL', len(results), 'PASS', len(results) - len(fails), 'FAIL', len(fails))
print('RESIDU dernier:', data.count("dernier: ''"), '| tri:', data.count('total (Ab+Rd) decroissant'))

node = shutil.which('node') or shutil.which('nodejs')
mm = re.search(r'<script>(.*)</script>', data, re.DOTALL)
io.open('_check30.js', 'w', encoding='utf-8').write(mm.group(1))
p = subprocess.run([node, '--check', '_check30.js'], capture_output=True, text=True)
print('NODE_CHECK', 'OK' if p.returncode == 0 else 'FAIL\n' + p.stderr[:1200])

# test reel du tri
test = '''
const absences = [
  { eleveId: 1, classe: 'A', nom: 'E1', dateISO: '2026-09-01', heure: '08:00' },
  { eleveId: 1, classe: 'A', nom: 'E1', dateISO: '2026-09-05', heure: '10:00' },
  { eleveId: 1, classe: 'A', nom: 'E1', dateISO: '2026-09-05', heure: '08:00' },
  { eleveId: 2, classe: 'A', nom: 'E2', dateISO: '2026-09-09', heure: '11:00' },
  { eleveId: 2, classe: 'A', nom: 'E2', dateISO: '2026-09-09', heure: '09:00' },
  { eleveId: 2, classe: 'A', nom: 'E2', dateISO: '2026-09-02', heure: '09:00' },
  { eleveId: 3, classe: 'A', nom: 'E3', dateISO: '2026-09-10', heure: '16:00' },
  { eleveId: 3, classe: 'A', nom: 'E3', dateISO: '2026-09-10', heure: '14:00' },
  { eleveId: 3, classe: 'A', nom: 'E3', dateISO: '2026-09-08', heure: '14:00' },
  { eleveId: 3, classe: 'A', nom: 'E3', dateISO: '2026-09-07', heure: '14:00' },
  { eleveId: 4, classe: 'A', nom: 'E4', dateISO: '2026-09-03', heure: '15:00' }
];
const map = {};
absences.forEach(a => {
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
console.log(liste.map(x => x.nom + '=' + x.count + ' (' + x.dernier + ')').join(' | '));
'''
io.open('_test_tri2.js', 'w', encoding='utf-8').write(test)
print('TRI:', subprocess.run([node, '_test_tri2.js'], capture_output=True, text=True).stdout.strip())
