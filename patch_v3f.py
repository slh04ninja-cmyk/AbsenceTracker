# -*- coding: utf-8 -*-
"""v3.14 -> v3.15 : noms des eleves lisibles en theme sombre (dashboard enseignant)."""
import io, re, shutil, subprocess

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

# 1. couleurs des lignes adaptees au theme
plain('1-lignes',
      """    const styleChip = estCoche ? ('background: ' + couleur + '; color: #fff;') : 'background: #dbeafe; color: #1e3a8a;';""",
      """    const enSombre = document.body.classList.contains('theme-sombre');
    const styleChip = estCoche ? ('background: ' + couleur + '; color: #fff;') : (enSombre ? 'background: #334155; color: #bfdbfe;' : 'background: #dbeafe; color: #1e3a8a;');""")

plain('2-nom',
      "    const styleNom = estCoche ? ('color: ' + couleur + '; font-weight: 600;') : 'color: #1f2937;';",
      "    const styleNom = estCoche ? ('color: ' + couleur + '; font-weight: 600;') : ((document.body.classList.contains('theme-sombre') ? '#e2e8f0' : '#1f2937'));")

# 2. le basculement de theme rafraichit la liste (les couleurs sont en style inline)
plain('3-refresh',
      """function basculerTheme() {
  localStorage.setItem('prefTheme', localStorage.getItem('prefTheme') === 'sombre' ? 'clair' : 'sombre');
  appliquerTheme();
}""",
      """function basculerTheme() {
  localStorage.setItem('prefTheme', localStorage.getItem('prefTheme') === 'sombre' ? 'clair' : 'sombre');
  appliquerTheme();
  // Les lignes eleves utilisent des couleurs en style inline : on les redessine
  if (typeof classeSelectionnee !== 'undefined' && classeSelectionnee) afficherListeEleves();
}""")

plain('4-version', 'AbsenceTrack v3.14 \u2014 Prototype', 'AbsenceTrack v3.15 \u2014 Prototype')

io.open(F, 'w', encoding='utf-8').write(data)
fails = [r for r in results if not r[1]]
for label, ok, c in results:
    print(('PASS ' if ok else 'FAIL ') + label + ' (' + str(c) + ')')
print('TOTAL', len(results), 'PASS', len(results) - len(fails), 'FAIL', len(fails))
for pat, att in [('#e2e8f0', 4), ('enSombre', 1), ('afficherListeEleves();\n}', 1)]:
    print('RESIDU', pat, data.count(pat), '(attendu', att, ')')

node = shutil.which('node') or shutil.which('nodejs')
m = re.search(r'<script>(.*)</script>', data, re.DOTALL)
io.open('/data/data/com.termux/files/home/AbsenceTrack-dev/_check48.js', 'w', encoding='utf-8').write(m.group(1))
p = subprocess.run([node, '--check', '/data/data/com.termux/files/home/AbsenceTrack-dev/_check48.js'], capture_output=True, text=True)
print('NODE_CHECK', 'OK' if p.returncode == 0 else 'FAIL\n' + p.stderr[:1200])
print('DIVS', data.count('<div'), data.count('</div>'))
