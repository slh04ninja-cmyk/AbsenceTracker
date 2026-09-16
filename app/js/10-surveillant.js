// fichier: app/js/10-surveillant.js
// ========== SURVEILLANT — DASHBOARD ==========
// Cartes des absences NON JUSTIFIEES.
//   options.aujourdSeulement : true  -> uniquement aujourd'hui (surveillant)
//   options.joursPrecedents  : true  -> uniquement les jours precedents (enseignant)
//   options.enseignant       : nom   -> uniquement ses propres signalements
//   options.action           : 'detail' (popup de signalement, par defaut) ou 'fiche' (fiche eleve)
//   options.titre / options.messageVide : textes optionnels
// Retourne le nombre de cartes affichees.
function afficherCartesAbsentsNonJustifies(idConteneur, options) {
  options = options || {};
  const aujourd = fmtDateISO(new Date());
  const listContainer = document.getElementById(idConteneur);
  if (!listContainer) return 0;

  let liste = absences.filter(a => a.statut === 'absent');
  if (options.enseignant) liste = liste.filter(a => a.enseignant === options.enseignant);
  if (options.aujourdSeulement) liste = liste.filter(a => a.dateISO === aujourd);
  if (options.joursPrecedents) liste = liste.filter(a => String(a.dateISO || '') < aujourd);
  liste = liste.slice().sort((a, b) => {
    const da = String(a.dateISO || '');
    const db = String(b.dateISO || '');
    if (da !== db) return db.localeCompare(da);
    return String(b.heure || '').localeCompare(String(a.heure || ''));
  });

  listContainer.innerHTML = '';
  if (liste.length === 0) {
    listContainer.innerHTML = '<div style="text-align: center; padding: 32px 16px; color: #94a3b8;"><i class="fas fa-user-check" style="font-size: 32px; margin-bottom: 12px; display: block; opacity: 0.4;"></i><p>' + (options.messageVide || "Aucun élève signalé aujourd'hui") + '</p></div>';
    return 0;
  }
  if (options.titre) {
    const entete = document.createElement('div');
    entete.className = 'stat-label mb-2';
    entete.textContent = options.titre;
    listContainer.appendChild(entete);
  }
  liste.forEach(abs => {
    const card = document.createElement('div');
    card.className = 'absence-card carte-eleve';
    if (options.action === 'fiche') card.onclick = () => ouvrirFicheEleveParNom(abs.nom, abs.classe);
    else card.onclick = () => afficherDetailAbsence(abs);
    const jour = String(abs.dateISO || '');
    const dateCourte = (jour && jour !== aujourd) ? ' · ' + jour.slice(8, 10) + '/' + jour.slice(5, 7) : '';
    card.innerHTML = '<div class="absence-card-ligne"><span class="absence-card-name">' + abs.nom + '</span><span class="absence-card-classe">' + abs.classe + dateCourte + '</span><i class="fas fa-chevron-right absence-card-icon"></i></div>';
    listContainer.appendChild(card);
  });
  return liste.length;
}

// Dashboard surveillant : les absents non justifies du jour
// Dashboard enseignant : ses propres absences non justifiees des jours precedents
function mettreAJourDashboardSurv() {
  afficherSeancesAnnulees();
  const now = new Date();
  const today = fmtDateISO(now);
  const currentHour = String(now.getHours()).padStart(2, '0');
  const absencesToday = absences.filter(a => a.dateISO === today);
  const nouveauxCetteHeure = absencesToday.filter(a => a.heure && a.heure.startsWith(currentHour));
  const nonJustifieesJour = absencesToday.filter(a => a.statut === 'absent').length;

  document.getElementById('surv-nouveaux').textContent = nouveauxCetteHeure.length;
  document.getElementById('surv-total-unjustified').textContent = nonJustifieesJour;
  document.getElementById('surv-total-absents').textContent = absencesToday.length;

  // Absents NON JUSTIFIES : aujourd'hui et jours precedents
  afficherCartesAbsentsNonJustifies('surv-absences-list', { messageVide: 'Aucun élève non justifié' });
  afficherAlertesSurv();
}

function elevesAuDessusSeuil(seuil) {
  const mois = fmtDateISO(new Date()).slice(0, 7);
  const map = {};
  absences.forEach(a => {
    if (a.statut === 'justifie_s' || a.statut === 'justifie_d') return;
    if (String(a.dateISO || '').slice(0, 7) !== mois) return;
    if ((a.type || 'absence') !== 'absence') return;
    const cle = a.classe + '|' + a.eleveId;
    if (!map[cle]) map[cle] = { nom: a.nom, classe: a.classe, count: 0 };
    map[cle].count++;
  });
  return Object.values(map).filter(x => x.count >= seuil).sort((a, b) => b.count - a.count);
}

function afficherAlertesSurv() {
  const bloc = document.getElementById('surv-alertes');
  if (!bloc) return;
  const al = elevesAuDessusSeuil(SEUIL_ALERTE_MOIS);
  bloc.innerHTML = '';
  if (al.length === 0) {
    bloc.innerHTML = '<p class="text-gray-500 text-center py-4">Aucune alerte ce mois</p>';
    return;
  }
  al.forEach(x => {
    const item = document.createElement('div');
    item.className = 'flex justify-between items-center p-3 bg-red-50 rounded-lg';
    item.innerHTML = '<div><p class="font-bold text-gray-800">' + x.nom + '</p><p class="text-xs text-gray-500">' + x.classe + '</p></div><span class="badge badge-danger">' + x.count + ' absences</span>';
    bloc.appendChild(item);
  });
}

function afficherDetailAbsence(abs) {
  // Titre du popup = nom complet de l'eleve ; la ligne "Élève" devient son numero dans la liste
  const elTitre = document.getElementById('detail-titre');
  if (elTitre) elTitre.textContent = abs.nom;
  const elNum = document.getElementById('detail-numero');
  if (elNum) {
    const cl = classes.find(c => c.nom === abs.classe);
    const idx = cl ? cl.eleves.findIndex(e => e.id === abs.eleveId) : -1;
    elNum.textContent = idx >= 0 ? String(idx + 1) : '—';
  }
  document.getElementById('detail-classe').textContent = abs.classe;
  // Date et heure sur une seule ligne : {Date} . {Time}
  document.getElementById('detail-date').textContent = abs.date + (abs.heure ? ' . ' + abs.heure : '');
  document.getElementById('detail-prof').textContent = abs.enseignant || '-';
  document.getElementById('detail-matiere').textContent = abrevMatiere(abs.matiere);
  const elType = document.getElementById('detail-type');
  const estRetard = typeEffectif(abs) === 'retard';
  const estExclusion = abs.type === 'exclusion';
  const palType = couleursAbsRd();
  const couleurType = estRetard ? palType.rd : (estExclusion ? '#64748b' : palType.abs);
  elType.innerHTML = '<span style="color: ' + couleurType + '; font-weight: 800;">' + libelleTypeAffiche(abs) + '</span>';

  // Pas de duree pour un retard (regle v3.54)
  const rowDuree = document.getElementById('row-duree');
  if (abs.duree && abs.type !== 'retard') { document.getElementById('detail-duree').textContent = abs.duree; rowDuree.style.display = 'flex'; }
  else rowDuree.style.display = 'none';

  const rowMotif = document.getElementById('row-motif');
  if (abs.motif) { document.getElementById('detail-motif').textContent = abs.motif; rowMotif.style.display = 'flex'; }
  else rowMotif.style.display = 'none';

  const rowPar = document.getElementById('row-justifie-par');
  const rowLe = document.getElementById('row-justifie-le');
  if (abs.justifiePar) {
    document.getElementById('detail-justifie-par').textContent = abs.justifiePar;
    document.getElementById('detail-justifie-le').textContent = abs.justifieLe || '-';
    rowPar.style.display = 'flex';
    rowLe.style.display = 'flex';
  } else {
    rowPar.style.display = 'none';
    rowLe.style.display = 'none';
  }

  const lignesEleve = absences.filter(a => a.eleveId === abs.eleveId && a.classe === abs.classe);
  const nbAbsEleve = lignesEleve.filter(a => typeEffectif(a) !== 'retard').length;
  const nbRetEleve = lignesEleve.filter(a => typeEffectif(a) === 'retard').length;
  document.getElementById('detail-historique').textContent =
    nbAbsEleve + ' ' + (nbAbsEleve < 2 ? 'absence' : 'absences') + ' · ' + nbRetEleve + ' ' + (nbRetEleve < 2 ? 'retard' : 'retards');

  const blocMotif = document.getElementById('bloc-motif');
  const btnJustifier = document.getElementById('btn-justifier-absence');
  if (abs.statut === 'absent') {
    if (blocMotif) blocMotif.style.display = 'block';
    const champMotif = document.getElementById('select-motif');
    if (champMotif) champMotif.value = 'Maladie';
    document.querySelectorAll('#chips-motif .motif-chip').forEach((c, i) => c.classList.toggle('actif', i === 0));
    btnJustifier.style.display = 'block';
    const sourceJustif = (utilisateurConnecte && utilisateurConnecte.role === 'directeur') ? 'dir' : 'surv';
    btnJustifier.onclick = () => { justifierAbsence(abs.id, sourceJustif); fermerDetailAbsence(); };
  } else {
    if (blocMotif) blocMotif.style.display = 'none';
    btnJustifier.style.display = 'none';
  }

  document.getElementById('modal-absence-detail').classList.remove('hidden');
}

function fermerDetailAbsence() {
  document.getElementById('modal-absence-detail').classList.add('hidden');
}

// ========== SURVEILLANT — CLASSES ==========
function afficherHistoriqueRegles(idConteneur) {
  const div = document.getElementById(idConteneur);
  div.innerHTML = '';
  const map = {};
  absences.forEach(a => {
    // On ignore les Ab/Rd non regles (statut Non justifiee)
    if (a.statut !== 'justifie_s' && a.statut !== 'justifie_d') return;
    const cle = a.eleveId + '|' + a.classe;
    if (!map[cle]) map[cle] = { nom: a.nom, classe: a.classe, count: 0, dernier: '' };
    map[cle].count++;
    const dt = String(a.dateISO || '') + ' ' + String(a.heure || '');
    if (dt > map[cle].dernier) map[cle].dernier = dt;
  });
  // Tri : total (Ab+Rd) decroissant, puis datetime la plus recente
  const liste = Object.values(map).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return String(b.dernier).localeCompare(String(a.dernier));
  });
  if (liste.length === 0) {
    div.innerHTML = '<p class="text-gray-500 text-center py-8">Aucun Ab/Rd réglé</p>';
    return;
  }
  liste.forEach(x => {
    const item = document.createElement('div');
    item.className = 'carte-eleve';
    item.onclick = () => ouvrirFicheEleveParNom(x.nom, x.classe);
    item.innerHTML = `
      <div class="absence-card-ligne">
        <span class="absence-card-name">${x.nom}</span>
        <span class="absence-card-classe">${x.classe}</span>
        <span class="carte-eleve-total">${x.count}</span>
        <i class="fas fa-chevron-right absence-card-icon"></i>
      </div>
    `;
    div.appendChild(item);
  });
}

// ========== SURVEILLANT — RAPPORTS ==========

// ========== JUSTIFIER ABSENCE ==========
function justifierAbsence(id, source) {
  const abs = absences.find(a => a.id === id);
  if (!abs) return;
  // PRINCIPE : un surveillant declare absent ne justifie RIEN, quelle que soit la date de
  // l'absence de l'eleve — parce qu'un eleve doit se presenter en personne a son bureau
  // pour justifier. Le refus porte donc sur SA presence AUJOURD'HUI, pas sur la date de la
  // ligne a traiter (erreur corrigee).
  if (String((utilisateurConnecte || {}).role || '') !== 'directeur' &&
      typeof refuserSiAbsent === 'function' && typeof momentDuMomentPresent === 'function') {
    try { if (refuserSiAbsent(jourCourant(), momentDuMomentPresent())) return; } catch (e) {}
  }
  abs.statut = source === 'surv' ? 'justifie_s' : 'justifie_d';
  const sel = document.getElementById('select-motif');
  abs.motif = (sel && sel.value) ? sel.value : (abs.motif || 'Non justifié');
  abs.justifiePar = utilisateurConnecte ? utilisateurConnecte.nom : '';
  const now = new Date();
  abs.justifieLe = fmtDateISO(now) + ' ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  Depot.ecrireJSON('absences', absences);
  if (source === 'surv') mettreAJourDashboardSurv();
  if (source === 'dir') mettreAJourDashboardDir();
  afficherToast(libelleStatutAbs(abs) + ' · ' + abs.motif, 'modif');
}

