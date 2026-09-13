
function noeud(){ const o = { innerHTML:'', textContent:'', value:'', style:{}, className:'', appendChild(c){ o.enfants = o.enfants || []; o.enfants.push(c); } }; return o; }
const noeuds = {};
const valeurs = { 'stats-periode':'mois', 'stats-type':'tous', 'stats-seance':'toutes', 'stats-perimetre':'moi', 'stats-debut':'', 'stats-fin':'' };
const document = {
  getElementById(id){ if (!noeuds[id]) { noeuds[id] = noeud(); noeuds[id].value = valeurs[id] !== undefined ? valeurs[id] : ''; } return noeuds[id]; },
  createElement(){ return noeud(); }
};
const utilisateurConnecte = { nom: 'Prof. Mathématiques', role: 'enseignant' };
const classes = [{ id:1, nom:'3ème A', eleves:[{id:1,nom:'El Amrani',prenom:'Ahmed'},{id:2,nom:'Benali',prenom:'Fatima'},{id:3,nom:'Alami',prenom:'Mohamed'}] }];
let classeSelectionnee = classes[0];
const auj = new Date();
const iso = (j) => { const x = new Date(auj); x.setDate(x.getDate() - j); return x.toISOString().slice(0,10); };
const absences = [
  { eleveId:1, classe:'3ème A', nom:'El Amrani Ahmed', type:'absence', statut:'absent',     dateISO: iso(1), seance:'matin',       heure:'08:00', enseignant:'Prof. Mathématiques' },
  { eleveId:1, classe:'3ème A', nom:'El Amrani Ahmed', type:'absence', statut:'justifie_s', dateISO: iso(2), seance:'matin',       heure:'09:00', enseignant:'Prof. Mathématiques' },
  { eleveId:1, classe:'3ème A', nom:'El Amrani Ahmed', type:'absence', statut:'justifie_d', dateISO: iso(3), seance:'apres-midi',  heure:'14:00', enseignant:'Prof. Mathématiques' },
  { eleveId:1, classe:'3ème A', nom:'El Amrani Ahmed', type:'absence', statut:'absent',     dateISO: iso(4), seance:'matin',       heure:'10:00', enseignant:'Prof. Mathématiques' },
  { eleveId:1, classe:'3ème A', nom:'El Amrani Ahmed', type:'retard',  statut:'justifie_s', dateISO: iso(5), seance:'matin',       heure:'11:00', enseignant:'Prof. Mathématiques' },
  { eleveId:2, classe:'3ème A', nom:'Fatima Benali',   type:'absence', statut:'absent',     dateISO: iso(2), seance:'matin',       heure:'08:00', enseignant:'Prof. Mathématiques' },
  { eleveId:2, classe:'3ème A', nom:'Fatima Benali',   type:'retard',  statut:'justifie_s', dateISO: iso(6), seance:'matin',       heure:'09:00', enseignant:'Prof. SVT' }
];
const COULEUR_ABSENCE = '#ef4444';
const COULEUR_RETARD = '#f59e0b';
const SEUIL_ALERTE_MOIS = 4;
let statsPeriode = 'mois';
let statsType = 'tous';
let statsSeance = 'toutes';
let statsPerimetre = 'moi';
function fmtDateISO(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const j = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + j;
}
function couleursAbsRd() {
  return { abs: COULEUR_ABSENCE, rd: COULEUR_RETARD };
}
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
}
function parcours(titre, modifs) {
  Object.keys(modifs).forEach(k => { valeurs[k] = modifs[k]; if (noeuds[k]) noeuds[k].value = modifs[k]; });
  noeuds['stats-totaux'] = noeud(); noeuds['top-absents'] = noeud(); noeuds['stats-surveiller'] = noeud();
  noeuds['chart-evolution'] = noeud(); noeuds['chart-seance'] = noeud(); noeuds['chart-jour'] = noeud(); noeuds['chart-absences'] = noeud(); noeuds['chart-repartition'] = noeud();
  afficherStatistiques();
  const txt = (o) => (o.innerHTML || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  console.log('### ' + titre);
  console.log('   taux:', noeuds['stat-presence'].textContent, '|', noeuds['stat-presence-detail'].textContent);
  console.log('   totaux:', txt(noeuds['stats-totaux']));
  console.log('   top:', txt(noeuds['top-absents']));
  console.log('   a surveiller:', txt(noeuds['stats-surveiller']));
  console.log('   evolution bars:', (noeuds['chart-evolution'].enfants || []).map(b => (b.innerHTML.match(/>\d+</) || [''])[0].replace(/[><]/g, '')).join(','));
  console.log('   seance bars:', (noeuds['chart-seance'].enfants || []).map(b => (b.innerHTML.match(/>\d+</) || [''])[0].replace(/[><]/g, '')).join(','));
  console.log('   jour bars:', (noeuds['chart-jour'].enfants || []).map(b => (b.innerHTML.match(/>\d+</) || [''])[0].replace(/[><]/g, '')).join(','));
}
parcours('MOIS / mes signalements (defaut)', {});
parcours('MOIS / tous les profs', { 'stats-perimetre': 'tous' });
parcours('MOIS / retards seulement', { 'stats-type': 'retard' });
parcours('MOIS / apres-midi seulement', { 'stats-seance': 'apres-midi' });
