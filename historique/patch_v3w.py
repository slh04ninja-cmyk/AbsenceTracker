# -*- coding: utf-8 -*-
"""AbsenceTrack v3.34 : nouvelle page Stats du DIRECTEUR (statistiques des absences de
l'etablissement), icone fa-chart-bar AU MILIEU du nav du bas.

- page-dir-stats inseree apres page-dir-historique : filtres Periode + Type, taux de presence
  (seances x eleves, tout l'etablissement), 3 compteurs Ab/Rd/Non just., donut Ab/Rd,
  barres « Par classe », « Eleves les plus signales » cliquable -> fiche eleve
- navs du directeur : Dashboard | Historique | Stats | Gestion | Profil (5 items, Stats au milieu)
- JS : bornesPeriode() extrait de statsBornes() (reutilise par les 2 pages), etat + rendu
  afficherStatistiquesDir() ; switchDirPage gere 'dir-stats'
"""
import io, re, sys, shutil, subprocess

F = 'AbsenceTrack-v2.html'
s = io.open(F, encoding='utf-8').read()
n0 = len(s)
allok = True

def remplace(label, a, b, n=1):
    global s
    c = s.count(a)
    print(('OK   ' if c == n else 'ECHEC') + ' %-44s =%d (attendu %d)' % (label, c, n))
    if c == n:
        s = s.replace(a, b)
    return c == n

def lien(page, icone, label, actif=False, this=True):
    return ('    <div class="nav-item%s" onclick="switchDirPage(\'%s\'%s)">'
            '<div class="nav-icon"><i class="fas fa-%s"></i></div><span>%s</span></div>\n'
            % (' active' if actif else '', page, ', this' if this else '', icone, label))

# ---------- 1. la nouvelle page, apres l'Historique ----------
ancre = '<!-- PAGE PROFILE (commune'
assert s.count(ancre) == 1
PAGE = """<!-- ============================================ -->
<!-- PAGE STATISTIQUES (DIRECTEUR)                -->
<!-- ============================================ -->
<div id="page-dir-stats" class="page-container">
  <div class="appbar">
    <button onclick="basculerTheme()" title="Mode sombre" class="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded transition justify-self-start">
      <i class="icone-theme fas fa-moon text-xl"></i>
    </button>
    <div class="appbar-title">Gestion d'absence</div>
    <button onclick="deconnexion()" class="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded transition justify-self-end">
      <i class="fas fa-sign-out-alt text-xl"></i>
    </button>
  </div>
  <div class="page-content page-with-nav page-with-appbar">
    <div class="p-4">
      <h2 class="text-center font-bold text-gray-800 mb-4" style="font-size: 18px;">Statistiques de l'établissement</h2>
      <div class="stat-card mb-4">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold text-blue-900 mb-1">Période</label>
            <select id="dir-stats-periode" onchange="changerFiltreStatsDir()" class="w-full px-3 py-2 border-2 border-blue-900 rounded-lg font-medium">
              <option value="jour">Aujourd'hui</option>
              <option value="semaine">Cette semaine</option>
              <option value="mois" selected>Ce mois</option>
              <option value="trimestre">Ce trimestre</option>
              <option value="perso">Personnalisée</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold text-blue-900 mb-1">Type</label>
            <select id="dir-stats-type" onchange="changerFiltreStatsDir()" class="w-full px-3 py-2 border-2 border-blue-900 rounded-lg font-medium">
              <option value="tous">Ab + Rd</option>
              <option value="absence">Absences (Ab)</option>
              <option value="retard">Retards (Rd)</option>
            </select>
          </div>
        </div>
        <div id="dir-stats-dates" class="grid grid-cols-2 gap-3 mt-3" style="display: none;">
          <div>
            <label class="block text-xs font-bold text-blue-900 mb-1">Du</label>
            <input type="date" id="dir-stats-debut" onchange="changerFiltreStatsDir()" class="w-full px-3 py-2 border-2 border-blue-900 rounded-lg font-medium">
          </div>
          <div>
            <label class="block text-xs font-bold text-blue-900 mb-1">Au</label>
            <input type="date" id="dir-stats-fin" onchange="changerFiltreStatsDir()" class="w-full px-3 py-2 border-2 border-blue-900 rounded-lg font-medium">
          </div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Taux de présence</div>
        <div class="stat-value" id="dir-stat-presence">—</div>
        <div class="progress-bar"><div class="progress-fill" id="dir-progress-presence" style="width: 0%"></div></div>
        <p class="text-xs text-gray-500 mt-2" id="dir-stat-presence-detail"></p>
      </div>
      <div class="stat-card">
        <div class="grid grid-cols-3 gap-2" id="dir-stats-totaux"></div>
      </div>
      <div class="stat-card">
        <div class="stat-label mb-4">Répartition Ab / Rd</div>
        <div id="dir-chart-repartition" class="flex items-center gap-4"></div>
      </div>
      <div class="stat-card">
        <div class="stat-label mb-4">Par classe</div>
        <div class="chart-bar" id="dir-chart-absences"></div>
        <div class="h-8"></div>
      </div>
      <div class="stat-card">
        <div class="stat-label mb-4">Élèves les plus signalés</div>
        <div id="dir-top-absents" class="space-y-2"></div>
      </div>
    </div>
  </div>
  <div class="bottom-nav">
    <div class="nav-item" onclick="switchDirPage('directeur', this)"><div class="nav-icon"><i class="fas fa-home"></i></div><span>Dashboard</span></div>
    <div class="nav-item" onclick="switchDirPage('dir-historique', this)"><div class="nav-icon"><i class="fas fa-history"></i></div><span>Historique</span></div>
    <div class="nav-item active" onclick="switchDirPage('dir-stats', this)"><div class="nav-icon"><i class="fas fa-chart-bar"></i></div><span>Stats</span></div>
    <div class="nav-item" onclick="switchDirPage('dir-gestion', this)"><div class="nav-icon"><i class="fas fa-cogs"></i></div><span>Gestion</span></div>
  
    <div class="nav-item" onclick="switchProfil(this)"><div class="nav-icon"><i class="fas fa-user-circle"></i></div><span>Profil</span></div>
  </div>
</div>

"""
s = s.replace(ancre, PAGE + ancre, 1)
assert s.count('id="page-dir-stats"') == 1 and s.count('id="page-profil"') == 1

# ---------- 2. navs : Stats au milieu ----------
stats_lien = lien('dir-stats', 'chart-bar', 'Stats', False, True)
paires = [
    ('nav page-directeur',    lien('dir-historique', 'history', 'Historique', False, True),  lien('dir-gestion', 'cogs', 'Gestion', False, True)),
    ('nav page-dir-historique', lien('dir-historique', 'history', 'Historique', True, True), lien('dir-gestion', 'cogs', 'Gestion', False, True)),
    ('nav page-dir-gestion',  lien('dir-historique', 'history', 'Historique', False, True),  lien('dir-gestion', 'cogs', 'Gestion', True, True)),
    ('nav profil-nav-dir',    lien('dir-historique', 'history', 'Historique', False, False), lien('dir-gestion', 'cogs', 'Gestion', False, False)),
]
for label, histo, gest in paires:
    stats = stats_lien if ', this' in histo else lien('dir-stats', 'chart-bar', 'Stats', False, False)
    allok &= remplace(label, histo + gest, histo + stats + gest)

assert s.count('id="page-profil"') == 1, 'page Profil perdue'

# ---------- 3. JS : bornesPeriode reutilisable ----------
ANCIEN_BORNES = """function statsBornes() {
  const auj = new Date();
  let debut = new Date(auj);
  let fin = new Date(auj);
  if (statsPeriode === 'semaine') {
    debut.setDate(debut.getDate() - 6);
  } else if (statsPeriode === 'mois') {
    debut = new Date(auj.getFullYear(), auj.getMonth(), 1);
  } else if (statsPeriode === 'trimestre') {
    debut = new Date(auj.getFullYear(), Math.floor(auj.getMonth() / 3) * 3, 1);
  } else if (statsPeriode === 'perso') {
    const dv = (document.getElementById('stats-debut') || {}).value;
    const fv = (document.getElementById('stats-fin') || {}).value;
    if (dv) debut = new Date(dv + 'T00:00:00');
    if (fv) fin = new Date(fv + 'T00:00:00');
  }
  return { debut: fmtDateISO(debut), fin: fmtDateISO(fin) };
}"""
NOUVEAU_BORNES = """function bornesPeriode(valeur, idDebut, idFin) {
  const auj = new Date();
  let debut = new Date(auj);
  let fin = new Date(auj);
  if (valeur === 'semaine') {
    debut.setDate(debut.getDate() - 6);
  } else if (valeur === 'mois') {
    debut = new Date(auj.getFullYear(), auj.getMonth(), 1);
  } else if (valeur === 'trimestre') {
    debut = new Date(auj.getFullYear(), Math.floor(auj.getMonth() / 3) * 3, 1);
  } else if (valeur === 'perso') {
    const dv = (document.getElementById(idDebut) || {}).value;
    const fv = (document.getElementById(idFin) || {}).value;
    if (dv) debut = new Date(dv + 'T00:00:00');
    if (fv) fin = new Date(fv + 'T00:00:00');
  }
  return { debut: fmtDateISO(debut), fin: fmtDateISO(fin) };
}

function statsBornes() { return bornesPeriode(statsPeriode, 'stats-debut', 'stats-fin'); }"""
allok &= remplace('extraction bornesPeriode', ANCIEN_BORNES, NOUVEAU_BORNES)

# ---------- 4. JS : page stats du directeur ----------
JS = """
// ========== DIRECTEUR — STATISTIQUES DE L'ETABLISSEMENT ==========
let dirStatsPeriode = 'mois';
let dirStatsType = 'tous';

function lireFiltresStatsDir() {
  const val = id => { const e = document.getElementById(id); return e ? e.value : null; };
  const p = val('dir-stats-periode'); if (p) dirStatsPeriode = p;
  const t = val('dir-stats-type'); if (t) dirStatsType = t;
  const dd = document.getElementById('dir-stats-dates');
  if (dd) dd.style.display = (dirStatsPeriode === 'perso') ? 'grid' : 'none';
}

function changerFiltreStatsDir() {
  lireFiltresStatsDir();
  afficherStatistiquesDir();
}

function statsDirFiltre() {
  const b = bornesPeriode(dirStatsPeriode, 'dir-stats-debut', 'dir-stats-fin');
  return absences.filter(a => {
    const d = String(a.dateISO || '');
    if (d < b.debut || d > b.fin) return false;
    if (dirStatsType !== 'tous' && (a.type || 'absence') !== dirStatsType) return false;
    return true;
  });
}

function afficherStatistiquesDir() {
  lireFiltresStatsDir();
  const b = bornesPeriode(dirStatsPeriode, 'dir-stats-debut', 'dir-stats-fin');
  const pal = couleursAbsRd();
  const filtres = statsDirFiltre();

  // --- Taux de presence de l'etablissement (eleves x seances, toutes classes, toutes matieres) ---
  const totalEleves = classes.reduce((somme, c) => somme + c.eleves.length, 0);
  const periodeToutes = absences.filter(a => { const d = String(a.dateISO || ''); return d >= b.debut && d <= b.fin; });
  const seances = {};
  periodeToutes.forEach(a => { seances[String(a.dateISO) + '|' + (a.seance || 'matin')] = 1; });
  const nbSeances = Math.max(Object.keys(seances).length, 1);
  const nbAbsEtab = periodeToutes.filter(a => (a.type || 'absence') !== 'retard').length;
  const places = Math.max(totalEleves * nbSeances, 1);
  const taux = Math.max(0, Math.min(100, Math.round(((places - nbAbsEtab) / places) * 100)));
  const elTaux = document.getElementById('dir-stat-presence');
  if (elTaux) elTaux.textContent = taux + '%';
  const elBarre = document.getElementById('dir-progress-presence');
  if (elBarre) elBarre.style.width = taux + '%';
  const elDetail = document.getElementById('dir-stat-presence-detail');
  if (elDetail) elDetail.textContent = totalEleves + ' élèves · ' + nbSeances + ' séance(s) · ' + nbAbsEtab + ' absence(s) sur la période';

  // --- Compteurs Ab / Rd / Non justifiees (filtres periode + type) ---
  const nbAb = filtres.filter(a => (a.type || 'absence') !== 'retard').length;
  const nbRd = filtres.filter(a => a.type === 'retard').length;
  const nbNonJust = filtres.filter(a => a.statut === 'absent').length;
  const bloc = document.getElementById('dir-stats-totaux');
  if (bloc) {
    bloc.innerHTML =
      '<div class="stat-mini stat-card" style="margin: 0; text-align: center;"><div class="stat-label" style="font-size: 10px;">ABSENCES</div><div class="stat-value" style="font-size: 22px; color: ' + pal.abs + ';">' + nbAb + '</div></div>' +
      '<div class="stat-mini stat-card" style="margin: 0; text-align: center;"><div class="stat-label" style="font-size: 10px;">RETARDS</div><div class="stat-value" style="font-size: 22px; color: ' + pal.rd + ';">' + nbRd + '</div></div>' +
      '<div class="stat-mini stat-card" style="margin: 0; text-align: center;"><div class="stat-label" style="font-size: 10px;">NON JUST.</div><div class="stat-value" style="font-size: 22px;">' + nbNonJust + '</div></div>';
  }

  // --- Repartition Ab / Rd ---
  const totalBr = nbAb + nbRd;
  const pctAb = totalBr ? Math.round((nbAb / totalBr) * 100) : 0;
  const rep = document.getElementById('dir-chart-repartition');
  if (rep) {
    if (totalBr === 0) {
      rep.innerHTML = '<p class="text-gray-500 text-center py-4" style="width:100%">Aucune donnée</p>';
    } else {
      rep.innerHTML =
        '<div style="width: 104px; height: 104px; border-radius: 50%; flex-shrink: 0; background: conic-gradient(' + pal.abs + ' 0 ' + pctAb + '%, ' + pal.rd + ' ' + pctAb + '% 100%); box-shadow: 0 4px 14px rgba(0,0,0,0.10);"></div>' +
        '<div class="space-y-2">' +
          '<div class="flex items-center gap-2"><span style="width: 10px; height: 10px; border-radius: 50%; background: ' + pal.abs + '; display: inline-block;"></span><span class="text-sm text-gray-700">Absences : <strong>' + nbAb + '</strong> (' + pctAb + '%)</span></div>' +
          '<div class="flex items-center gap-2"><span style="width: 10px; height: 10px; border-radius: 50%; background: ' + pal.rd + '; display: inline-block;"></span><span class="text-sm text-gray-700">Retards : <strong>' + nbRd + '</strong> (' + (100 - pctAb) + '%)</span></div>' +
        '</div>';
    }
  }

  // --- Par classe ---
  barresStats('dir-chart-absences', classes.map(cl => ({
    label: cl.nom,
    valeur: filtres.filter(a => a.classe === cl.nom).length
  })));

  // --- Eleves les plus signales (cliquable -> fiche) ---
  const parEleve = {};
  filtres.forEach(a => {
    const cle = a.eleveId + '|' + a.classe;
    if (!parEleve[cle]) parEleve[cle] = { nom: a.nom, classe: a.classe, total: 0 };
    parEleve[cle].total++;
  });
  const eleves = Object.values(parEleve).sort((x, y) => y.total - x.total);
  const topDiv = document.getElementById('dir-top-absents');
  if (topDiv) {
    topDiv.innerHTML = '';
    if (eleves.length === 0) {
      topDiv.innerHTML = '<p class="text-gray-500 text-center py-4">Aucun signalement sur la période</p>';
    } else {
      eleves.slice(0, 5).forEach(x => {
        const row = document.createElement('div');
        row.className = 'flex justify-between items-center p-3 bg-gray-50 rounded-lg';
        row.style.cursor = 'pointer';
        row.onclick = () => ouvrirFicheEleveParNom(x.nom, x.classe);
        row.innerHTML =
          '<div class="flex items-center gap-3">' +
            '<span class="avatar text-xs" style="width: 32px; height: 32px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: #fff; background: ' + pal.abs + '; font-weight: 700;">' + (x.nom || '?').charAt(0) + '</span>' +
            '<span class="font-medium text-gray-800">' + x.nom + '</span>' +
          '</div>' +
          '<span class="text-sm font-bold" style="color: ' + pal.abs + ';">' + x.total + '</span>';
        topDiv.appendChild(row);
      });
    }
  }
}

"""
i = s.index('// ========== DIRECTEUR — IMPORT MASSAR EXCEL ==========')
s = s[:i] + JS.lstrip('\n') + s[i:]

allok &= remplace('switchDirPage -> dir-stats',
                  "  if (page === 'dir-gestion') afficherGestionDir();",
                  "  if (page === 'dir-stats') afficherStatistiquesDir();\n  if (page === 'dir-gestion') afficherGestionDir();")

if not allok:
    print('PATCH ANNULE')
    sys.exit(1)

s, c = re.subn(r'AbsenceTrack v3\.33', 'AbsenceTrack v3.34', s)
print(('OK   ' if c == 1 else 'ECHEC') + ' version -> v3.34 =%d' % c)
assert c == 1

io.open(F, 'w', encoding='utf-8').write(s)
print('--- taille %d -> %d octets ---' % (n0, len(s)))

# ---------- verifications ----------
for cle, attendu in [('id="page-dir-stats"', 1), ('id="dir-stats-periode"', 1), ('id="dir-stats-type"', 1),
                     ('id="dir-stats-totaux"', 1), ('id="dir-chart-repartition"', 1),
                     ('id="dir-chart-absences"', 1), ('id="dir-top-absents"', 1),
                     ('id="dir-stat-presence"', 1), ('function afficherStatistiquesDir', 1),
                     ('bornesPeriode(', 4), ('function statsBornes', 1),
                     ("switchDirPage('dir-stats'", 5), ('id="page-profil"', 1),
                     ('id="page-dir-historique"', 1), ('id="page-dir-gestion"', 1),
                     ('id="page-surv-classes"', 1), ('id="page-stats-ens"', 1)]:
    n = s.count(cle)
    print(('OK   ' if n == attendu else 'ECHEC') + ' %-40s = %d' % (cle, n))
    allok &= (n == attendu)

for page, suivant in [('page-directeur', 'page-dir-gestion'), ('page-dir-gestion', 'page-dir-historique'),
                      ('page-dir-historique', 'page-dir-stats'), ('page-dir-stats', 'page-profil'),
                      ('page-profil', 'MODAL CONFIRMATION')]:
    i = s.index('id="%s"' % page)
    j = s.index(suivant if suivant.startswith('MODAL') else 'id="%s"' % suivant, i + 10)
    nav = s[i:j]
    ordre = [m.group(1) for m in re.finditer(r"switchDirPage\('(dir-[a-z]+|directeur)'", nav)]
    attendu = ['directeur', 'dir-historique', 'dir-stats', 'dir-gestion']
    print(('OK   ' if ordre == attendu else 'ECHEC') + ' ordre nav %-22s = %s' % (page, ordre))
    allok &= (ordre == attendu)
    milieu = nav.count('<div class="nav-item')
    print(('OK   ' if milieu == 5 else 'ECHEC') + ' %-22s 5 onglets = %d' % (page, milieu))
    allok &= (milieu == 5)

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
