// fichier: app/js/08-enseignant.js
// ========== ENSEIGNANT — CLASSE & ÉLÈVES ==========
function remplirListeClasses() {
  ['select-classe', 'select-classe-stats'].forEach(idSelect => {
    const select = document.getElementById(idSelect);
    if (!select) return;
    select.innerHTML = '<option value="">-- Choisir une classe --</option>';
    classes.forEach(classe => {
      const opt = document.createElement('option');
      opt.value = classe.id;
      opt.textContent = classe.nom + ' (' + classe.eleves.length + ' élèves)';
      select.appendChild(opt);
    });
  });
}

function choisirClasse(id) {
  id = parseInt(id);
  const selClasse = document.getElementById('select-classe');
  const selStats = document.getElementById('select-classe-stats');
  const zone = document.getElementById('zone-prise-absence');
  if (selClasse) selClasse.value = id ? String(id) : '';
  if (selStats) selStats.value = id ? String(id) : '';

  if (!id) {
    classeSelectionnee = null;
    elevesCoches.clear();
    decochesManuellement.clear();
    const elEnsClasse = document.getElementById('ens-classe-name'); if (elEnsClasse) elEnsClasse.textContent = 'Sélectionnez une classe';
    if (zone) zone.classList.add('hidden');
    const liste = document.getElementById('liste-eleves-enseignant');
    if (liste) liste.innerHTML = '';
    mettreAJourEnteteListe();
    return;
  }
  if (!classeSelectionnee || classeSelectionnee.id !== id) {
    classeSelectionnee = classes.find(c => c.id === id);
    if (classeSelectionnee) {
      elevesCoches.clear();
      decochesManuellement.clear();
    }
  }
  if (!classeSelectionnee) return;
  const elEnsClasse2 = document.getElementById('ens-classe-name'); if (elEnsClasse2) elEnsClasse2.textContent = classeSelectionnee.nom;
  if (zone) zone.classList.remove('hidden');
  afficherListeEleves();
  mettreAJourEnteteListe();
}

function afficherInfosProf() {
  const bloc = document.getElementById('ens-prof-info'); if (!bloc) return;
  if (!bloc) return;
  if (utilisateurConnecte && utilisateurConnecte.role === 'enseignant') {
    bloc.textContent = utilisateurConnecte.nom + (utilisateurConnecte.matiere ? ' · ' + utilisateurConnecte.matiere : '');
  } else {
    bloc.textContent = '';
  }
}

function changerClasse() {
  choisirClasse(document.getElementById('select-classe').value);
}

function changerClasseStats() {
  choisirClasse(document.getElementById('select-classe-stats').value);
  afficherStatistiques();
}

function afficherListeEleves() {
  const div = document.getElementById('liste-eleves-enseignant');
  div.innerHTML = '';
  if (!classeSelectionnee) return;
  // les eleves sortis ne figurent PLUS dans l'appel du jour (leur historique est intact)
  const tousLesEleves = elevesActifs(classeSelectionnee);
  const jour = jourCourant();
  const seance = seanceCourante();
  const moi = utilisateurConnecte.nom;
  const memeSeance = a => (a.seance || 'matin') === seance;

  const incidentsJour = absences.filter(a =>
    a.classe === classeSelectionnee.nom && a.dateISO === jour && memeSeance(a) &&
    a.statut !== 'justifie_s' && a.statut !== 'justifie_d'
  );
  const typeMoi = {};
  const typeAutre = {};
  const quiAutre = {};
  incidentsJour.forEach(a => {
    if (a.enseignant === moi) {
      if (!typeMoi[a.eleveId]) typeMoi[a.eleveId] = typeEffectif(a);
    } else if (!typeAutre[a.eleveId]) {
      typeAutre[a.eleveId] = typeEffectif(a);
      quiAutre[a.eleveId] = a.enseignant;
    }
  });
  // Regle : un eleve ne peut avoir qu'UN SEUL Ab/Rd non justifie.
  // Tout enregistrement en attente HORS de la seance en cours verrouille l'eleve.
  const typePrecedent = {};
  const raisonPrecedent = {};
  absences.forEach(a => {
    if (a.classe !== classeSelectionnee.nom) return;
    if (a.statut === 'justifie_s' || a.statut === 'justifie_d') return;
    const memeJour = a.dateISO === jour;
    const memeSeance = (a.seance || 'matin') === seance;
    if (memeJour && memeSeance) return;
    if (!typePrecedent[a.eleveId]) {
      typePrecedent[a.eleveId] = typeEffectif(a);
      raisonPrecedent[a.eleveId] = memeJour ? 'non justifié · autre séance' : 'non justifié';
    }
  });

  tousLesEleves.forEach(eleve => {
    const id = eleve.id;
    const parAutre = Object.prototype.hasOwnProperty.call(typeAutre, id);
    const precedent = !parAutre && Object.prototype.hasOwnProperty.call(typePrecedent, id);
    const verrouille = parAutre || precedent;
    let marque = null;
    if (parAutre) marque = typeAutre[id];
    else if (precedent) marque = typePrecedent[id];
    else if (elevesCoches.has(id)) marque = elevesCoches.get(id);
    else if (Object.prototype.hasOwnProperty.call(typeMoi, id) && !decochesManuellement.has(id)) marque = typeMoi[id];

    const cocheRetard = marque === 'retard';
    const cocheAbsent = marque !== null && marque !== 'retard';
    const estCoche = cocheAbsent || cocheRetard;
    const numero = tousLesEleves.findIndex(e => e.id === id) + 1;

    const palAbsRd = couleursAbsRd();
    const couleur = cocheRetard ? palAbsRd.rd : palAbsRd.abs;
    const enSombre = document.body.classList.contains('theme-sombre');
    const couleurBordure = enSombre ? eclaircir(couleur, 0.35) : couleur;
    const fond = teinte(couleur, enSombre ? 0.20 : 0.10);
    const item = document.createElement('div');
    item.className = 'flex items-center px-4 py-3 transition-all';
    const bordureBas = enSombre ? '#334155' : '#f1f5f9';
    item.style = 'border-bottom: 1px solid ' + bordureBas + '; border-left: 5px solid ' + (estCoche ? couleurBordure : 'transparent') + ';' + (estCoche ? ' background: ' + fond + ';' : '');

    const cbA = verrouille
      ? '<label class="check"><input type="checkbox" ' + (cocheAbsent ? 'checked' : '') + ' disabled class="checkbox-locked"><span class="box"></span></label>'
      : '<label class="check"><input type="checkbox" ' + (cocheAbsent ? 'checked' : '') + ' onchange="basculerMarque(' + id + ', &quot;absence&quot;, this.checked)" class="checkbox-material"><span class="box"></span></label>';
    const cbR = verrouille
      ? '<label class="check"><input type="checkbox" ' + (cocheRetard ? 'checked' : '') + ' disabled class="checkbox-locked"><span class="box"></span></label>'
      : '<label class="check"><input type="checkbox" ' + (cocheRetard ? 'checked' : '') + ' onchange="basculerMarque(' + id + ', &quot;retard&quot;, this.checked)" class="checkbox-material"><span class="box"></span></label>';

    let raison = '';
    if (parAutre) raison = 'déjà signalé · ' + (quiAutre[id] || 'un autre enseignant');
    else if (precedent) raison = raisonPrecedent[id] || 'non justifié';

    const styleChip = estCoche ? ('background: ' + couleur + '; color: #fff;') : (enSombre ? 'background: #334155; color: #bfdbfe;' : 'background: #dbeafe; color: #1e3a8a;');
    const styleNom = estCoche ? ('color: ' + couleur + '; font-weight: 600;') : ('color: ' + (document.body.classList.contains('theme-sombre') ? '#e2e8f0' : '#1f2937') + ';');

    item.innerHTML = `
      <span class="inline-flex items-center justify-center rounded-full text-xs font-bold" style="width: 28px; height: 28px; flex-shrink: 0; margin-right: 10px; ${styleChip}">${numero}</span>
      <span style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; ${styleNom}">${libelleEleve(eleve)}${verrouille ? ' <i class="fas fa-lock lock-icon"></i>' : ''}${raison ? ' <span class="text-xs text-gray-400">(' + raison + ')</span>' : ''}</span>
      <label class="flex items-center justify-center" style="width: 46px; flex-shrink: 0;">${cbA}<span class="text-xs font-bold ml-1">A</span></label>
      <label class="flex items-center justify-center" style="width: 46px; flex-shrink: 0;">${cbR}<span class="text-xs font-bold ml-1">R</span></label>
    `;
    div.appendChild(item);
  });
}

function basculerMarque(id, type, coche) {
  const jour = jourCourant();
  const seance = seanceCourante();
  if (coche) {
    const enAttenteAilleurs = absences.some(a =>
      a.eleveId === id && a.classe === classeSelectionnee.nom &&
      a.statut !== 'justifie_s' && a.statut !== 'justifie_d' &&
      !(a.dateISO === jour && (a.seance || 'matin') === seance)
    );
    if (enAttenteAilleurs) {
      afficherToast('Un seul Ab/Rd non justifié par élève', 'error');
      afficherListeEleves();
      return;
    }
  }
  if (!coche) {
    const enregistreParAutre = absences.some(a =>
      a.eleveId === id && a.classe === classeSelectionnee.nom && a.dateISO === jour &&
      (a.seance || 'matin') === seance &&
      a.statut !== 'justifie_s' && a.statut !== 'justifie_d' && a.enseignant !== utilisateurConnecte.nom
    );
    if (enregistreParAutre) {
      afficherToast('Signalement enregistré par un autre enseignant', 'error');
      afficherListeEleves();
      return;
    }
    elevesCoches.delete(id);
    decochesManuellement.add(id);
    absences = absences.filter(a => !(a.eleveId === id && a.dateISO === jour && (a.seance || 'matin') === seance && a.classe === classeSelectionnee.nom));
    Depot.ecrireJSON('absences', absences);
  } else {
    // Un seul type à la fois : on remplace mon enregistrement du jour (même séance)
    absences = absences.filter(a => !(a.eleveId === id && a.dateISO === jour && (a.seance || 'matin') === seance && a.classe === classeSelectionnee.nom && a.enseignant === utilisateurConnecte.nom));
    Depot.ecrireJSON('absences', absences);
    decochesManuellement.delete(id);
    elevesCoches.set(id, type);
  }
  mettreAJourEnteteListe();
  afficherListeEleves();
}

function mettreAJourEnteteListe() {
  const bloc = document.getElementById('derniere-modif');
  if (!bloc) return;
  if (!classeSelectionnee) {
    bloc.textContent = 'Dernière modification : —';
    return;
  }
  const jour = jourCourant();
  const seance = seanceCourante();
  const incidents = absences.filter(a => a.classe === classeSelectionnee.nom && a.dateISO === jour && (a.seance || 'matin') === seance);
  if (incidents.length === 0) {
    bloc.textContent = 'Dernière modification : —';
    return;
  }
  const dernier = incidents[incidents.length - 1];
  bloc.textContent = 'Dernière modification : ' + (dernier.date || dateAffichage(jour)) + ' à ' + (dernier.heure || '—');
}

// ========== ENSEIGNANT — CONFIRMATION & ENREGISTREMENT ==========
function afficherConfirmationAbsences() {
  if (elevesCoches.size === 0) {
    afficherToast('Cochez au moins un élève', 'error');
    return;
  }
  document.getElementById('message-confirmation').textContent =
    'Enregistrer ' + elevesCoches.size + ' signalement(s) — ' + dateAffichage(jourCourant()) + ' (' + libelleSeance(seanceCourante()) + ') ?';
  document.getElementById('modal-confirmation').classList.remove('hidden');
}

// Confirmation generique : demanderConfirmation(message, action) puis validerConfirmation()
let actionConfirmation = null;

// Demander un texte : la fenetre de l'APPLICATION (jamais une fenetre Android brute,
// qui ne suit ni le theme clair/sombre ni les couleurs de l'application).
let actionTexte = null;
function demanderTexte(titre, valeur, action) {
  actionTexte = action;
  document.getElementById('texte-titre').textContent = titre || 'Saisie';
  const champ = document.getElementById('texte-champ');
  champ.value = valeur || '';
  document.getElementById('modal-texte').classList.remove('hidden');
  setTimeout(function () { try { champ.focus(); champ.select(); } catch (e) {} }, 60);
}
function validerTexte() {
  const champ = document.getElementById('texte-champ');
  const valeur = String(champ.value || '').trim();
  const action = actionTexte;
  actionTexte = null;
  document.getElementById('modal-texte').classList.add('hidden');
  if (typeof action === 'function') action(valeur);
}
function annulerTexte() {
  actionTexte = null;
  document.getElementById('modal-texte').classList.add('hidden');
}

function demanderConfirmation(message, action) {
  actionConfirmation = action;
  document.getElementById('message-confirmation').textContent = message;
  document.getElementById('modal-confirmation').classList.remove('hidden');
}

function validerConfirmation() {
  const action = actionConfirmation;
  actionConfirmation = null;
  document.getElementById('modal-confirmation').classList.add('hidden');
  if (typeof action === 'function') action();
  else confirmerAbsences();
}

function annulerConfirmation() {
  actionConfirmation = null;
  document.getElementById('modal-confirmation').classList.add('hidden');
}

function confirmerAbsences() {
  // Un enseignant declare absent ce jour / cette demi-journee ne saisit rien.
  // un enseignant declare absent ne saisit aucune absence d'eleve pendant son absence,
  // quelle que soit la date de la ligne (le refus porte sur SA presence aujourd'hui).
  if (typeof refuserSiAbsent === 'function') {
    const momentIci = (typeof momentDuMomentPresent === 'function') ? momentDuMomentPresent() : seanceCourante();
    try { if (refuserSiAbsent(jourCourant(), momentIci)) return; } catch (e) {}
  }
  const now = new Date();
  const heure = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  const jour = jourCourant();
  const seance = seanceCourante();

  elevesCoches.forEach((type, idEleve) => {
    if (decochesManuellement.has(idEleve)) return;
    const dejaSauve = absences.find(a => a.eleveId === idEleve && a.dateISO === jour && (a.seance || 'matin') === seance && a.classe === classeSelectionnee.nom);
    if (dejaSauve) return;
    const eleve = classeSelectionnee.eleves.find(e => e.id === idEleve);
    if (!eleve) return;
    absences.push({
      id: Date.now() + Math.random(),
      eleveId: eleve.id,
      nom: libelleEleve(eleve),
      classe: classeSelectionnee.nom,
      heure: heure,
      date: dateAffichage(jour),
      dateISO: jour,
      seance: seance,
      type: type || 'absence',
      duree: '',
      statut: 'absent',
      enseignant: utilisateurConnecte.nom,
      matiere: utilisateurConnecte.matiere
    });
  });

  Depot.ecrireJSON('absences', absences);
  document.getElementById('modal-confirmation').classList.add('hidden');
  afficherToast('Signalement(s) enregistré(s) !', 'success');
  elevesCoches.clear();
  afficherListeEleves();
  mettreAJourEnteteListe();
  appliquerTableauService();
}

// ========== ENSEIGNANT — HISTORIQUE ==========
function afficherHistorique() {
  const div = document.getElementById('historique-ens-list');
  if (!div) return;
  div.innerHTML = '';
  const moi = utilisateurConnecte ? utilisateurConnecte.nom : '';
  const map = {};
  absences.forEach(a => {
    // Uniquement les Ab/Rd signales par CE prof, et justifies
    if (a.enseignant !== moi) return;
    if (a.statut !== 'justifie_s' && a.statut !== 'justifie_d') return;
    const cle = a.eleveId + '|' + a.classe;
    if (!map[cle]) map[cle] = { nom: a.nom, classe: a.classe, count: 0, dernier: '' };
    map[cle].count++;
    const dt = String(a.dateISO || '') + ' ' + String(a.heure || '');
    if (dt > map[cle].dernier) map[cle].dernier = dt;
  });
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


