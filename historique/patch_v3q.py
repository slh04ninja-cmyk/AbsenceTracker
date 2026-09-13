# -*- coding: utf-8 -*-
"""AbsenceTrack v3.27 : le DIRECTEUR prend le style du SURVEILLANT (lot 5) en theme clair.

Methode : on ne recopie pas les regles a la main, on DUPLIQUE automatiquement chaque
selecteur contenant '.role-surveillant' en '.role-directeur' dans la feuille de style,
puis on declare les variables du lot 5 pour body.role-directeur.
"""
import io, re, sys, shutil, subprocess

F = 'AbsenceTrack-v2.html'
s = io.open(F, encoding='utf-8').read()
n0 = len(s)
allok = True

# ---------- 1. variables du lot 5 pour le directeur ----------
VAR = "    body.role-directeur { --lot-primaire: #566C9D; --lot-fonce: #3D3E4E; --lot-accent: #EB7F69; }\n"
new, c = re.subn(r"(    body\.role-surveillant \{ --lot-primaire[^\n]*\n)", r"\1" + VAR, s)
print(('OK   ' if c == 1 else 'ECHEC') + ' vars lot 5 directeur  =%d' % c)
allok &= (c == 1)
s = new if c == 1 else s

# ---------- 2. duplication des selecteurs dans la feuille de style ----------
debut = s.index('<style>')
fin = s.index('</style>')
css = s[debut:fin]
nb_surv = css.count('.role-surveillant')

def dupliquer(m):
    sel = m.group(1)
    if '.role-surveillant' not in sel or '.role-directeur' in sel:
        return m.group(0)
    ajouts = [x.strip().replace('.role-surveillant', '.role-directeur')
              for x in sel.split(',') if '.role-surveillant' in x]
    return sel + ', ' + ', '.join(ajouts) + ' {'

css2, n = re.subn(r'([^{}]+)\{', dupliquer, css)
css2 = css2.replace('.role-surveillant, .role-directeur,', '.role-surveillant, .role-directeur,')  # no-op lisible
nb_dir = css2.count('.role-directeur')
print('OK   selecteurs surveillant = %d  ->  nouveaux selecteurs directeur = %d' % (nb_surv, nb_dir - 1))
allok &= (nb_dir - 1 == nb_surv)

if css2.count('{') != css2.count('}'):
    print('ECHEC accolades CSS apres duplication')
    allok = False
print(('OK   ' if css2.count('{') == css2.count('}') else 'ECHEC') + ' accolades CSS %d/%d' % (css2.count('{'), css2.count('}')))

if not allok:
    print('PATCH ANNULE')
    sys.exit(1)

s = s[:debut] + css2 + s[fin:]

# ---------- 3. table des lots (coherence des donnees) ----------
new, c = re.subn(r"(  surveillant: \{ primaire: '#566C9D', fonce: '#3D3E4E', accent: '#EB7F69' \})\n",
                 r"\1,\n  directeur:   { primaire: '#566C9D', fonce: '#3D3E4E', accent: '#EB7F69' }\n", s)
print(('OK   ' if c == 1 else 'ECHEC') + ' table LOTS_ROLE      =%d' % c)
allok &= (c == 1)
s = new if c == 1 else s

# ---------- 4. version ----------
s, c = re.subn(r'AbsenceTrack v3\.26', 'AbsenceTrack v3.27', s)
print(('OK   ' if c == 1 else 'ECHEC') + ' version -> v3.27      =%d' % c)
assert c == 1

io.open(F, 'w', encoding='utf-8').write(s)
print('--- taille %d -> %d octets ---' % (n0, len(s)))

# ---------- verifications ----------
style = s[s.index('<style>'):s.index('</style>')]
for cle in ['body.role-directeur { --lot-primaire', '.role-directeur .appbar', '.role-directeur .btn-primary',
            '.role-directeur .stat-card-absences', '.role-directeur .sd-panel', '.role-directeur select']:
    n = style.count(cle)
    print(('OK   ' if n >= 1 else 'ECHEC') + ' %-38s =%d' % (cle, n))
    allok &= (n >= 1)
print(('OK   ' if 'role-directeur .nav-item.active' in style else 'ECHEC') + ' nav-item directeur')
allok &= ('role-directeur .nav-item.active' in style)

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
