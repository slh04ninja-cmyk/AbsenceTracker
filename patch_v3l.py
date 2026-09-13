# -*- coding: utf-8 -*-
"""v3.21 -> v3.22 : page Stats enseignant : filtres + taux correct + graphiques + top cliquable + a surveiller."""
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

# ---------- 1. HTML : carte de filtres ----------
plain('1-filtres',
      """      <div class="stat-card mb-4">
        <select id="select-classe-stats" onchange="changerClasseStats()" class="w-full px-4 py-3 border-2 border-blue-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium">
          <option value="">-- Choisir une classe --</option>
        </select>
      </div>""",
      """      <div class="stat-card mb-4">
        <select id="select-classe-stats" onchange="changerClasseStats()" class="w-full px-4 py-3 border-2 border-blue-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium">
          <option value="">-- Choisir une classe --</option>
        </select>
      </div>
      <div class="stat-card mb-4">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold text-blue-900 mb-1">Période</label>
            <select id="stats-periode" onchange="changerFiltreStats()" class="w-full px-3 py-2 border-2 border-blue-900 rounded-lg font-medium">
              <option value="jour">Aujourd'hui</option>
              <option value="semaine">Cette semaine</option>
              <option value="mois" selected>Ce mois</option>
              <option value="trimestre">Ce trimestre</option>
              <option value="perso">Personnalisée</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold text-blue-900 mb-1">Type</label>
            <select id="stats-type" onchange="changerFiltreStats()" class="w-full px-3 py-2 border-2 border-blue-900 rounded-lg font-medium">
              <option value="tous">Ab + Rd</option>
              <option value="absence">Absences (Ab)</option>
              <option value="retard">Retards (Rd)</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold text-blue-900 mb-1">Séance</label>
            <select id="stats-seance" onchange="changerFiltreStats()" class="w-full px-3 py-2 border-2 border-blue-900 rounded-lg font-medium">
              <option value="toutes">Toutes</option>
              <option value="matin">Matin</option>
              <option value="apres-midi">Après-midi</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold text-blue-900 mb-1">Périmètre</label>
            <select id="stats-perimetre" onchange="changerFiltreStats()" class="w-full px-3 py-2 border-2 border-blue-900 rounded-lg font-medium">
              <option value="moi">Mes signalements</option>
              <option value="tous">Tous les profs</option>
            </select>
          </div>
        </div>
        <div id="stats-dates" class="grid grid-cols-2 gap-3 mt-3" style="display: none;">
          <div>
            <label class="block text-xs font-bold text-blue-900 mb-1">Du</label>
            <input type="date" id="stats-debut" onchange="changerFiltreStats()" class="w-full px-3 py-2 border-2 border-blue-900 rounded-lg font-medium">
          </div>
          <div>
            <label class="block text-xs font-bold text-blue-900 mb-1">Au</label>
            <input type="date" id="stats-fin" onchange="changerFiltreStats()" class="w-full px-3 py-2 border-2 border-blue-900 rounded-lg font-medium">
          </div>
        </div>
      </div>""")

# ---------- 2. HTML : blocs statistiques ----------
plain('2-blocs',
      """      <div class="stat-card">
        <div class="stat-label">Taux de présence</div>
        <div class="stat-value" id="stat-presence">—</div>
        <div class="progress-bar"><div class="progress-fill" id="progress-presence" style="width: 0%"></div></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Absences par classe</div>
        <div class="chart-bar" id="chart-absences"></div>
        <div class="h-8"></div>
      </div>
      <div class="stat-card">
        <div class="stat-label mb-4">Élèves les plus absents</div>
        <div id="top-absents" class="space-y-2"></div>
      </div>""",
      """      <div class="stat-card">
        <div class="stat-label">Taux de présence</div>
        <div class="stat-value" id="stat-presence">—</div>
        <div class="progress-bar"><div class="progress-fill" id="progress-presence" style="width: 0%"></div></div>
        <p class="text-xs text-gray-500 mt-2" id="stat-presence-detail"></p>
      </div>
      <div class="stat-card">
        <div class="grid grid-cols-3 gap-2" id="stats-totaux"></div>
      </div>
      <div class="stat-card">
        <div class="stat-label mb-4">Évolution</div>
        <div class="chart-bar" id="chart-evolution"></div>
        <div class="h-8"></div>
      </div>
      <div class="stat-card">
        <div class="stat-label mb-4">Répartition Ab / Rd</div>
        <div id="chart-repartition" class="flex items-center gap-4"></div>
      </div>
      <div class="stat-card">
        <div class="stat-label mb-4">Matin / Après-midi</div>
        <div class="chart-bar" id="chart-seance" style="height: 100px;"></div>
        <div class="h-8"></div>
      </div>
      <div class="stat-card">
        <div class="stat-label mb-4">Par jour de la semaine</div>
        <div class="chart-bar" id="chart-jour" style="height: 100px;"></div>
        <div class="h-8"></div>
      </div>
      <div class="stat-card">
        <div class="stat-label mb-4">Par classe</div>
        <div class="chart-bar" id="chart-absences"></div>
        <div class="h-8"></div>
      </div>
      <div class="stat-card">
        <div class="stat-label mb-4">Élèves les plus signalés</div>
        <div id="top-absents" class="space-y-2"></div>
      </div>
      <div class="stat-card">
        <div class="stat-label mb-4">À surveiller (≥ 4 absences sur la période)</div>
        <div id="stats-surveiller" class="space-y-2"></div>
      </div>""")

# ---------- 3. JS : nouvelle page stats ----------
nouveau = '''// ========== STATISTIQUES ENSEIGNANT ==========
let statsPeriode = 'mois';
let statsType = 'tous';
let statsSeance = 'toutes';
let statsPerimetre = 'moi';

function lireFiltresStats() {
  const val = id => { const e = document.getElementById(id); return e ? e.value : null; };
  const p = val('stats-periode'); if (p) statsPeriode = p;
  const t = val('stats-type'); if (t) statsType = t;
  const s = val('stats-seance'); if (s) statsSeance = s;
  const pe = val('stats-perimetre'); if (pe) statsPerimetre = pe;
  const dd = document.getElementById('stats-dates');
  if (dd) dd.style.display = (statsPeriode === 'perso') ? 'grid' : 'none';
}

function changerFiltreStats() {
  lireFiltresStats();
  afficherStatistiques();
}

function statsBornes() {
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
}

function statsFiltre(sansClasse) {
  const b = statsBornes();
  const moi = utilisateurConnecte ? utilisateurConnecte.nom : '';
  return absences.filter(a => {
    const d = String(a.dateISO || '');
    if (d < b.debut || d > b.fin) return false;
    if (statsType !== 'tous' && (a.type || 'absence') !== statsType) return false;
    if (statsSeance !== 'toutes' && (a.seance || 'matin') !== statsSeance) return false;
    if (statsPerimetre === 'moi' && a.enseignant !== moi) return false;
    if (!sansClasse && classeSelectionnee && a.classe !== classeSelectionnee.nom) return false;
    return true;
  });
}

function barresStats(idConteneur, donnees) {
  const cont = document.getElementById(idConteneur);
  if (!cont) return;
  cont.innerHTML = '';
  if (donnees.length === 0) {
    cont.innerHTML = '<p class="text-gray-500 text-center py-4" style="width:100%">Aucune donnée</p>';
    return;
  }
  const max = Math.max.apply(null, donnees.map(d => d.valeur).concat([1]));
  donnees.forEach(d => {
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.height = Math.max((d.valeur / max) * 100, 8) + '%';
    bar.innerHTML = '<div class="bar-value">' + d.valeur + '</div><div class="bar-label">' + d.label + '</div>';
    cont.appendChild(bar);
  });
}

function evolutionStats(filtres, b) {
  const parJour = {};
  filtres.forEach(a => { const d = String(a.dateISO || ''); parJour[d] = (parJour[d] || 0) + 1; });
  const debut = new Date(b.debut + 'T00:00:00');
  const fin = new Date(b.fin + 'T00:00:00');
  const nbJours = Math.max(1, Math.round((fin - debut) / 86400000) + 1);
  const out = [];
  if (nbJours <= 8) {
    for (let i = 0; i < nbJours; i++) {
      const d = new Date(debut);
      d.setDate(d.getDate() + i);
      out.push({ label: String(d.getDate()) + '/' + String(d.getMonth() + 1), valeur: parJour[fmtDateISO(d)] || 0 });
    }
    return out;
  }
  const curseur = new Date(debut);
  let n = 1;
  while (curseur <= fin) {
    let somme = 0;
    for (let i = 0; i < 7 && curseur <= fin; i++) {
      somme += parJour[fmtDateISO(curseur)] || 0;
      curseur.setDate(curseur.getDate() + 1);
    }
    out.push({ label: 'S' + n, valeur: somme });
    n++;
  }
  return out;
}

function afficherStatistiques() {
  lireFiltresStats();
  const b = statsBornes();
  const pal = couleursAbsRd();
  const filtres = classeSelectionnee ? statsFiltre(false) : [];

  // --- Taux de presence (classe + periode, toutes matieres) ---
  if (classeSelectionnee) {
    const tousClasse = absences.filter(a => a.classe === classeSelectionnee.nom && String(a.dateISO || '') >= b.debut && String(a.dateISO || '') <= b.fin);
    const seances = {};
    tousClasse.forEach(a => { seances[a.dateISO + '|' + (a.seance || 'matin')] = 1; });
    const nbSeances = Math.max(Object.keys(seances).length, 1);
    const nbAbsClasse = tousClasse.filter(a => (a.type || 'absence') !== 'retard').length;
    const totalEleves = classeSelectionnee.eleves.length;
    const places = totalEleves * nbSeances;
    const taux = Math.max(0, Math.min(100, Math.round(((places - nbAbsClasse) / places) * 100)));
    document.getElementById('stat-presence').textContent = taux + '%';
    document.getElementById('progress-presence').style.width = taux + '%';
    document.getElementById('stat-presence-detail').textContent =
      totalEleves + ' élèves · ' + nbSeances + ' séance(s) · ' + nbAbsClasse + ' absence(s) sur la période';
  } else {
    document.getElementById('stat-presence').textContent = '—';
    document.getElementById('progress-presence').style.width = '0%';
    document.getElementById('stat-presence-detail').textContent = 'Choisissez une classe pour le détail';
  }

  // --- Totaux ---
  const nbAb = filtres.filter(a => (a.type || 'absence') !== 'retard').length;
  const nbRd = filtres.filter(a => a.type === 'retard').length;
  const nbNonJust = filtres.filter(a => a.statut === 'absent').length;
  const bloc = document.getElementById('stats-totaux');
  if (bloc) {
    bloc.innerHTML =
      '<div class="stat-mini stat-card" style="margin: 0; text-align: center;"><div class="stat-label" style="font-size: 10px;">ABSENCES</div><div class="stat-value" style="font-size: 22px; color: ' + pal.abs + ';">' + nbAb + '</div></div>' +
      '<div class="stat-mini stat-card" style="margin: 0; text-align: center;"><div class="stat-label" style="font-size: 10px;">RETARDS</div><div class="stat-value" style="font-size: 22px; color: ' + pal.rd + ';">' + nbRd + '</div></div>' +
      '<div class="stat-mini stat-card" style="margin: 0; text-align: center;"><div class="stat-label" style="font-size: 10px;">NON JUST.</div><div class="stat-value" style="font-size: 22px;">' + nbNonJust + '</div></div>';
  }

  // --- Evolution ---
  barresStats('chart-evolution', evolutionStats(filtres, b));

  // --- Repartition Ab / Rd ---
  const totalBr = nbAb + nbRd;
  const pctAb = totalBr ? Math.round((nbAb / totalBr) * 100) : 0;
  const rep = document.getElementById('chart-repartition');
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

  // --- Matin / Apres-midi ---
  const nbMatin = filtres.filter(a => (a.seance || 'matin') === 'matin').length;
  barresStats('chart-seance', [
    { label: 'Matin', valeur: nbMatin },
    { label: 'Après-midi', valeur: filtres.length - nbMatin }
  ]);

  // --- Par jour de semaine ---
  const jours = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const parJourSem = [0, 0, 0, 0, 0, 0];
  filtres.forEach(a => {
    const d = new Date(String(a.dateISO) + 'T12:00:00');
    if (isNaN(d.getTime())) return;
    const idx = (d.getDay() + 6) % 7;
    if (idx < 6) parJourSem[idx]++;
  });
  barresStats('chart-jour', jours.map((j, i) => ({ label: j, valeur: parJourSem[i] })));

  // --- Par classe (toutes classes, selon filtres) ---
  const filtresToutes = statsFiltre(true);
  barresStats('chart-absences', classes.map(cl => ({
    label: cl.nom,
    valeur: filtresToutes.filter(a => a.classe === cl.nom).length
  })));

  // --- Par eleve (top + a surveiller) ---
  const parEleve = {};
  filtres.forEach(a => {
    const cle = a.eleveId + '|' + a.classe;
    if (!parEleve[cle]) parEleve[cle] = { nom: a.nom, classe: a.classe, total: 0, nbAb: 0 };
    parEleve[cle].total++;
    if ((a.type || 'absence') !== 'retard') parEleve[cle].nbAb++;
  });
  const eleves = Object.values(parEleve).sort((x, y) => y.total - x.total);

  const topDiv = document.getElementById('top-absents');
  if (topDiv) {
    topDiv.innerHTML = '';
    if (eleves.length === 0) {
      topDiv.innerHTML = '<p class="text-gray-500 text-center py-4">' + (classeSelectionnee ? 'Aucun signalement sur la période' : 'Choisissez une classe') + '</p>';
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

  const surveillerDiv = document.getElementById('stats-surveiller');
  if (surveillerDiv) {
    surveillerDiv.innerHTML = '';
    const aSurveiller = eleves.filter(x => x.nbAb >= SEUIL_ALERTE_MOIS);
    if (aSurveiller.length === 0) {
      surveillerDiv.innerHTML = '<p class="text-gray-500 text-center py-4">Aucun élève au-dessus du seuil</p>';
    } else {
      aSurveiller.slice(0, 8).forEach(x => {
        const row = document.createElement('div');
        row.className = 'flex justify-between items-center p-3 bg-red-50 rounded-lg';
        row.style.cursor = 'pointer';
        row.onclick = () => ouvrirFicheEleveParNom(x.nom, x.classe);
        row.innerHTML =
          '<div><p class="font-bold text-gray-800">' + x.nom + '</p><p class="text-xs text-gray-500">' + x.classe + '</p></div>' +
          '<span class="badge badge-danger">' + x.nbAb + ' absences</span>';
        surveillerDiv.appendChild(row);
      });
    }
  }
}'''

rfn_old = re.search(r'function afficherStatistiques\(\) \{.*?\n\}', data, re.DOTALL)
if rfn_old:
    results.append(('3-js', True, 1))
    data = data.replace(rfn_old.group(0), nouveau)
else:
    results.append(('3-js', False, 0))

plain('4-version', 'AbsenceTrack v3.21 \u2014 Prototype', 'AbsenceTrack v3.22 \u2014 Prototype')

io.open(F, 'w', encoding='utf-8').write(data)
fails = [r for r in results if not r[1]]
for label, ok, c in results:
    print(('PASS ' if ok else 'FAIL ') + label + ' (' + str(c) + ')')
print('TOTAL', len(results), 'PASS', len(results) - len(fails), 'FAIL', len(fails))
for pat, att in [('stats-periode', 3), ('chart-evolution', 2), ('chart-repartition', 2), ('stats-surveiller', 3),
                 ('barresStats', 7), ('ouvrirFicheEleveParNom', 5)]:
    print('RESIDU', pat, data.count(pat), '(attendu', att, ')')

node = shutil.which('node') or shutil.which('nodejs')
m = re.search(r'<script>(.*)</script>', data, re.DOTALL)
io.open('/data/data/com.termux/files/home/AbsenceTrack-dev/_check54.js', 'w', encoding='utf-8').write(m.group(1))
p = subprocess.run([node, '--check', '/data/data/com.termux/files/home/AbsenceTrack-dev/_check54.js'], capture_output=True, text=True)
print('NODE_CHECK', 'OK' if p.returncode == 0 else 'FAIL\n' + p.stderr[:1500])
print('DIVS', data.count('<div'), data.count('</div>'))
