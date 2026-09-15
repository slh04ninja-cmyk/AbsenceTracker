// fichier: app/js/11-directeur.js
// ========== DIRECTEUR — DASHBOARD ==========
function mettreAJourDashboardDir() {
  afficherSeancesAnnulees();
  // Memes indicateurs que le Dashboard du surveillant (etablissement entier)
  const maintenant = new Date();
  const today = fmtDateISO(maintenant);
  const heureCourante = String(maintenant.getHours()).padStart(2, '0');
  const absencesToday = absences.filter(a => a.dateISO === today);
  const nouveauxCetteHeure = absencesToday.filter(a => a.heure && a.heure.startsWith(heureCourante)).length;
  const nonJustifieesJour = absencesToday.filter(a => a.statut === 'absent').length;

  document.getElementById('dir-nouveaux').textContent = nouveauxCetteHeure;
  document.getElementById('dir-nonjustifiees').textContent = nonJustifieesJour;
  document.getElementById('dir-total').textContent = absencesToday.length;

  // Absents NON JUSTIFIES : aujourd'hui et jours precedents (toute l'etablissement)
  afficherCartesAbsentsNonJustifies('dir-absences-list', { messageVide: 'Aucun élève non justifié' });

}

// ========== DIRECTEUR — GESTION CRUD ==========
function afficherGestionDir() {
  bornerDatesAnnee();
  afficherFermetures();
  afficherAnnulationsEnregistrees();
  preparerFormulaireAnnulation();
  // Afficher la liste des classes
  const listDiv = document.getElementById('dir-classes-list');
  listDiv.innerHTML = '';
  if (classes.length === 0) {
    listDiv.innerHTML = '<p class="text-gray-500 text-center py-8">Aucune classe. Importez un fichier MASSAR.</p>';
    return;
  }
  // Carte = nom de la classe + effectif ; les eleves s'affichent dans le popup (clic)
  classes.forEach(cl => {
    const item = document.createElement('div');
    item.className = 'bg-gray-50 rounded-xl px-4 py-2 cursor-pointer';
    item.setAttribute('onclick', 'ouvrirDetailClasse(' + cl.id + ')');
    item.innerHTML =
      '<div class="flex justify-between items-center">' +
        '<span class="font-bold text-gray-800">' + cl.nom + '</span>' +
        '<span class="flex items-center gap-2">' +
          '<span class="text-sm text-gray-500">' + cl.eleves.length + ' élèves</span>' +
          '<i class="fas fa-chevron-right text-gray-400"></i>' +
        '</span>' +
      '</div>';
    listDiv.appendChild(item);
  });
}

// ========== ÉLÈVES « SORTIS » (a quitte l'etablissement) ==========
// Un eleve marque sorti (actif === false) n'apparait plus dans l'appel du jour, mais il
// garde TOUT son historique (ses absences/retards restent consultables) et il peut etre
// RETABLI. On ne supprime donc plus un eleve pour le retirer des listes.
// (Le champ `actif` est deja prevu dans la base : c'est la meme semantique.)
function estSorti(e) { return !!e && e.actif === false; }

function elevesActifs(classe) {
  const liste = (classe && classe.eleves) ? classe.eleves : [];
  return liste.filter(e => !estSorti(e));
}

function marquerEleveSorti(classeId, eleveId, sorti) {
  const cl = classes.find(c => c.id === classeId);
  if (!cl) return;
  const el = cl.eleves.find(e => e.id === eleveId);
  if (!el) return;
  if (sorti) el.actif = false; else delete el.actif;
  sauvegarderClasses();
  if (classeDetailCourante === classeId) ouvrirDetailClasse(classeId);
  mettreAJourDashboardDir();
  if (classeSelectionnee && classeSelectionnee.id === classeId) afficherListeEleves();
  afficherToast(sorti ? 'Élève marqué sorti (historique conservé)' : 'Élève rétabli', 'modif');
}

// Suppression d'un eleve : confirmation obligatoire avant d'appliquer
function demanderSuppressionEleve(classeId, eleveId) {
  const cl = classes.find(c => c.id === classeId);
  const el = cl ? cl.eleves.find(e => e.id === eleveId) : null;
  if (!cl || !el) return;
  demanderConfirmation('Supprimer définitivement ' + libelleEleve(el) + ' de la classe ' + cl.nom +
    ' ? Son historique de signalements est conservé. Pour un élève qui a quitté l\'établissement, préférez « Marquer sorti ».',
    function () {
    supprimerEleve(classeId, eleveId);
    ouvrirDetailClasse(classeId);
  });
}

function supprimerEleve(classeId, eleveId) {
  const classe = classes.find(c => c.id === classeId);
  if (!classe) return;
  classe.eleves = classe.eleves.filter(e => e.id !== eleveId);
  // LES SIGNALEMENTS SONT CONSERVES : ils portent le nom, la classe et la date, donc
  // l'historique de l'annee reste consultable. Avant, cette ligne les effacait :
  // supprimer un eleve detruisait son dossier sans que rien ne le dise.
  sauvegarderClasses();
  afficherGestionDir();
  mettreAJourDashboardDir();
  afficherToast('Eleve supprimé', 'suppression');
}

// Suppression d'une classe : confirmation obligatoire (elle emporte ses eleves et leurs signalements)
function demanderSuppressionClasse() {
  const cl = classes.find(c => c.id === classeDetailCourante);
  if (!cl) return;
  demanderConfirmation('Supprimer la classe ' + cl.nom + ' et ses ' + cl.eleves.length + " élève(s) ? Les signalements liés seront aussi supprimés.", function () {
    supprimerClasseCourante();
  });
}

function supprimerClasseCourante() {
  if (classeDetailCourante) {
    const cl = classes.find(c => c.id === classeDetailCourante);
    if (cl) {
      absences = absences.filter(a => a.classe !== cl.nom);
      Depot.ecrireJSON('absences', absences);
    }
    classes = classes.filter(c => c.id !== classeDetailCourante);
    sauvegarderClasses();
    fermerDetailClasse();
    afficherGestionDir();
    mettreAJourDashboardDir();
    afficherToast('Classe supprimée', 'suppression');
  }
}

function ouvrirDetailClasse(id) {
  classeDetailCourante = id;
  const cl = classes.find(c => c.id === id);
  if (!cl) return;
  document.getElementById('detail-classe-titre').textContent = cl.nom;
  const elevesDiv = document.getElementById('detail-classe-eleves');
  if (cl.eleves.length === 0) {
    elevesDiv.innerHTML = '<p class="text-gray-500 text-center py-4">Aucun élève</p>';
  } else {
    const sortis = cl.eleves.filter(estSorti).length;
    elevesDiv.innerHTML = '<p class="text-xs text-gray-500 mb-2">' + (cl.eleves.length - sortis) + ' élève(s) actif(s)' +
      (sortis ? ' · ' + sortis + ' sorti(s) (masqués à l\'appel)' : '') + '</p>' +
      cl.eleves.map(e =>
      `<div class="ligne-classe-eleve${estSorti(e) ? ' ligne-classe-sortie' : ''} flex justify-between items-center p-3 rounded-lg mb-2">
        <div>
          <span class="font-medium">${libelleEleve(e)}</span>
          ${e.massar ? '<span class="text-xs text-gray-400 ml-2">(' + e.massar + ')</span>' : ''}
          ${estSorti(e) ? '<span class="etiquette-sorti text-xs font-bold ml-2">sorti</span>' : ''}
        </div>
        <div class="flex items-center gap-3">
          <button onclick="marquerEleveSorti(${cl.id}, ${e.id}, ${estSorti(e) ? 'false' : 'true'})" class="js-sortir-eleve text-base" title="${estSorti(e) ? 'Rétablir cet élève' : 'Marquer cet élève sorti'}" style="color:${estSorti(e) ? '#ef4444' : '#94a3b8'};">
            <i class="fas fa-user-slash"></i>
          </button>
          <button onclick="demanderSuppressionEleve(${cl.id}, ${e.id})" class="js-supprimer-eleve text-red-500 hover:text-red-700"><i class="fas fa-trash-alt"></i></button>
        </div>
      </div>`
    ).join('');
  }
  document.getElementById('modal-classe-detail').classList.remove('hidden');
}

function fermerDetailClasse() {
  document.getElementById('modal-classe-detail').classList.add('hidden');
  classeDetailCourante = null;
}

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
    if (absenceEnSeanceAnnulee(a)) return false;   // seance annulee : ne compte pas
    return true;
  });
}

// Titre de la carte Tendance selon la periode choisie + donnees correspondantes
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

function afficherStatistiquesDir() {
  lireFiltresStatsDir();
  const b = bornesPeriode(dirStatsPeriode, 'dir-stats-debut', 'dir-stats-fin');
  const pal = couleursAbsRd();
  const filtres = statsDirFiltre();

  // --- Taux de presence de l'etablissement : eleves ACTIFS x seances DUES ---
  // Les seances viennent du tableau de service (moins fermetures, annulations et absences
  // de professeurs) : le taux ne depend donc plus du nombre de signalements.
  let totalEleves = 0, nbSeances = 0, places = 0;
  classes.forEach(c => {
    const eff = elevesActifs(c).length;
    const dues = seancesDuesClasse(c.nom, b.debut, b.fin);
    totalEleves += eff;
    nbSeances += dues;
    places += eff * dues;
  });
  const nbAbsEtab = absencesCompteesPeriode(b.debut, b.fin).length;
  const elTaux = document.getElementById('dir-stat-presence');
  const elBarre = document.getElementById('dir-progress-presence');
  const elDetail = document.getElementById('dir-stat-presence-detail');
  if (places === 0) {
    // Aucun tableau de service sur la periode : un pourcentage n'aurait aucun sens.
    if (elTaux) elTaux.textContent = '—';
    if (elBarre) elBarre.style.width = '0%';
    if (elDetail) elDetail.textContent = totalEleves + ' élèves · aucune séance due sur la période';
  } else {
    const taux = Math.max(0, Math.min(100, Math.round(((places - nbAbsEtab) / places) * 100)));
    if (elTaux) elTaux.textContent = taux + '%';
    if (elBarre) elBarre.style.width = taux + '%';
    if (elDetail) elDetail.textContent = totalEleves + ' élèves · ' + nbSeances + ' séance(s) due(s) · ' + nbAbsEtab + ' absence(s) sur la période';
  }

  // --- Tendance selon la periode ---
  const elTitreTendance = document.getElementById('dir-tendance-titre');
  if (elTitreTendance) elTitreTendance.textContent = 'Tendance ' + libelleTendanceDir();
  barresStats('dir-chart-tendance', tendanceDirStats(filtres, b));

  // --- Compteurs Ab / Rd / Non justifiees (filtres periode + type) ---
  const nbAb = filtres.filter(a => typeEffectif(a) !== 'retard').length;
  const nbRd = filtres.filter(a => typeEffectif(a) === 'retard').length;
  const nbNonJust = filtres.filter(a => a.statut === 'absent').length;
  const bloc = document.getElementById('dir-stats-totaux');
  if (bloc) {
    bloc.innerHTML =
      '<div class="stat-mini stat-card" style="margin: 0; text-align: center;"><div class="stat-label" style="font-size: 10px;">ABSENCES</div><div class="stat-value" style="font-size: 22px; color: ' + pal.abs + ';">' + nbAb + '</div></div>' +
      '<div class="stat-mini stat-card" style="margin: 0; text-align: center;"><div class="stat-label" style="font-size: 10px;">RETARDS</div><div class="stat-value" style="font-size: 22px; color: ' + pal.rd + ';">' + nbRd + '</div></div>' +
      '<div class="stat-mini stat-card" style="margin: 0; text-align: center;"><div class="stat-label" style="font-size: 10px;">NON JUST.</div><div class="stat-value" style="font-size: 22px;">' + nbNonJust + '</div></div>';
  }

  // --- Par classe (barres horizontales : la valeur est a droite de la barre) ---
  barresHorizontalesStats('dir-chart-absences', classes.map(cl => ({
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
        // Meme carte que dans l'historique (nom / classe / pastille du nombre / chevron)
        const row = document.createElement('div');
        row.className = 'carte-eleve';
        row.onclick = () => ouvrirFicheEleveParNom(x.nom, x.classe);
        row.innerHTML =
          '<div class="absence-card-ligne">' +
            '<span class="absence-card-name">' + x.nom + '</span>' +
            '<span class="absence-card-classe">' + x.classe + '</span>' +
            '<span class="carte-eleve-total">' + x.total + '</span>' +
            '<i class="fas fa-chevron-right absence-card-icon"></i>' +
          '</div>';
        topDiv.appendChild(row);
      });
    }
  }
}

