// fichier: app/js/09-stats.js
// ========== ENSEIGNANT — STATISTIQUES ==========
// ========== STATISTIQUES ENSEIGNANT ==========
let statsPeriode = 'mois';
let statsType = 'tous';

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
  } else if (valeur === 's1' || valeur === 's2' || valeur === 'annee') {
    const i = valeur === 's2' ? 1 : 0;
    const d = (valeur === 'annee') ? anneeScolaire.semestres[0] : anneeScolaire.semestres[i];
    const f = (valeur === 'annee') ? anneeScolaire.semestres[1] : anneeScolaire.semestres[i];
    if (d && d.debut) debut = new Date(d.debut + 'T00:00:00');
    if (f && f.fin) fin = new Date(f.fin + 'T00:00:00');
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
  const u = utilisateurConnecte || {};
  const net = function (v) { return String(v || '').toLowerCase().trim(); };
  const moi = net(u.nom);
  // L'AUTEUR se compare par identifiant (nom, code ou adresse) : un nom reecrit ne doit
  // plus fausser les statistiques d'un professeur.
  const miens = [moi, net(u.code), net(u.email), net(String(u.email || '').split('@')[0])];
  const estMonAuteur = function (valeur) {
    const x = net(valeur);
    return miens.indexOf(x) >= 0 || miens.indexOf(x.split('@')[0]) >= 0;
  };
  // Les CLASSES OU CE PROFESSEUR ENSEIGNE (deduites de son emploi du temps) : les classes
  // qui ne lui ont pas donne ne doivent pas peser dans ses statistiques.
  const roleEnseignant = String(u.role || '') === 'enseignant';
  const mesClasses = (function () {
    const t = {};
    try {
      const cle = net(u.email) || net(u.code) || moi;
      const racine = cle.split('@')[0];
      Object.keys(tableauxService || {}).forEach(function (k) {
        const kk = net(k);
        const pourMoi = kk === cle || kk.split('@')[0] === racine ||
                        (typeof nomsProfs !== 'undefined' && nomsProfs && net(nomsProfs[k]) === moi);
        if (!pourMoi) return;
        (tableauxService[k] || []).forEach(function (c) { if (c.classe) t[String(c.classe)] = true; });
      });
    } catch (e) {}
    return t;
  })();
  const aDesClasses = Object.keys(mesClasses).length > 0;
  return absences.filter(a => {
    const d = String(a.dateISO || '');
    if (d < b.debut || d > b.fin) return false;
    if (statsType !== 'tous' && (a.type || 'absence') !== statsType) return false;
    if (absenceEnSeanceAnnulee(a)) return false;   // seance annulee : ne compte pas
    if (!estMonAuteur(a.enseignant)) return false;                             // ses propres saisies
    if (roleEnseignant && aDesClasses && !mesClasses[String(a.classe)]) return false;   // ses classes
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

// Barres horizontales : nom a gauche, barre qui se remplit, valeur a droite (meme ligne)
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

function afficherStatistiques() {
  lireFiltresStats();
  const b = statsBornes();
  const pal = couleursAbsRd();
  const filtres = classeSelectionnee ? statsFiltre(false) : [];

  // --- Taux de presence (classe + periode, toutes matieres) ---
  if (classeSelectionnee) {
    // memes regles que cote directeur : eleves actifs x seances DUES (tableau de service)
    const nbSeances = seancesDuesClasse(classeSelectionnee.nom, b.debut, b.fin);
    const nbAbsClasse = absencesCompteesPeriode(b.debut, b.fin, classeSelectionnee.nom).length;
    const totalEleves = elevesActifs(classeSelectionnee).length;
    const places = totalEleves * nbSeances;
    const elT = document.getElementById('stat-presence');
    const elB = document.getElementById('progress-presence');
    const elD = document.getElementById('stat-presence-detail');
    if (places === 0) {
      // Aucun tableau de service sur la periode : un pourcentage n'aurait aucun sens.
      elT.textContent = '—';
      elB.style.width = '0%';
      elD.textContent = totalEleves + ' élèves · aucune séance due sur la période';
    } else {
      const taux = Math.max(0, Math.min(100, Math.round(((places - nbAbsClasse) / places) * 100)));
      elT.textContent = taux + '%';
      elB.style.width = taux + '%';
      elD.textContent = totalEleves + ' élèves · ' + nbSeances + ' séance(s) due(s) · ' + nbAbsClasse + ' absence(s) sur la période';
    }
  } else {
    document.getElementById('stat-presence').textContent = '—';
    document.getElementById('progress-presence').style.width = '0%';
    document.getElementById('stat-presence-detail').textContent = 'Choisissez une classe pour le détail';
  }

  // --- Totaux ---
  const nbAb = filtres.filter(a => typeEffectif(a) !== 'retard').length;
  const nbRd = filtres.filter(a => typeEffectif(a) === 'retard').length;
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
    if (typeEffectif(a) !== 'retard') parEleve[cle].nbAb++;
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

