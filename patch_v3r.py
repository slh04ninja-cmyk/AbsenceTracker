# -*- coding: utf-8 -*-
"""AbsenceTrack v3.28 : la carte du haut du Dashboard DIRECTEUR prend le design de
celle du Dashboard surveillant (.stat-card-absences : degrade + 3 blocs separes).
Les 3 indicateurs du directeur sont conserves (Eleves / Classes / Absents du jour)
et le JS n'a pas besoin de changer : les identifiants dir-eleves / dir-classes /
dir-absents sont repartis dans la nouvelle carte.
"""
import io, re, sys, shutil, subprocess

F = 'AbsenceTrack-v2.html'
s = io.open(F, encoding='utf-8').read()
n0 = len(s)
allok = True

AVANT = """      <div class="grid grid-cols-3 gap-2 mb-4">
        <div class="stat-card stat-mini">
          <div class="stat-label text-xs">Élèves</div>
          <div class="stat-value text-2xl" id="dir-eleves">0</div>
        </div>
        <div class="stat-card stat-mini">
          <div class="stat-label text-xs">Classes</div>
          <div class="stat-value text-2xl" id="dir-classes">0</div>
        </div>
        <div class="stat-card stat-mini">
          <div class="stat-label text-xs">Absents</div>
          <div class="stat-value text-2xl text-red-600" id="dir-absents">0</div>
        </div>
      </div>"""

APRES = """      <div class="stat-card-absences">
        <div class="absences-grid">
          <div class="absence-item">
            <div class="absence-label">Élèves</div>
            <div class="absence-value" id="dir-eleves">0</div>
            <div class="absence-subtext">inscrits</div>
          </div>
          <div class="absence-divider"></div>
          <div class="absence-item">
            <div class="absence-label">Classes</div>
            <div class="absence-value" id="dir-classes">0</div>
            <div class="absence-subtext">au total</div>
          </div>
          <div class="absence-divider"></div>
          <div class="absence-item">
            <div class="absence-label">Absents</div>
            <div class="absence-value" id="dir-absents">0</div>
            <div class="absence-subtext">aujourd'hui</div>
          </div>
        </div>
      </div>"""

n = s.count(AVANT)
print(('OK   ' if n == 1 else 'ECHEC') + ' ancienne carte trouvee =%d' % n)
allok &= (n == 1)
if n != 1:
    print('PATCH ANNULE')
    sys.exit(1)
s = s.replace(AVANT, APRES)

s, c = re.subn(r'AbsenceTrack v3\.27', 'AbsenceTrack v3.28', s)
print(('OK   ' if c == 1 else 'ECHEC') + ' version -> v3.28 =%d' % c)
assert c == 1

io.open(F, 'w', encoding='utf-8').write(s)
print('--- taille %d -> %d octets ---' % (n0, len(s)))

# ---------- verifications ----------
for cle, attendu in [('stat-card-absences', 2), ('absences-grid', 2), ('absence-divider', 3),
                     ('id="dir-eleves"', 2), ('id="dir-classes"', 2), ('id="dir-absents"', 2)]:
    n = s.count(cle)
    print(('OK   ' if n == attendu else 'ECHEC') + ' %-20s = %d (attendu %d)' % (cle, n, attendu))
    allok &= (n == attendu)
for cle in ['grid grid-cols-3 gap-2 mb-4', 'stat-card stat-mini']:
    n = s.count(cle)
    print(('OK   ' if n == 0 else 'ECHEC') + ' residu %-26s = %d' % (cle, n))
    allok &= (n == 0)
n = s.count('text-2xl text-red-600')
print(('OK   ' if n == 0 else 'ECHEC') + ' residu classe rouge =%d' % n)
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
