
// DOM simule
function noeud(){ const o = { innerHTML:'', textContent:'', value:'', style:{}, className:'', enfants:[],
  appendChild(c){ o.enfants.push(c); } }; return o; }
const noeuds = {};
const valeurs = { 'stats-periode':'mois', 'stats-type':'tous', 'stats-debut':'', 'stats-fin':'' };
const document = {
  getElementById(id){ if (!noeuds[id]) { noeuds[id] = noeud(); noeuds[id].value = valeurs[id] !== undefined ? valeurs[id] : ''; } return noeuds[id]; },
  createElement(){ return noeud(); }
};
const utilisateurConnecte = { nom: 'Prof. Mathématiques', role: 'enseignant' };
const classes = [
  { id:1, nom:'3eme A', eleves:[{id:1},{id:2},{id:3}] },
  { id:2, nom:'3eme B', eleves:[{id:4},{id:5},{id:6}] }
];
let classeSelectionnee = classes[0];
const auj = new Date();
const iso = (j) => { const x = new Date(auj); x.setDate(x.getDate() - j); return x.toISOString().slice(0,10); };
const absences = [
  { eleveId:1, classe:'3eme A', nom:'El Amrani Ahmed', type:'absence', statut:'absent',     dateISO: iso(1), seance:'matin',      heure:'08:00', enseignant:'Prof. Mathématiques' },
  { eleveId:1, classe:'3eme A', nom:'El Amrani Ahmed', type:'absence', statut:'justifie_s', dateISO: iso(2), seance:'matin',      heure:'09:00', enseignant:'Prof. Mathématiques' },
  { eleveId:1, classe:'3eme A', nom:'El Amrani Ahmed', type:'absence', statut:'justifie_d', dateISO: iso(3), seance:'apres-midi', heure:'14:00', enseignant:'Prof. Mathématiques' },
  { eleveId:1, classe:'3eme A', nom:'El Amrani Ahmed', type:'absence', statut:'absent',     dateISO: iso(4), seance:'matin',      heure:'10:00', enseignant:'Prof. Mathématiques' },
  { eleveId:1, classe:'3eme A', nom:'El Amrani Ahmed', type:'retard',  statut:'justifie_s', dateISO: iso(5), seance:'matin',      heure:'11:00', enseignant:'Prof. Mathématiques' },
  { eleveId:2, classe:'3eme A', nom:'Fatima Benali',   type:'absence', statut:'absent',     dateISO: iso(2), seance:'matin',      heure:'08:00', enseignant:'Prof. Mathématiques' },
  { eleveId:2, classe:'3eme A', nom:'Fatima Benali',   type:'retard',  statut:'justifie_s', dateISO: iso(6), seance:'matin',      heure:'09:00', enseignant:'Prof. SVT' },
  { eleveId:4, classe:'3eme B', nom:'Nadia Chraibi',   type:'absence', statut:'absent',     dateISO: iso(2), seance:'matin',      heure:'08:00', enseignant:'Prof. Mathématiques' }
];
const COULEUR_ABSENCE = '#ef4444';
const COULEUR_RETARD = '#f59e0b';
const SEUIL_ALERTE_MOIS = 4;
let statsPeriode = 'mois';
let statsType = 'tous';
function sansBalises(t){ return String(t).replace(/<[^>]*>/g, ''); }

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
  const dd = document.getElementById('stats-dates');
  if (dd) dd.style.display = (statsPeriode === 'perso') ? 'grid' : 'none';
}

function changerFiltreStats() {
  lireFiltresStats();
  afficherStatistiques();
}

function bornesPeriode(valeur, idDebut, idFin) {
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

function statsBornes() { return bornesPeriode(statsPeriode, 'stats-debut', 'stats-fin'); }

function statsFiltre(sansClasse) {
  const b = statsBornes();
  const moi = utilisateurConnecte ? utilisateurConnecte.nom : '';
  return absences.filter(a => {
    const d = String(a.dateISO || '');
    if (d < b.debut || d > b.fin) return false;
    if (statsType !== 'tous' && (a.type || 'absence') !== statsType) return false;
    if (a.enseignant !== moi) return false;
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
}
valeur = function(id,v){ document.getElementById(id).value = v; };

function resume(t){
  const tete = noeuds['top-absents'].enfants.map(e => sansBalises(e.innerHTML)).join(' | ');
  const cls = noeuds['chart-absences'].enfants.map(e => sansBalises(e.innerHTML)).join(' | ');
  const rep = sansBalises(noeuds['chart-repartition'].innerHTML || '');
  const tot = sansBalises(noeuds['stats-totaux'].innerHTML || '');
  console.log('--- ' + t);
  console.log('   taux      : ' + noeuds['stat-presence'].textContent + '  (' + noeuds['stat-presence-detail'].textContent + ')');
  console.log('   totaux    : ' + tot);
  console.log('   top       : ' + (tete || '(vide)'));
  console.log('   par classe: ' + (cls || '(vide)'));
  console.log('   anneau    : ' + (rep || '(vide)'));
  console.log('   residus   : evolution=' + (noeuds['chart-evolution'] === undefined) + ' seance=' + (noeuds['chart-seance'] === undefined) + ' jour=' + (noeuds['chart-jour'] === undefined) + ' surveiller=' + (noeuds['stats-surveiller'] === undefined));
}

noeuds['stat-presence'] = noeud(); noeuds['stat-presence-detail'] = noeud();
noeuds['progress-presence'] = noeud();

valeur('stats-periode', 'mois'); valeur('stats-type', 'tous');
afficherStatistiques(); resume('mois + Ab+Rd (mes signalements)');

valeur('stats-type', 'retard'); changerFiltreStats(); resume('mois + retards seuls');

valeur('stats-type', 'tous'); valeur('stats-periode', 'semaine'); changerFiltreStats(); resume('cette semaine + Ab+Rd');

valeur('stats-periode', 'jour'); changerFiltreStats(); resume("aujourd'hui (aucune donnee attendue)");

valeur('stats-periode', 'mois'); changerFiltreStats(); resume('retour mois (memoire des filtres)');
