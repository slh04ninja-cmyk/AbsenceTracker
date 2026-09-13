# -*- coding: utf-8 -*-
"""AbsenceTrack v3.29 : la carte du Dashboard DIRECTEUR affiche les MEMES donnees que
celle du surveillant (NOUVEAU / heure actuelle, NON JUSTIFIEE / aujourd'hui, TOTAL / du jour).
Les identifiants sont renommes en dir-nouveaux / dir-nonjustifiees / dir-total et le JS
de mettreAJourDashboardDir() calcule exactement les memes valeurs que le surveillant.
"""
import io, re, sys, shutil, subprocess

F = 'AbsenceTrack-v2.html'
s = io.open(F, encoding='utf-8').read()
n0 = len(s)
allok = True

# ---------- 1. libelles de la carte ----------
CARTE_AVANT = """          <div class="absence-item">
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
          </div>"""

CARTE_APRES = """          <div class="absence-item">
            <div class="absence-label">Nouveau</div>
            <div class="absence-value" id="dir-nouveaux">0</div>
            <div class="absence-subtext">heure actuelle</div>
          </div>
          <div class="absence-divider"></div>
          <div class="absence-item">
            <div class="absence-label">Non justifiée</div>
            <div class="absence-value" id="dir-nonjustifiees">0</div>
            <div class="absence-subtext">aujourd'hui</div>
          </div>
          <div class="absence-divider"></div>
          <div class="absence-item">
            <div class="absence-label">Total</div>
            <div class="absence-value" id="dir-total">0</div>
            <div class="absence-subtext">du jour</div>
          </div>"""

n = s.count(CARTE_AVANT)
print(('OK   ' if n == 1 else 'ECHEC') + ' carte directeur trouvee =%d' % n)
allok &= (n == 1)
s = s.replace(CARTE_AVANT, CARTE_APRES)

# ---------- 2. calcul JS identique au surveillant ----------
JS_AVANT = """  const totalEleves = classes.reduce((sum, c) => sum + c.eleves.length, 0);
  const today = fmtDateISO(new Date());
  const absencesToday = absences.filter(a => a.dateISO === today);

  document.getElementById('dir-eleves').textContent = totalEleves;
  document.getElementById('dir-classes').textContent = classes.length;
  document.getElementById('dir-absents').textContent = absencesToday.length;"""

JS_APRES = """  // Memes indicateurs que le Dashboard du surveillant (etablissement entier)
  const maintenant = new Date();
  const today = fmtDateISO(maintenant);
  const heureCourante = String(maintenant.getHours()).padStart(2, '0');
  const absencesToday = absences.filter(a => a.dateISO === today);
  const nouveauxCetteHeure = absencesToday.filter(a => a.heure && a.heure.startsWith(heureCourante)).length;
  const nonJustifieesJour = absencesToday.filter(a => a.statut === 'absent').length;

  document.getElementById('dir-nouveaux').textContent = nouveauxCetteHeure;
  document.getElementById('dir-nonjustifiees').textContent = nonJustifieesJour;
  document.getElementById('dir-total').textContent = absencesToday.length;"""

n = s.count(JS_AVANT)
print(('OK   ' if n == 1 else 'ECHEC') + ' calcul JS trouve     =%d' % n)
allok &= (n == 1)
s = s.replace(JS_AVANT, JS_APRES)

if not allok:
    print('PATCH ANNULE')
    sys.exit(1)

s, c = re.subn(r'AbsenceTrack v3\.28', 'AbsenceTrack v3.29', s)
print(('OK   ' if c == 1 else 'ECHEC') + ' version -> v3.29      =%d' % c)
assert c == 1

io.open(F, 'w', encoding='utf-8').write(s)
print('--- taille %d -> %d octets ---' % (n0, len(s)))

# ---------- verifications ----------
for cle, attendu in [('id="dir-nouveaux"', 1), ('id="dir-nonjustifiees"', 1), ('id="dir-total"', 1),
                     ("getElementById('dir-nouveaux')", 1), ("getElementById('dir-nonjustifiees')", 1),
                     ("getElementById('dir-total')", 1)]:
    n = s.count(cle)
    print(('OK   ' if n == attendu else 'ECHEC') + ' %-32s = %d' % (cle, n))
    allok &= (n == attendu)
for cle in ['dir-eleves', 'id="dir-classes"', 'dir-absents']:
    n = s.count(cle)
    print(('OK   ' if n == 0 else 'ECHEC') + ' residu %-26s = %d' % (cle, n))
    allok &= (n == 0)
n = s.count("getElementById('dir-classes-list')")
print(('OK   ' if n == 1 else 'ECHEC') + ' dir-classes-list intact  = %d' % n)
allok &= (n == 1)
n = s.count('totalEleves')
print(('OK   ' if n == 0 else 'ECHEC') + ' totalEleves supprime     = %d' % n)
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
