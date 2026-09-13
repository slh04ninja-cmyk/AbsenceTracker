# -*- coding: utf-8 -*-
"""AbsenceTrack v3.37 : Dashboard directeur allege + tendance dynamique sur la page Stats.

- Dashboard : suppression des cartes « Alertes importantes », « Classes critiques » et de la
  « Tendance hebdomadaire » (HTML + code JS correspondant).
- Page Stats (sous le Taux de presence) : nouvelle carte « Tendance X » dont le titre et le
  graphique suivent la periode choisie :
    Aujourd'hui  -> Tendance Journalier    : total Ab/Rd par heure
    Cette semaine-> Tendance Hebdomadaire  : total Ab/Rd par jour (Lun -> Dim)
    Ce mois      -> Tendance Mensuel       : total Ab/Rd par jour du mois
    Ce trimestre -> Tendance Trimestriel   : total Ab/Rd par semaine (S1, S2...)
    Personnalisée-> Tendance Personnalisée : par jour (<= 31 j) sinon par semaine
"""
import io, re, sys, shutil, subprocess

F = 'AbsenceTrack-v2.html'
s = io.open(F, encoding='utf-8').read()
n0 = len(s)
allok = True

def remplace(label, a, b, n=1):
    global s
    c = s.count(a)
    print(('OK   ' if c == n else 'ECHEC') + ' %-42s =%d (attendu %d)' % (label, c, n))
    if c == n:
        s = s.replace(a, b)
    return c == n

# ---------- 1. Dashboard : retirer les 3 cartes ----------
CARTES = """      <div class="stat-card mb-4">
        <div class="stat-label mb-4"><i class="fas fa-exclamation-triangle text-red-500 mr-1"></i> Alertes importantes</div>
        <div id="dir-alerts" class="space-y-2">
          <p class="text-gray-500 text-center py-4">Aucune alerte</p>
        </div>
      </div>
      <div class="stat-card mb-4">
        <div class="stat-label mb-4">Classes critiques (taux > 20%)</div>
        <div id="dir-critical-classes" class="space-y-2">
          <p class="text-gray-500 text-center py-4">Toutes les classes sont normales</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label mb-4">Tendance hebdomadaire</div>
        <div id="dir-tendance" class="chart-bar" style="height: 100px;"></div>
        <div class="h-8"></div>
      </div>
"""
allok &= remplace('retrait des 3 cartes du Dashboard', CARTES, '')

# ---------- 2. JS du dashboard : garder compteurs + liste ----------
d = s.index("  // Alertes\n")
f = s.index("\n}\n", d)
bloc_js = s[d:f]
assert 'dir-alerts' in bloc_js and 'dir-critical-classes' in bloc_js and 'dir-tendance' in bloc_js
s = s[:d] + s[f + 1:]
print('OK   code JS du dashboard supprime = %d caracteres' % len(bloc_js))

# ---------- 3. nouvelle carte Tendance sous le Taux de presence ----------
CARTE_TAUX = """      <div class="stat-card">
        <div class="stat-label">Taux de présence</div>
        <div class="stat-value" id="dir-stat-presence">—</div>
        <div class="progress-bar"><div class="progress-fill" id="dir-progress-presence" style="width: 0%"></div></div>
        <p class="text-xs text-gray-500 mt-2" id="dir-stat-presence-detail"></p>
      </div>
"""
CARTE_TENDANCE = """      <div class="stat-card">
        <div class="stat-label mb-4" id="dir-tendance-titre">Tendance</div>
        <div class="chart-bar" id="dir-chart-tendance" style="height: 100px;"></div>
        <div class="h-8"></div>
      </div>
"""
allok &= remplace('carte Tendance sous le taux', CARTE_TAUX, CARTE_TAUX + CARTE_TENDANCE)

# ---------- 4. JS de la tendance ----------
JS = """// Titre de la carte Tendance selon la periode choisie + donnees correspondantes
function libelleTendanceDir() {
  if (dirStatsPeriode === 'jour') return 'Journalier';
  if (dirStatsPeriode === 'semaine') return 'Hebdomadaire';
  if (dirStatsPeriode === 'mois') return 'Mensuel';
  if (dirStatsPeriode === 'trimestre') return 'Trimestriel';
  return 'Personnalisée';
}

function tendanceDirStats(filtres, b) {
  const parJour = {};
  filtres.forEach(a => { const c = String(a.dateISO || ''); parJour[c] = (parJour[c] || 0) + 1; });
  const out = [];

  // Aujourd'hui : total par heure
  if (dirStatsPeriode === 'jour') {
    const parHeure = {};
    filtres.forEach(a => { const h = String(a.heure || '').slice(0, 2) || '--'; parHeure[h] = (parHeure[h] || 0) + 1; });
    Object.keys(parHeure).sort().forEach(h => out.push({ label: h + 'h', valeur: parHeure[h] }));
    return out;
  }

  // Cette semaine : un point par jour, du lundi au dimanche
  if (dirStatsPeriode === 'semaine') {
    const noms = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    const auj = new Date();
    const lundi = new Date(auj);
    lundi.setDate(lundi.getDate() - ((auj.getDay() + 6) % 7));
    for (let i = 0; i < 7; i++) {
      const d = new Date(lundi);
      d.setDate(d.getDate() + i);
      out.push({ label: noms[i], valeur: parJour[fmtDateISO(d)] || 0 });
    }
    return out;
  }

  const debut = new Date(b.debut + 'T00:00:00');
  const finP = new Date(b.fin + 'T00:00:00');
  const nbJours = Math.max(1, Math.round((finP - debut) / 86400000) + 1);

  // Trimestre, ou personnalisee longue : un point par semaine
  if (dirStatsPeriode === 'trimestre' || nbJours > 31) {
    const curseur = new Date(debut);
    let n = 1;
    while (curseur <= finP) {
      let somme = 0;
      for (let i = 0; i < 7 && curseur <= finP; i++) {
        somme += parJour[fmtDateISO(curseur)] || 0;
        curseur.setDate(curseur.getDate() + 1);
      }
      out.push({ label: 'S' + n, valeur: somme });
      n++;
    }
    return out;
  }

  // Mois (et personnalisee courte) : un point par jour
  for (let i = 0; i < nbJours; i++) {
    const d = new Date(debut);
    d.setDate(d.getDate() + i);
    out.push({ label: String(d.getDate()) + '/' + String(d.getMonth() + 1), valeur: parJour[fmtDateISO(d)] || 0 });
  }
  return out;
}

"""
i = s.index('function afficherStatistiquesDir()')
s = s[:i] + JS + s[i:]

APPEL_ANCRE = """  // --- Compteurs Ab / Rd / Non justifiees (filtres periode + type) ---"""
APPEL = """  // --- Tendance selon la periode ---
  const elTitreTendance = document.getElementById('dir-tendance-titre');
  if (elTitreTendance) elTitreTendance.textContent = 'Tendance ' + libelleTendanceDir();
  barresStats('dir-chart-tendance', tendanceDirStats(filtres, b));

""" + APPEL_ANCRE
allok &= remplace('appel du rendu de la tendance', APPEL_ANCRE, APPEL)

if not allok:
    print('PATCH ANNULE')
    sys.exit(1)

s, c = re.subn(r'AbsenceTrack v3\.36', 'AbsenceTrack v3.37', s)
print(('OK   ' if c == 1 else 'ECHEC') + ' version -> v3.37 =%d' % c)
assert c == 1

io.open(F, 'w', encoding='utf-8').write(s)
print('--- taille %d -> %d octets ---' % (n0, len(s)))

# ---------- verifications ----------
for cle, attendu in [('dir-alerts', 0), ('dir-critical-classes', 0), ("id=\"dir-tendance\"", 0),
                     ('Alertes importantes', 0), ('Classes critiques', 0), ('Tendance hebdomadaire', 0),
                     ('id="dir-chart-tendance"', 1), ('id="dir-tendance-titre"', 1),
                     ('function tendanceDirStats', 1), ('function libelleTendanceDir', 1),
                     ("barresStats('dir-chart-tendance'", 1), ('elevesAuDessusSeuil(', 2),
                     ('id="page-profil"', 1), ('id="page-dir-stats"', 1), ('id="dir-stats-totaux"', 1)]:
    n = s.count(cle)
    print(('OK   ' if n == attendu else 'ECHEC') + ' %-34s = %d' % (cle, n))
    allok &= (n == attendu)

# le Dashboard ne garde que la carte du haut + la liste
i = s.index('id="page-directeur"'); j = s.index('id="page-dir-gestion"')
dash = s[i:j]
n = dash.count('class="stat-card"') + dash.count('class="stat-card mb-4"')
print(('OK   ' if n == 0 else 'ECHEC') + ' %-34s = %d' % ('cartes stat-card du Dashboard', n))
allok &= (n == 0)
n = dash.count('class="stat-card-absences"')
print(('OK   ' if n == 1 else 'ECHEC') + ' %-34s = %d' % ('carte du haut (stat-card-absences)', n))
allok &= (n == 1)
n = dash.count('stat-card-absences') + dash.count('dir-absences-list')
print(('OK   ' if n == 2 else 'ECHEC') + ' %-34s = %d' % ('carte du haut + liste conserves', n))
allok &= (n == 2)

# la carte Tendance est juste apres le Taux de presence
i = s.index('id="page-dir-stats"'); j = s.index('id="page-profil"')
stats = s[i:j]
p_taux = stats.index('id="dir-stat-presence"')
p_tend = stats.index('id="dir-chart-tendance"')
p_parc = stats.index('id="dir-chart-absences"')
print(('OK   ' if p_taux < p_tend < p_parc else 'ECHEC') + ' ordre taux (%d) < tendance (%d) < par classe (%d)' % (p_taux, p_tend, p_parc))
allok &= (p_taux < p_tend < p_parc)

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
