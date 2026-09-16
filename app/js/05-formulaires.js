// fichier: app/js/05-formulaires.js
// ========== FORMULAIRES (une seule modale pour toutes les saisies) ==========
const FORMULAIRES = {
  etablissement: {
    titre: "Informations de l'établissement",
    aide: "Ces informations sont saisies une seule fois : elles servent aux rapports et aux filtres de période.",
    prepare: function () { afficherParametres(); },
    action: 'enregistrerParametres',
    champs: [
      { id: 'etab-code', label: 'Code établissement (unique)', type: 'text', placeholder: 'ex. 24A1234' },
      { id: 'etab-nom', label: "Nom de l'établissement", type: 'text', placeholder: 'ex. الثانوية القصبية الإعدادية – بوعوان' },
      { id: 'etab-academie', label: 'Académie régionale', type: 'select', options: [], onchange: 'changerAcademie()' },
      { id: 'etab-direction', label: 'Direction provinciale', type: 'select', options: [] },
      { id: 'annee-libelle', label: 'Année scolaire', type: 'select', options: [] },
      { id: 'sem1-debut', label: 'Semestre 1 — début', type: 'date' },
      { id: 'sem1-fin', label: 'Semestre 1 — fin', type: 'date' },
      { id: 'sem2-debut', label: 'Semestre 2 — début', type: 'date' },
      { id: 'sem2-fin', label: 'Semestre 2 — fin', type: 'date' }
    ]
  },
  fermeture: {
    titre: 'Ajouter une fermeture',
    aide: "Aucune séance n'est assurée sur la période : les absences prises pendant ces séances ne comptent pas dans les statistiques.",
    prepare: function () { const el = document.getElementById('ferm-libelle'); if (el) el.value = ''; },
    action: 'enregistrerFermeture',
    champs: [
      { id: 'ferm-type', label: 'Type', type: 'select', options: ['Vacances', 'Fête religieuse', 'Fête nationale', 'Examens', 'Réunion', 'Travaux', 'Autre'] },
      { id: 'ferm-libelle', label: 'Libellé (facultatif)', type: 'text', placeholder: 'ex. Aïd Al Adha' },
      { id: 'ferm-debut', label: 'Du', type: 'date' },
      { id: 'ferm-fin', label: 'Au', type: 'date' },
      { id: 'ferm-portee', label: 'Portée', type: 'select', options: [['journee', 'Toute la journée'], ['matin', 'Matin seulement'], ['apres-midi', 'Après-midi seulement']] }
    ]
  },
  annulation: {
    titre: 'Ajouter une annulation',
    aide: 'Séance précise (examen, réunion, séance non assurée) : elle ne compte pas dans les statistiques.',
    prepare: function () { preparerFormulaireAnnulation(); },
    action: 'confirmerAnnulationSeance',
    champs: [
      { id: 'annul-date', label: 'Date', type: 'date', onchange: 'majCreneauxAnnulation()' },
      { id: 'annul-classe', label: 'Classe', type: 'select', options: [], onchange: 'majCreneauxAnnulation()' },
      { id: 'annul-creneau', label: 'Séance', type: 'select', options: [] },
      { id: 'annul-motif', label: 'Motif', type: 'select', options: ['Absence du professeur', 'Séance non assurée', 'Examen', 'Réunion', 'Autre'] }
    ]
  },
  absenceSurv: {
    titre: 'Déclarer une absence',
    aide: "Absence d'un surveillant : la période est enregistrée dans la rubrique RH.",
    prepare: function () { remplirProfsIndispo(); },
    action: 'enregistrerAbsSurv',
    champs: [
      { id: 'abs-surv-compte', label: 'Surveillant', type: 'select', options: [] },
      { id: 'abs-surv-debut', label: 'Du', type: 'date' },
      { id: 'abs-surv-fin', label: 'Au', type: 'date' },
      { id: 'abs-surv-portee', label: 'Portée', type: 'select', options: [['journee', 'Toute la journée'], ['matin', 'Matin seulement'], ['apres-midi', 'Après-midi seulement']] },
      { id: 'abs-surv-motif', label: 'Motif', type: 'select', options: ['Absence', 'Maladie', 'Formation', 'Mission', 'Congé', 'Autre'] }
    ]
  },
  absenceEns: {
    titre: 'Déclarer une absence',
    aide: "Toutes les séances de l'enseignant sur la période sont annulées (déduites de son tableau de service).",
    prepare: function () { remplirProfsIndispo(); },
    action: 'enregistrerIndispo',
    champs: [
      { id: 'indispo-prof', label: 'Enseignant', type: 'select', options: [] },
      { id: 'indispo-debut', label: 'Du', type: 'date' },
      { id: 'indispo-fin', label: 'Au', type: 'date' },
      { id: 'indispo-portee', label: 'Portée', type: 'select', options: [['journee', 'Toute la journée'], ['matin', 'Matin seulement'], ['apres-midi', 'Après-midi seulement']] },
      { id: 'indispo-motif', label: 'Motif', type: 'select', options: ['Absence', 'Maladie', 'Formation', 'Mission', 'Congé', 'Autre'] }
    ]
  }
};

function construireChamp(ch) {
  const bloc = document.createElement('div');
  bloc.className = 'form-group';
  const label = document.createElement('label');
  label.textContent = ch.label;
  bloc.appendChild(label);
  let el;
  if (ch.type === 'select') {
    el = document.createElement('select');
    el.className = 'w-full';
    (ch.options || []).forEach(o => {
      const opt = document.createElement('option');
      if (Array.isArray(o)) { opt.value = o[0]; opt.textContent = o[1]; }
      else { opt.value = o; opt.textContent = o; }
      el.appendChild(opt);
    });
  } else {
    el = document.createElement('input');
    el.type = (ch.type === 'date') ? 'date' : 'text';
    if (ch.placeholder) el.placeholder = ch.placeholder;
  }
  el.id = ch.id;
  if (ch.onchange) el.setAttribute('onchange', ch.onchange);
  bloc.appendChild(el);
  return bloc;
}
// Construit les 5 formulaires dans la modale (appele au chargement, avant l'habillage des listes)
function construireFormulaires() {
  const corps = document.getElementById('form-corps');
  if (!corps) return;
  corps.innerHTML = '';
  Object.keys(FORMULAIRES).forEach(cle => {
    const f = FORMULAIRES[cle];
    const bloc = document.createElement('div');
    bloc.id = 'bloc-form-' + cle;
    bloc.style.display = 'none';
    if (f.aide) {
      const p = document.createElement('p');
      p.className = 'aide';
      p.textContent = f.aide;
      bloc.appendChild(p);
    }
    f.champs.forEach(ch => bloc.appendChild(construireChamp(ch)));
    corps.appendChild(bloc);
  });
}
let formulaireActif = null;
function ouvrirFormulaire(cle) {
  const f = FORMULAIRES[cle];
  if (!f) return;
  formulaireActif = cle;
  const blocs = document.querySelectorAll('#form-corps > div');
  for (let i = 0; i < blocs.length; i++) blocs[i].style.display = (blocs[i].id === 'bloc-form-' + cle) ? 'block' : 'none';
  const titre = document.getElementById('form-titre');
  if (titre) titre.textContent = f.titre;
  const m = document.getElementById('modal-form');
  if (m) m.classList.remove('hidden');
  bornerDatesAnnee();
  if (typeof f.prepare === 'function') f.prepare();
}
function fermerFormulaire() {
  formulaireActif = null;
  const m = document.getElementById('modal-form');
  if (m) m.classList.add('hidden');
}
// Valide : la modale se ferme seulement si la saisie a modifie quelque chose (sinon un toast explique)
function validerFormulaire() {
  const f = FORMULAIRES[formulaireActif];
  if (!f) return;
  const etat = () => JSON.stringify([etablissement, anneeScolaire, fermeturesEtab, seancesAnnulees, indispoProfs]);
  const avant = etat();
  const action = window[f.action];
  if (typeof action === 'function') action();
  if (etat() !== avant) fermerFormulaire();
}

// ========== FERMETURE DE L'ETABLISSEMENT (directeur) ==========
function enregistrerFermeture() {
  if (!utilisateurConnecte || utilisateurConnecte.role !== 'directeur') return;
  const val = id => { const el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; };
  const type = val('ferm-type') || 'Fermeture';
  const libelle = val('ferm-libelle');
  const debut = val('ferm-debut');
  const fin = val('ferm-fin') || debut;
  const portee = val('ferm-portee') || 'journee';
  if (!debut) { afficherToast('Indiquez la date de début', 'error'); return; }
  if (fin < debut) { afficherToast('La date de fin doit suivre le début', 'error'); return; }
  const b = bornesAnneeScolaire();
  if (debut < b.debut || fin > b.fin) { afficherToast("Période en dehors de l'année scolaire", 'error'); return; }
  fermeturesEtab.push({
    id: Date.now() + Math.random(), type: type, libelle: libelle, debut: debut, fin: fin,
    portee: portee, par: nomApprobateur(), le: fmtDateISO(new Date()) + ' ' + heureMaintenant()
  });
  sauvegarderFermetures();
  const champ = document.getElementById('ferm-libelle');
  if (champ) champ.value = '';
  afficherFermetures();
  afficherToast('Fermeture ajoutée', 'success');
  rafraichirApresAnnulation();
}
// Confirmation avant toute suppression (modale generique)
function confirmerSuppression(message, action) { demanderConfirmation(message, action); }

function supprimerFermeture(id) {
  const cible = fermeturesEtab.find(f => f.id === id);
  if (!cible) return;
  confirmerSuppression('Supprimer la fermeture « ' + (cible.libelle || cible.type || '') + ' » ?', () => vraimentSupprimerFermeture(id));
}
function vraimentSupprimerFermeture(id) {
  fermeturesEtab = fermeturesEtab.filter(f => f.id !== id);
  sauvegarderFermetures();
  afficherFermetures();
  afficherToast('Fermeture supprimée', 'suppression');
  rafraichirApresAnnulation();
}
function afficherFermetures() {
  const cont = document.getElementById('ferm-liste');
  if (!cont) return;
  cont.innerHTML = '';
  if (fermeturesEtab.length === 0) {
    cont.innerHTML = '<p class="text-sm text-gray-500 text-center py-2">Aucune fermeture enregistrée.</p>';
    return;
  }
  fermeturesEtab.slice().sort((a, b) => String(a.debut).localeCompare(String(b.debut))).forEach(f => {
    const titre = (f.libelle || f.type || 'Fermeture') + ' · ' + dateAffichage(f.debut) +
      (f.fin && f.fin !== f.debut ? ' → ' + dateAffichage(f.fin) : '');
    const sous = (f.type || '') + ' · ' + libellePortee(f.portee) + (f.par ? ' · par ' + f.par : '');
    cont.appendChild(carteLigne(titre, sous, {
      icone: '<i class="fas fa-trash"></i>', couleur: '#dc2626', onclick: () => supprimerFermeture(f.id)
    }));
  });
}

// ========== INDISPONIBILITE D'UN ENSEIGNANT (directeur) ==========
function remplirComptesSelect(idSelect, role) {
  const sel = document.getElementById(idSelect);
  if (!sel) return;
  const courant = sel.value;
  sel.innerHTML = '';
  comptes.filter(c => c.role === role).forEach(c => {
    const o = document.createElement('option');
    o.value = c.code || c.email;
    o.textContent = (c.nom || '') + (c.matiere ? ' · ' + c.matiere : '');
    sel.appendChild(o);
  });
  if (courant && Array.prototype.some.call(sel.options, o => o.value === courant)) sel.value = courant;
}
function remplirProfsIndispo() {
  remplirComptesSelect('indispo-prof', 'enseignant');
  remplirComptesSelect('abs-surv-compte', 'surveillant');
}
// Absence d'un enseignant ou d'un surveillant (memes controles, listes separees)
function roleAbsence(entree) { return entree && entree.role === 'surveillant' ? 'surveillant' : 'enseignant'; }
async function enregistrerAbsence(prefixe, idCompte, role) {
  if (!utilisateurConnecte || utilisateurConnecte.role !== 'directeur') return;
  const val = id => { const el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; };
  const compte = val(idCompte);
  const debut = val(prefixe + '-debut');
  const fin = val(prefixe + '-fin') || debut;
  const portee = val(prefixe + '-portee') || 'journee';
  const motif = val(prefixe + '-motif') || 'Absence';
  if (!compte) { afficherToast('Choisissez un ' + (role === 'surveillant' ? 'surveillant' : 'enseignant'), 'error'); return; }
  if (!debut) { afficherToast('Indiquez la date de début', 'error'); return; }
  if (fin < debut) { afficherToast('La date de fin doit suivre le début', 'error'); return; }
  const b = bornesAnneeScolaire();
  if (debut < b.debut || fin > b.fin) { afficherToast("Période en dehors de l'année scolaire", 'error'); return; }
  // on range l'absence sous le CODE de la fiche (meme identite que l'emploi du temps)
  let compteRange = compte;
  if (typeof atCodeDeLaPersonne === 'function' && typeof estModeEcole === 'function' && estModeEcole()) {
    try { compteRange = await atCodeDeLaPersonne(compte); } catch (e) { compteRange = compte; }
  }
  indispoProfs.push({
    id: Date.now() + Math.random(), profCode: compteRange || compte, role: role, debut: debut, fin: fin,
    portee: portee, motif: motif, par: nomApprobateur(), le: fmtDateISO(new Date()) + ' ' + heureMaintenant()
  });
  sauvegarderIndispo();
  // la base est mise a jour tout de suite (si l'ecole est reliee)
  if (typeof atEnvoyerAbsencePersonnel === 'function') atEnvoyerAbsencePersonnel(indispoProfs[indispoProfs.length - 1]);
  // Les seances de l'enseignant sur la periode sont annulees : on les ECRIT (elles partent
  // dans la base) au lieu de les recalculer seulement a l'ecran.
  if (typeof materialiserAnnulationsParAbsence === 'function') materialiserAnnulationsParAbsence();
  rafraichirListeAnnulations();
  afficherIndispos();
  afficherToast('Absence enregistrée', 'modif');
  rafraichirApresAnnulation();
}
function enregistrerIndispo() { enregistrerAbsence('indispo', 'indispo-prof', 'enseignant'); }
function enregistrerAbsSurv() { enregistrerAbsence('abs-surv', 'abs-surv-compte', 'surveillant'); }
function supprimerIndispo(id) {
  const cible = indispoProfs.find(i => String(i.id) === String(id));
  if (!cible) return;
  confirmerSuppression("Supprimer l'absence de " + nomProfCode(cible.profCode) + ' ?', () => vraimentSupprimerIndispo(cible.id));
}
function vraimentSupprimerIndispo(id) {
  const retiree = indispoProfs.find(i => i.id === id);
  indispoProfs = indispoProfs.filter(i => i.id !== id);
  sauvegarderIndispo();
  if (retiree && typeof atRetirerAbsencePersonnel === 'function') atRetirerAbsencePersonnel(retiree);
  // les seances annulees par cette absence sont RETABLIES automatiquement (elles quittent
  // le telephone ET la base) : c'est la suite logique de la suppression.
  if (typeof materialiserAnnulationsParAbsence === 'function') materialiserAnnulationsParAbsence();
  rafraichirListeAnnulations();
  afficherIndispos();
  afficherToast('Absence supprimée', 'suppression');
  rafraichirApresAnnulation();
}
function afficherAbsencesPersonnel(idConteneur, role) {
  const cont = document.getElementById(idConteneur);
  if (!cont) return;
  const liste = indispoProfs.filter(i => roleAbsence(i) === role)
    .sort((a, b) => String(a.debut).localeCompare(String(b.debut)));
  cont.innerHTML = '';
  if (liste.length === 0) {
    cont.innerHTML = '<p class="text-sm text-gray-500 text-center py-2">Aucune absence enregistrée.</p>';
    return;
  }
  liste.forEach(i => {
    const titre = nomProfCode(i.profCode) + ' · ' + dateAffichage(i.debut) +
      (i.fin && i.fin !== i.debut ? ' → ' + dateAffichage(i.fin) : '') + ' · ' + libellePortee(i.portee);
    cont.appendChild(carteLigne(titre, i.motif || '', {
      icone: '<i class="fas fa-trash"></i>', couleur: '#dc2626', onclick: () => supprimerIndispo(i.id)
    }));
  });
}

function afficherIndispos() {
  afficherAbsencesPersonnel('indispo-liste', 'enseignant');
  afficherAbsencesPersonnel('abs-surv-liste', 'surveillant');
}

// ========== COMPOSANT SEGMENTE (reutilisable) ==========
// Les boutons .mode-btn de #<idConteneur> pilotent les vues #vue-<suffixe> de la meme carte.
function basculerSegments(idConteneur, idActif) {
  const conteneur = document.getElementById(idConteneur);
  if (!conteneur) return;
  const racine = conteneur.parentElement || document;
  const boutons = conteneur.querySelectorAll('.mode-btn');
  for (let i = 0; i < boutons.length; i++) boutons[i].classList.toggle('actif', boutons[i].id === idActif);
  const suffixe = String(idActif || '').replace(/^seg-/, '');
  const vues = racine.querySelectorAll('.seg-vue');
  for (let i = 0; i < vues.length; i++) vues[i].style.display = 'none';
  const cible = document.getElementById('vue-' + suffixe);
  if (cible) cible.style.display = 'block';
}

// ========== PERSONNEL : professeurs + surveillants (liste + modification, directeur) ==========
let profARenommer = null;
// Une carte de compte : hauteur fixe (6 cartes visibles avant defilement)
function carteCompte(c) {
  // Meme rendu que les listes d'absences / fermetures / annulations :
  // on reutilise le renderer partage (titre 13px + sous-titre 11.5px, hauteur 44px, carte blanche bordee).
  const sousTitre = (c.matiere ? c.matiere + ' · ' : '') + (c.email || '');
  return carteLigne(c.nom || '', sousTitre, {
    icone: '<i class="fas fa-pen mr-1"></i>Modifier',
    couleur: 'var(--primary)',
    onclick: () => ouvrirRenommageProf(c.code || c.email)
  });
}
function afficherComptes(idConteneur, role) {
  const cont = document.getElementById(idConteneur);
  if (!cont) return;
  cont.innerHTML = '';
  const liste = comptes.filter(c => c.role === role);
  if (liste.length === 0) {
    cont.innerHTML = '<p class="text-xs text-gray-500 text-center py-1">Aucun compte.</p>';
    return;
  }
  liste.forEach(c => cont.appendChild(carteCompte(c)));
}
async function afficherListeProfs() {
  // ECOLE RELIEE A LA BASE : la liste du personnel vient du SERVEUR, et de la SEULE.
  // Une ecole neuve n'a PERSONNE : on affiche « aucun » (jamais la liste ecrite dans
  // l'application — c'est elle qui faisait apparaitre le personnel d'une autre ecole).
  if (typeof estModeEcole === 'function' && estModeEcole() && typeof atFichesPersonnel === 'function') {
    try {
      const fiches = await atFichesPersonnel();
      afficherFichesDeLaBase(fiches || []);
      return;
    } catch (e) {
      // Serveur injoignable : on le DIT, et on montre la liste du telephone pour depanner.
      afficherToast('Serveur injoignable : liste du telephone (provisoire)', 'warning');
    }
  }
  afficherComptes('dir-profs-list', 'enseignant');
  afficherComptes('dir-surveillants-list', 'surveillant');
}

// Une carte par fiche du serveur : nom, matiere, adresse (+ code MASSAR s'il existe).
function afficherFichesDeLaBase(fiches) {
  const poser = function (idConteneur, role) {
    const cont = document.getElementById(idConteneur);
    if (!cont) return;
    cont.innerHTML = '';
    const liste = fiches.filter(f => f.role === role);
    if (!liste.length) {
      cont.innerHTML = '<p class="text-xs text-gray-500 text-center py-1">Aucun ' +
        (role === 'enseignant' ? 'enseignant' : 'surveillant') + ' dans la base.</p>';
      return;
    }
    liste.forEach(f => {
      const sousTitre = (f.matiere ? f.matiere + ' · ' : '') + (f.email || '');
      cont.appendChild(carteLigne(f.nom || '', sousTitre, {
        icone: '<i class="fas fa-pen mr-1"></i>Modifier',
        couleur: 'var(--primary)',
        onclick: () => ouvrirRenommageFicheBase(f)
      }));
    });
  };
  poser('dir-profs-list', 'enseignant');
  poser('dir-surveillants-list', 'surveillant');
}

// Renommer une fiche DU SERVEUR (le directeur en a le droit : c'est la seule colonne
// qu'il peut modifier). Le telephone ne garde rien : tout se passe dans la base.
// Modifier une fiche DU SERVEUR (surveillant ou enseignant) : on ouvre LA MEME FENETRE
// que le prototype : nom + mot de passe (Generer / Reinitialiser) + fiche PDF + suppression.
let ficheBaseCourante = null;
async function ouvrirRenommageFicheBase(fiche) {
  ficheBaseCourante = fiche;
  creationProfil = false;
  profARenommer = fiche.code || fiche.email || String(fiche.id);
  dernierReset = null;
  libelleActionMdp();
  const bloc = document.getElementById('renommer-reset'); if (bloc) bloc.classList.add('hidden');
  const suc = document.getElementById('renommer-success'); if (suc) suc.classList.add('hidden');
  const suppr = document.getElementById('renommer-supprimer');
  if (suppr) suppr.classList.toggle('hidden', String(fiche.role || '') !== 'surveillant');
  const t = document.getElementById('renommer-titre');
  if (t) t.textContent = String(fiche.role || '') === 'surveillant' ? 'Nom du surveillant' : "Nom de l'enseignant";
  const n = document.getElementById('renommer-nom'); if (n) n.value = fiche.nom || '';
  const info = document.getElementById('renommer-info');
  if (info) info.textContent = (fiche.matiere ? fiche.matiere + ' · ' : '') +
    (String(fiche.role || '') === 'surveillant' ? 'Surveillant' : (fiche.code || ''));
  const mail = document.getElementById('renommer-email');
  if (mail) mail.textContent = 'Email de connexion : ' + (fiche.email || '');
  const mdp = document.getElementById('renommer-mdp'); if (mdp) mdp.value = '';
  document.getElementById('modal-renommer').classList.remove('hidden');
}

async function enregistrerNomFicheBase(fiche, saisie) {
  const nom = String(saisie || '').trim();
  if (!nom || nom === fiche.nom) return;
  try {
    const jeton = await atJeton();
    const rep = await fetch(AT_BASE + '/rest/v1/profils?id=eq.' + fiche.id, {
      method: 'PATCH', headers: atEntetes(jeton, true), body: JSON.stringify({ nom: nom })
    });
    await atReponse(rep);
    afficherToast('Nom change sur le serveur', 'success');
    afficherListeProfs();
  } catch (e) {
    afficherToast('Changement impossible : ' + (e && e.message ? e.message : e), 'error');
  }
}

