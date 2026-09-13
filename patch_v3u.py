# -*- coding: utf-8 -*-
"""AbsenceTrack v3.31 : tracer QUI a approuve la justification (Surveillant / Directeur).

- nouveaux helpers codeApprobation(abs) -> 'S1' | 'S2' | 'S' | 'D' | ''  et libelleStatutAbs(abs)
- liste des Ab/Rd de l'historique : les marques deviennent 'Ab - S1', 'Rd - D', ...
- badge du tableau des absences du directeur : 'Justifiee S1' / 'Justifiee D'
- toast de confirmation et export Excel : 'Justifiee S1' / 'Justifiee D'
"""
import io, re, sys, shutil, subprocess

F = 'AbsenceTrack-v2.html'
s = io.open(F, encoding='utf-8').read()
n0 = len(s)
allok = True

HELPERS = """
// Qui a approuve la justification : S1 / S2 (surveillant) ou D (directeur)
function codeApprobation(a) {
  if (!a) return '';
  const par = String(a.justifiePar || '');
  if (/directeur/i.test(par)) return 'D';
  const num = par.match(/\\d+/);
  if (num) return 'S' + num[0];
  if (/surveillant/i.test(par)) return 'S';
  if (a.statut === 'justifie_d') return 'D';
  if (a.statut === 'justifie_s') return 'S';
  return '';
}

function libelleStatutAbs(a) {
  const code = codeApprobation(a);
  if (a.statut === 'justifie_s') return 'Justifiée ' + (code || 'S');
  if (a.statut === 'justifie_d') return 'Justifiée D';
  return libelleStatut(a.statut);
}
"""

ANCRE = """function libelleStatut(s) {
  if (s === 'justifie_s') return 'Justifiée S';
  if (s === 'justifie_d') return 'Justifiée D';
  return 'Non justifiée';
}
"""
n = s.count(ANCRE)
print(('OK   ' if n == 1 else 'ECHEC') + ' libelleStatut trouve   =%d' % n)
allok &= (n == 1)
s = s.replace(ANCRE, ANCRE + HELPERS)

def rep(label, a, b, n=1):
    global s
    new, c = re.subn(a, b, s, flags=re.S)
    ok = (c == n)
    print(('OK   ' if ok else 'ECHEC') + ' %-26s =%d (attendu %d)' % (label, c, n))
    if ok:
        s = new
    return ok

allok &= rep('marques Ab/Rd historique', r"      const marque = retard \? 'Rd' : 'Ab';\n",
             "      const code = codeApprobation(a);\n      const marque = (retard ? 'Rd' : 'Ab') + (code ? ' - ' + code : '');\n")
allok &= rep('badge tableau directeur', r'<td><span class="badge \$\{badgeClass\}">\$\{libelleStatut\(abs\.statut\)\}</span></td>',
             '<td><span class="badge ${badgeClass}">${libelleStatutAbs(abs)}</span></td>')
allok &= rep('toast de justification', r"afficherToast\(libelleStatut\(abs\.statut\) \+ ' · ' \+ abs\.motif, 'success'\);",
             "afficherToast(libelleStatutAbs(abs) + ' · ' + abs.motif, 'success');")
allok &= rep('export excel', r"    Statut: libelleStatut\(a\.statut\),",
             "    Statut: libelleStatutAbs(a),")

if not allok:
    print('PATCH ANNULE')
    sys.exit(1)

s, c = re.subn(r'AbsenceTrack v3\.30', 'AbsenceTrack v3.31', s)
print(('OK   ' if c == 1 else 'ECHEC') + ' version -> v3.31        =%d' % c)
assert c == 1

io.open(F, 'w', encoding='utf-8').write(s)
print('--- taille %d -> %d octets ---' % (n0, len(s)))

for cle, attendu in [('function codeApprobation', 2), ('function libelleStatutAbs', 2),
                     ("codeApprobation(a)", 3), ('libelleStatutAbs(abs)', 2), ('libelleStatutAbs(a)', 1)]:
    n = s.count(cle)
    print(('OK   ' if n == attendu else 'ECHEC') + ' %-28s = %d' % (cle, n))
    allok &= (n == attendu)

n = s.count("libelleStatut(abs.statut)")
print(('OK   ' if n == 0 else 'ECHEC') + ' anciens appels statut     = %d' % n)
allok &= (n == 0)

o = s.count('<div'); f = s.count('</div>')
print(('OK   ' if o == f else 'ECHEC') + ' divs %d/%d' % (o, f))
allok &= (o == f)

js = '\n'.join(re.findall(r'<script[^>]*>(.*?)</script>', s, re.S))
io.open('_check.js', 'w', encoding='utf-8').write(js)
r = subprocess.run([shutil.which('node'), '--check', '_check.js'], capture_output=True, text=True)
print(('OK   ' if r.returncode == 0 else 'ECHEC') + ' node --check ' + (r.stderr.strip()[:200] or ''))
allok &= (r.returncode == 0)

print('\n=== ' + ('TOUT OK' if allok else 'PROBLEME') + ' ===')
sys.exit(0 if allok else 1)
