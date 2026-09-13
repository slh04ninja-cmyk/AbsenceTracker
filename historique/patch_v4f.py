# -*- coding: utf-8 -*-
"""AbsenceTrack v3.44 : cartes plus basses (padding haut/bas reduit).

- cartes d'eleves (.carte-eleve) des pages DIRECTEUR et SURVEILLANT (Dashboard + Historique) :
  height 60 -> 44 px et padding vertical 10 -> 4 px (le padding horizontal reste 14 px).
  Cible par role pour ne pas toucher les pages enseignant (« on a deja fini avec l'enseignant »).
- Gestion (directeur) : cartes de classe px-4 py-2 -> px-4 py-1.5 et lignes d'eleves du popup
  p-3 / mb-2 -> px-3 py-1.5 / mb-1.
"""
import io, re, sys, shutil, subprocess

F = 'AbsenceTrack-v2.html'
s = io.open(F, encoding='utf-8').read()
n0 = len(s)
allok = True

def remplace(label, a, b, n=1):
    global s
    c = s.count(a)
    print(('OK   ' if c == n else 'ECHEC') + ' %-46s =%d (attendu %d)' % (label, c, n))
    if c == n:
        s = s.replace(a, b)
    return c == n

# ---------- 1. CSS : cartes d'eleves plus basses pour directeur / surveillant ----------
ANCRE = "    body.theme-sombre .carte-eleve { background: #1e293b !important; border-color: #334155 !important; box-shadow: none; }\n"
CSS = """    /* Cartes d'eleves plus compactes (directeur + surveillant uniquement) */
    body.role-directeur .carte-eleve,
    body.role-surveillant .carte-eleve { height: 44px; padding: 4px 14px; }
"""
allok &= remplace('cartes d eleves compactes (CSS)', ANCRE, ANCRE + CSS)

# ---------- 2. Gestion : cartes de classe plus basses ----------
allok &= remplace('carte de classe compacte',
                  "    item.className = 'bg-gray-50 rounded-xl px-4 py-2 cursor-pointer';",
                  "    item.className = 'bg-gray-50 rounded-xl px-4 py-1.5 cursor-pointer';")

# ---------- 3. Gestion : lignes d'eleves du popup plus basses ----------
allok &= remplace('lignes du popup de classe compactes',
                  """      `<div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg mb-2">
        <div>
          <span class="font-medium">${libelleEleve(e)}</span>""",
                  """      `<div class="flex justify-between items-center px-3 py-1.5 bg-gray-50 rounded-lg mb-1">
        <div>
          <span class="font-medium">${libelleEleve(e)}</span>""")

if not allok:
    print('PATCH ANNULE')
    sys.exit(1)

s, c = re.subn(r'AbsenceTrack v3\.43', 'AbsenceTrack v3.44', s)
print(('OK   ' if c == 1 else 'ECHEC') + ' version -> v3.44 =%d' % c)
assert c == 1

io.open(F, 'w', encoding='utf-8').write(s)
print('--- taille %d -> %d octets ---' % (n0, len(s)))

# ---------- verifications ----------
for cle, attendu in [('body.role-directeur .carte-eleve,', 1), ('body.role-surveillant .carte-eleve', 1),
                     ('height: 44px; padding: 4px 14px;', 1),
                     ("bg-gray-50 rounded-xl px-4 py-1.5 cursor-pointer", 1),
                     ('items-center px-3 py-1.5 bg-gray-50 rounded-lg mb-1', 1),
                     ('p-3 bg-gray-50 rounded-lg mb-2', 0),
                     ("px-4 py-2 cursor-pointer", 0),
                     ('id="page-profil"', 1), ('id="page-dir-stats"', 1)]:
    n = s.count(cle)
    print(('OK   ' if n == attendu else 'ECHEC') + ' %-56s = %d' % (cle, n))
    allok &= (n == attendu)

o = s.count('<div'); f = s.count('</div>')
print(('OK   ' if o == f else 'ECHEC') + ' divs %d/%d' % (o, f))
allok &= (o == f)

js = '\n'.join(re.findall(r'<script[^>]*>(.*?)</script>', s, re.S))
io.open('_check.js', 'w', encoding='utf-8').write(js)
r = subprocess.run([shutil.which('node'), '--check', '_check.js'], capture_output=True, text=True)
print(('OK   ' if r.returncode == 0 else 'ECHEC') + ' node --check ' + (r.stderr.strip()[:300] or ''))
allok &= (r.returncode == 0)

print('\n=== ' + ('TOUT OK' if allok else 'PROBLEME') + ' ===')
sys.exit(0 if allok else 1)
