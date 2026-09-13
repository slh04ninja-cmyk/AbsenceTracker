# -*- coding: utf-8 -*-
"""AbsenceTrack v3.23 : page Stats enseignant = epuration.
- filtres : suppression de 'Seance' et 'Perimetre'
- graphiques : suppression de 'Evolution', 'Matin / Apres-midi', 'Par jour de la semaine'
- suppression de la carte 'A surveiller'
"""
import io, re, sys, shutil, subprocess

F = 'AbsenceTrack-v2.html'
s = io.open(F, encoding='utf-8').read()
n0 = len(s)

def rx(label, pat, repl, n):
    global s
    new, c = re.subn(pat, repl, s, flags=re.S)
    ok = (c == n)
    print(('OK   ' if ok else 'ECHEC') + ' %-38s occurrences=%d (attendu %d)' % (label, c, n))
    if ok:
        s = new
    return ok

# motif "bloc de lignes" : demarre a l'indentation de <div>, s'arrete a la ligne </div> seule
def bloc(tete):
    return r' *<div>\n *<label class="block text-xs font-bold text-blue-900 mb-1">' + re.escape(tete) + r'</label>\n(?: *<[^\n]*\n)*? *</div>\n'

def carte(titre):
    return (r' *<div class="stat-card">\n *<div class="stat-label mb-4">' + re.escape(titre) +
            r'.*?\n(?: *<[^\n]*\n)*? *</div>\n')

allok = True
allok &= rx('filtre Seance (html)', bloc('Séance'), '', 1)
allok &= rx('filtre Perimetre (html)', bloc('Périmètre'), '', 1)
allok &= rx('carte Evolution (html)', carte('Évolution'), '', 1)
allok &= rx('carte Matin/Apres-midi (html)', carte('Matin / Après-midi'), '', 1)
allok &= rx('carte Par jour de semaine (html)', carte('Par jour de la semaine'), '', 1)
allok &= rx('carte A surveiller (html)', carte('À surveiller'), '', 1)

# ---------- JS ----------
allok &= rx('vars stats (js)', r"let statsSeance = 'toutes';\nlet statsPerimetre = 'moi';\n", '', 1)
allok &= rx('lecture filtres (js)', r"  const s = val\('stats-seance'\); if \(s\) statsSeance = s;\n  const pe = val\('stats-perimetre'\); if \(pe\) statsPerimetre = pe;\n", '', 1)
allok &= rx('statsFiltre seance/perimetre (js)',
            r"    if \(statsSeance !== 'toutes' && \(a\.seance \|\| 'matin'\) !== statsSeance\) return false;\n    if \(statsPerimetre === 'moi' && a\.enseignant !== moi\) return false;\n",
            "    if (a.enseignant !== moi) return false;\n", 1)
allok &= rx('appel Evolution (js)', r"  // --- Evolution ---\n  barresStats\('chart-evolution', evolutionStats\(filtres, b\)\);\n\n", '', 1)
allok &= rx('fonction evolutionStats (js)', r"function evolutionStats\(filtres, b\) \{.*?\n\}\n\n", '', 1)
allok &= rx('bloc Matin/Apres-midi (js)', r"  // --- Matin / Apres-midi ---\n.*?\]\);\n\n(?=  // --- Par jour de semaine ---)", '', 1)
allok &= rx('bloc Par jour de semaine (js)', r"  // --- Par jour de semaine ---\n.*?barresStats\('chart-jour',.*?\)\);\n\n(?=  // --- Par classe)", '', 1)
allok &= rx('bloc A surveiller (js)', r"\n  const surveillerDiv = document\.getElementById\('stats-surveiller'\);\n  if \(surveillerDiv\) \{.*?\n  \}\n(?=\})", '', 1)

if not allok:
    print('PATCH ANNULE (aucune ecriture)')
    sys.exit(1)

s2, c = re.subn(r'AbsenceTrack v3\.22', 'AbsenceTrack v3.23', s)
print('%s version -> v3.23 occurrences=%d' % ('OK  ' if c == 1 else 'ECHEC', c))
if c != 1:
    sys.exit(1)
s = s2

io.open(F, 'w', encoding='utf-8').write(s)
print('--- taille %d -> %d octets ---' % (n0, len(s)))

for residu in ['stats-seance', 'stats-perimetre', 'statsSeance', 'statsPerimetre',
               'chart-evolution', 'chart-seance', 'chart-jour', 'stats-surveiller',
               'evolutionStats', 'À surveiller', 'Matin / Après-midi', 'Par jour de la semaine',
               'Périmètre', '>Séance<']:
    n = s.count(residu)
    print(('OK   ' if n == 0 else 'ECHEC') + ' residu %-24s = %d' % (residu, n))
    allok &= (n == 0)

o = s.count('<div'); f = s.count('</div>')
print(('OK   ' if o == f else 'ECHEC') + ' divs %d/%d' % (o, f))
allok &= (o == f)

js = '\n'.join(re.findall(r'<script[^>]*>(.*?)</script>', s, re.S))
io.open('_check.js', 'w', encoding='utf-8').write(js)
node = shutil.which('node') or shutil.which('nodejs')
r = subprocess.run([node, '--check', '_check.js'], capture_output=True, text=True)
print(('OK   ' if r.returncode == 0 else 'ECHEC') + ' node --check ' + (r.stderr.strip()[:200] or ''))
allok &= (r.returncode == 0)

print('\n=== ' + ('TOUT OK' if allok else 'PROBLEME') + ' ===')
sys.exit(0 if allok else 1)
