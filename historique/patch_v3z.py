# -*- coding: utf-8 -*-
"""AbsenceTrack v3.38 : la carte « Par classe » (page Stats directeur) passe en barres
horizontales qui se remplissent (comme le Taux de presence), la valeur etant ecrite a droite
sur la meme ligne que la barre.

- nouveau CSS .barre-ligne / .barre-nom / .barre-piste / .barre-remplissage / .barre-valeur
  (meme langage visuel que .progress-bar, avec couleurs de role + theme sombre)
- nouveau helper JS barresHorizontalesStats(idConteneur, donnees)
- la carte Par classe utilise ce helper ; le conteneur perd la classe .chart-bar et le spacer .h-8
"""
import io, re, sys, shutil, subprocess

F = 'AbsenceTrack-v2.html'
s = io.open(F, encoding='utf-8').read()
n0 = len(s)
allok = True

def remplace(label, a, b, n=1):
    global s
    c = s.count(a)
    print(('OK   ' if c == n else 'ECHEC') + ' %-40s =%d (attendu %d)' % (label, c, n))
    if c == n:
        s = s.replace(a, b)
    return c == n

# ---------- 1. CSS ----------
CSS = """    /* --- Barres horizontales « Par classe » (meme style que Taux de presence) --- */
    .barre-ligne { display: flex; align-items: center; gap: 10px; }
    .barre-ligne + .barre-ligne { margin-top: 10px; }
    .barre-nom { width: 76px; flex-shrink: 0; font-size: 12.5px; font-weight: 600; color: #334155; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .barre-piste { flex: 1 1 auto; display: block; height: 10px; background: #e2e8f0; border-radius: 6px; overflow: hidden; }
    .barre-remplissage { display: block; height: 100%; border-radius: 6px; background: linear-gradient(90deg, #1e3a8a 0%, #3b82f6 100%); transition: width 0.3s ease; }
    .barre-valeur { width: 26px; flex-shrink: 0; text-align: right; font-size: 13px; font-weight: 700; color: #1e293b; }
    body.theme-sombre .barre-nom { color: #cbd5e1; }
    body.theme-sombre .barre-piste { background: #334155; }
    body.theme-sombre .barre-valeur { color: #e2e8f0; }
    body:not(.theme-sombre).role-enseignant .barre-remplissage,
    body:not(.theme-sombre).role-surveillant .barre-remplissage,
    body:not(.theme-sombre).role-directeur .barre-remplissage { background: var(--lot-primaire); }
"""
ANCRE_CSS = "    .bar-value { position: absolute; top: -24px; left: 50%; transform: translateX(-50%); font-weight: 700; color: var(--primary); font-size: 14px; }\n"
allok &= remplace('CSS des barres horizontales', ANCRE_CSS, ANCRE_CSS + CSS)

# ---------- 2. conteneur HTML ----------
ANCIEN = """      <div class="stat-card">
        <div class="stat-label mb-4">Par classe</div>
        <div class="chart-bar" id="dir-chart-absences"></div>
        <div class="h-8"></div>
      </div>
"""
NOUVEAU = """      <div class="stat-card">
        <div class="stat-label mb-4">Par classe</div>
        <div id="dir-chart-absences" class="space-y-3"></div>
      </div>
"""
allok &= remplace('conteneur Par classe', ANCIEN, NOUVEAU)

# ---------- 3. helper JS ----------
HELPER = """// Barres horizontales : nom a gauche, barre qui se remplit, valeur a droite (meme ligne)
function barresHorizontalesStats(idConteneur, donnees) {
  const cont = document.getElementById(idConteneur);
  if (!cont) return;
  cont.innerHTML = '';
  const max = Math.max.apply(null, donnees.map(d => d.valeur).concat([0]));
  if (donnees.length === 0 || max === 0) {
    cont.innerHTML = '<p class="text-gray-500 text-center py-4">Aucune donnée</p>';
    return;
  }
  const maxRef = Math.max(max, 1);
  donnees.forEach(d => {
    const ligne = document.createElement('div');
    ligne.className = 'barre-ligne';
    const pct = d.valeur > 0 ? Math.max(Math.round((d.valeur / maxRef) * 100), 6) : 0;
    ligne.innerHTML =
      '<span class="barre-nom" title="' + d.label + '">' + d.label + '</span>' +
      '<span class="barre-piste"><span class="barre-remplissage" style="width: ' + pct + '%;"></span></span>' +
      '<span class="barre-valeur">' + d.valeur + '</span>';
    cont.appendChild(ligne);
  });
}

"""
i = s.index('function evolutionStats') if 'function evolutionStats' in s else s.index('function afficherStatistiques(')
s = s[:i] + HELPER + s[i:]

ANCIEN_APPEL = """  // --- Par classe ---
  barresStats('dir-chart-absences', classes.map(cl => ({
    label: cl.nom,
    valeur: filtres.filter(a => a.classe === cl.nom).length
  })));"""
NOUVEAU_APPEL = """  // --- Par classe (barres horizontales : la valeur est a droite de la barre) ---
  barresHorizontalesStats('dir-chart-absences', classes.map(cl => ({
    label: cl.nom,
    valeur: filtres.filter(a => a.classe === cl.nom).length
  })));"""
allok &= remplace('appel Par classe', ANCIEN_APPEL, NOUVEAU_APPEL)

if not allok:
    print('PATCH ANNULE')
    sys.exit(1)

s, c = re.subn(r'AbsenceTrack v3\.37', 'AbsenceTrack v3.38', s)
print(('OK   ' if c == 1 else 'ECHEC') + ' version -> v3.38 =%d' % c)
assert c == 1

io.open(F, 'w', encoding='utf-8').write(s)
print('--- taille %d -> %d octets ---' % (n0, len(s)))

# ---------- verifications ----------
for cle, attendu in [('.barre-ligne {', 1), ('.barre-valeur {', 1), ('function barresHorizontalesStats', 1),
                     ("barresHorizontalesStats('dir-chart-absences'", 1), ('dir-chart-absences" class="space-y-3"', 1),
                     ('class="chart-bar" id="dir-chart-absences"', 0), ('id="page-profil"', 1),
                     ('id="chart-absences"', 1), ('barresStats(', 3)]:
    n = s.count(cle)
    print(('OK   ' if n == attendu else 'ECHEC') + ' %-44s = %d' % (cle, n))
    allok &= (n == attendu)

# la carte Par classe ne doit plus contenir de .chart-bar ni de spacer h-8
i = s.index('id="page-dir-stats"'); j = s.index('id="page-profil"')
stats = s[i:j]
k = stats.index('Par classe')
fin = stats.index('<div class="stat-card">', k + 10)
carte = stats[k:fin]
print('--- carte Par classe ---')
print(carte)
allok &= ('chart-bar' not in carte and 'h-8' not in carte)

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
