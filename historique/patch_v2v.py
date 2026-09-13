# -*- coding: utf-8 -*-
"""v3.1 -> v3.2 : abrev. matieres, sans duree dans la liste, pluriels des totaux."""
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

# 1. helper abreviations (place juste apres libelleSeance)
plain('1-helper',
      """function libelleEleve(e) {""",
      """function abrevMatiere(m) {
  if (!m) return '-';
  const t = String(m).trim();
  const s = t.toLowerCase();
  if (s.indexOf('math') >= 0) return 'MATH';
  if (s.indexOf('physique') >= 0 || s === 'pc') return 'PC';
  if (s.indexOf('fran') >= 0) return 'FR';
  if (s.indexOf('arabe') >= 0 || s === 'ar') return 'AR';
  if (s.indexOf('svt') >= 0 || s.indexOf('science') >= 0) return 'SVT';
  if (s.indexOf('anglais') >= 0) return 'ANG';
  if (s.indexOf('histoire') >= 0 || s.indexOf('géo') >= 0) return 'HG';
  if (s.indexOf('philo') >= 0) return 'PHILO';
  if (s.indexOf('islam') >= 0 || s.indexOf('ducation') >= 0) return 'EI';
  if (s.indexOf('eps') >= 0 || s.indexOf('sport') >= 0) return 'EPS';
  if (s.indexOf('info') >= 0) return 'INFO';
  return t.toUpperCase();
}

function libelleEleve(e) {""")

# 2. totaux : singulier / pluriel
plain('2-totaux',
      "ligneFiche('Totaux', nbAbs + ' absence(s) · ' + nbRet + ' retard(s)');",
      """ligneFiche('Totaux', nbAbs + ' ' + (nbAbs < 2 ? 'absence' : 'absences') + ' · ' + nbRet + ' ' + (nbRet < 2 ? 'retard' : 'retards'));""")

# 3. liste Ab/Rd : plus de duree, matiere abregee
plain('3-liste',
      "      const info = (a.duree ? '(' + a.duree + ') ' : '') + (a.matiere || '') + ' · ' + (a.enseignant || '') + (a.motif ? ' · Motif : ' + a.motif : '');",
      "      const info = abrevMatiere(a.matiere) + ' · ' + (a.enseignant || '') + (a.motif ? ' · Motif : ' + a.motif : '');")

# 4. popup detail : matiere abregee aussi
plain('4-detail',
      "document.getElementById('detail-matiere').textContent = abs.matiere || '-';",
      "document.getElementById('detail-matiere').textContent = abrevMatiere(abs.matiere);")

# 5. version
plain('5-version', 'AbsenceTrack v3.1 \u2014 Prototype', 'AbsenceTrack v3.2 \u2014 Prototype')

io.open(F, 'w', encoding='utf-8').write(data)
fails = [r for r in results if not r[1]]
for label, ok, c in results:
    print(('PASS ' if ok else 'FAIL ') + label + ' (' + str(c) + ')')
print('TOTAL', len(results), 'PASS', len(results) - len(fails), 'FAIL', len(fails))
for pat, att in [('abrevMatiere', 3), ("nbAbs < 2 ? 'absence'", 1), ("(a.duree ? '(' + a.duree", 0)]:
    c = data.count(pat)
    print('RESIDU', repr(pat), c, 'OK' if c == att else '!!ATTENDU ' + str(att))

node = shutil.which('node') or shutil.which('nodejs')
mm = re.search(r'<script>(.*)</script>', data, re.DOTALL)
io.open('_check33.js', 'w', encoding='utf-8').write(mm.group(1))
p = subprocess.run([node, '--check', '_check33.js'], capture_output=True, text=True)
print('NODE_CHECK', 'OK' if p.returncode == 0 else 'FAIL\n' + p.stderr[:1000])

# test des abreviations
fn = re.search(r'function abrevMatiere\(m\) \{.*?\n\}', data, re.DOTALL).group(0)
test = fn + '''
const cas = ['Mathématiques', 'Physique', 'Physique-Chimie', 'Français', 'Arabe', 'SVT', 'Anglais', 'Histoire-Géographie', 'Philosophie', 'Éducation islamique', 'EPS', 'Informatique', 'Dessin', '', null];
console.log(cas.map(c => JSON.stringify(c) + ' -> ' + abrevMatiere(c)).join('\\n'));
'''
io.open('_test_abrev.js', 'w', encoding='utf-8').write(test)
print(subprocess.run([node, '_test_abrev.js'], capture_output=True, text=True).stdout.strip())
