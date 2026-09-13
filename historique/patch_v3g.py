# -*- coding: utf-8 -*-
"""v3.15 -> v3.16 : bordure gauche des cartes Ab/Rd lisible en theme sombre."""
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

# 1. helper eclaircir (a cote de teinte)
plain('1-helper',
      """function teinte(hex, alpha) {""",
      """function eclaircir(hex, ratio) {
  const r = parseInt(hex.slice(1, 3), 16);
  const v = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const melange = c => Math.round(c + (255 - c) * ratio);
  return '#' + [melange(r), melange(v), melange(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

function teinte(hex, alpha) {""")

# 2. bordure gauche + fond adaptes au theme
plain('2-bordure',
      """    const couleur = cocheRetard ? palAbsRd.rd : palAbsRd.abs;
    const fond = teinte(couleur, 0.10);""",
      """    const couleur = cocheRetard ? palAbsRd.rd : palAbsRd.abs;
    const enSombre = document.body.classList.contains('theme-sombre');
    const couleurBordure = enSombre ? eclaircir(couleur, 0.35) : couleur;
    const fond = teinte(couleur, enSombre ? 0.20 : 0.10);""")

plain('3-style',
      "    item.style = estCoche ? ('border-left: 5px solid ' + couleur + '; background: ' + fond) : 'border-left: 5px solid transparent';",
      "    item.style = estCoche ? ('border-left: 5px solid ' + couleurBordure + '; background: ' + fond) : 'border-left: 5px solid transparent';")

# 3. supprimer la declaration dupliquee de enSombre (plus bas dans la boucle)
plain('4-doublon',
      "    const enSombre = document.body.classList.contains('theme-sombre');\n    const styleChip =",
      "    const styleChip =")

plain('5-version', 'AbsenceTrack v3.15 \u2014 Prototype', 'AbsenceTrack v3.16 \u2014 Prototype')

io.open(F, 'w', encoding='utf-8').write(data)
fails = [r for r in results if not r[1]]
for label, ok, c in results:
    print(('PASS ' if ok else 'FAIL ') + label + ' (' + str(c) + ')')
print('TOTAL', len(results), 'PASS', len(results) - len(fails), 'FAIL', len(fails))
for pat, att in [('enSombre', 5), ('couleurBordure', 2), ('eclaircir', 2)]:
    print('RESIDU', pat, data.count(pat), '(attendu', att, ')')

node = shutil.which('node') or shutil.which('nodejs')
m = re.search(r'<script>(.*)</script>', data, re.DOTALL)
io.open('/data/data/com.termux/files/home/AbsenceTrack-dev/_check49.js', 'w', encoding='utf-8').write(m.group(1))
p = subprocess.run([node, '--check', '/data/data/com.termux/files/home/AbsenceTrack-dev/_check49.js'], capture_output=True, text=True)
print('NODE_CHECK', 'OK' if p.returncode == 0 else 'FAIL\n' + p.stderr[:1200])

# test de la fonction eclaircir
fn = re.search(r'function eclaircir\(hex, ratio\) \{.*?\n\}', data, re.DOTALL).group(0)
io.open('/data/data/com.termux/files/home/AbsenceTrack-dev/_test_ecl.js', 'w', encoding='utf-8').write(fn + """
console.log('#ef4444 +35% ->', eclaircir('#ef4444', 0.35));
console.log('#f59e0b +35% ->', eclaircir('#f59e0b', 0.35));
console.log('#566C9D +35% ->', eclaircir('#566C9D', 0.35));
""")
print(subprocess.run([node, '/data/data/com.termux/files/home/AbsenceTrack-dev/_test_ecl.js'], capture_output=True, text=True).stdout.strip())
