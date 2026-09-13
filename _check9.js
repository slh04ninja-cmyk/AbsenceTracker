
// ========== BASE DE DONNÉES ==========
const prenomsDemo = ['Ahmed', 'Fatima', 'Mohamed', 'Khadija', 'Youssef', 'Salma', 'Omar', 'Aya', 'Mehdi', 'Imane', 'Karim', 'Noura', 'Hamza', 'Yassine', 'Sara', 'Anas', 'Malak', 'Reda', 'Ghita', 'Adam', 'Lina', 'Walid', 'Douae', 'Zakaria', 'Hiba', 'Bilal', 'Meriem', 'Soufiane', 'Nisrine', 'Amine', 'Ouiam', 'Taha', 'Rania', 'Ayoub', 'Kawtar', 'Ismail', 'Rim', 'Adil', 'Amal', 'Jawad'];
const nomsDemo = ['El Amrani', 'Benali', 'Alami', 'El Fassi', 'Chraibi', 'Berrada', 'El Idrissi', 'Bennani', 'Tazi', 'El Khatib', 'Ouazzani', 'Benjelloun', 'Sekkat', 'El Mansouri', 'Bouazza', 'El Ghazi', 'Tahiri', 'Naciri', 'El Harrak', 'Kabbaj', 'Zouiten', 'Bennis', 'Lamrani', 'Sefrioui', 'Benkirane', 'Fikri', 'Belkadi', 'El Moudden', 'Zniber', 'Baraka', 'El Hassani', 'Drissi', 'El Fadili', 'Ghannam', 'Haddadi', 'Jaidi', 'Kadiri', 'Laabi', 'Moutawakil', 'Nabil'];
const nomsClassesDemo = ['3ème A', '3ème B', '4ème A', '4ème B', '5ème A'];
const classesDemo = [];
let idEleveDemo = 1;
nomsClassesDemo.forEach((nomClasse, idx) => {
  const eleves = [];
  for (let i = 0; i < 13; i++) {
    eleves.push({
      id: idEleveDemo++,
      nom: nomsDemo[(idx * 13 + i * 5) % nomsDemo.length],
      prenom: prenomsDemo[(idx * 7 + i) % prenomsDemo.length]
    });
  }
  classesDemo.push({ id: idx + 1, nom: nomClasse, eleves: eleves });
});

// ========== CHARGEMENT DES CLASSES (persistees en localStorage) ==========
let classes = [];
let nextClasseId = 1;
let nextEleveId = 1;

const DEMO_VERSION = 'v2.1';

function chargerClasses() {
  const sauve = localStorage.getItem('classes');
  const version = localStorage.getItem('absenceTrackVersion');
  if (sauve && version === DEMO_VERSION) {
    try {
      const liste = JSON.parse(sauve);
      if (Array.isArray(liste) && liste.length > 0) {
        nextClasseId = liste.reduce((m, c) => Math.max(m, c.id), 0) + 1;
        nextEleveId = liste.reduce((m, c) => Math.max(m, c.eleves.reduce((mm, e) => Math.max(mm, e.id), 0)), 0) + 1;
        return liste;
      }
    } catch (e) {}
  }
  // Nouveau jeu de donnees de test : on repart de zero
  localStorage.removeItem('absences');
  const init = JSON.parse(JSON.stringify(classesDemo));
  nextClasseId = init.reduce((m, c) => Math.max(m, c.id), 0) + 1;
  nextEleveId = init.reduce((m, c) => Math.max(m, c.eleves.reduce((mm, e) => Math.max(mm, e.id), 0)), 0) + 1;
  sauvegarderClasses(init);
  return init;
}

function sauvegarderClasses(liste) {
  localStorage.setItem('classes', JSON.stringify(liste || classes));
  localStorage.setItem('absenceTrackVersion', DEMO_VERSION);
}

classes = chargerClasses();

// ========== COMPTES UTILISATEURS ==========
const comptes = [
  { email: "pc@taalim.ma",   password: "12345", role: "enseignant",  matiere: "Physique",       nom: "Prof. Physique" },
  { email: "math@taalim.ma", password: "12345", role: "enseignant",  matiere: "Mathématiques", nom: "Prof. Mathématiques" },
  { email: "fr@taalim.ma",   password: "12345", role: "enseignant",  matiere: "Français",       nom: "Prof. Français" },
  { email: "ar@taalim.ma",   password: "12345", role: "enseignant",  matiere: "Arabe",          nom: "Prof. Arabe" },
  { email: "svt@taalim.ma",  password: "12345", role: "enseignant",  matiere: "SVT",            nom: "Prof. SVT" },
  { email: "s1@taalim.ma",   password: "12345", role: "surveillant", nom: "Surveillant 1" },
  { email: "s2@taalim.ma",   password: "12345", role: "surveillant", nom: "Surveillant 2" },
  { email: "3@taalim.ma",    password: "12345", role: "directeur",   nom: "Directeur" }
];

// ========== VARIABLES GLOBALES ==========
let absences = JSON.parse(localStorage.getItem('absences')) || [];
let utilisateurConnecte = null;
let elevesCoches = new Set();
let classeSelectionnee = null;
let dateSelectionnee = null;
let seanceSelectionnee = 'matin';
let typeSaisie = 'absence';
let dureeSaisie = '';

// Seuil d'alerte : absences non justifiees dans le mois
const SEUIL_ALERTE_MOIS = 4;

let filterActive = 'all';
let filterDirActive = 'all';
let classeDetailCourante = null;
let decochesManuellement = new Set(); // Élèves décochés manuellement après sauvegarde

// Date locale (evite le decalage UTC: toISOString renvoie la veille a 00h-01h au Maroc)
function fmtDateISO(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const j = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + j;
}

// ========== LIBELLES ==========
function libelleType(t) {
  if (t === 'retard') return 'Retard';
  if (t === 'exclusion') return 'Exclusion de cours';
  return 'Absence';
}

function libelleStatut(s) {
  if (s === 'justifie_s') return 'Justifiée S';
  if (s === 'justifie_d') return 'Justifiée D';
  return 'Non justifiée';
}

function libelleSeance(s) {
  return s === 'apres-midi' ? 'Après-midi' : 'Matin';
}

function libelleEleve(e) {
  if (!e) return '';
  return e.prenom ? (e.nom + ' ' + e.prenom) : e.nom;
}

function dateAffichage(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-FR');
}

function seanceActuelle() {
  return new Date().getHours() < 12 ? 'matin' : 'apres-midi';
}

// ========== SAISIE : date / seance / type / duree ==========
function resetSaisie() {
  dateSelectionnee = fmtDateISO(new Date());
  seanceSelectionnee = seanceActuelle();
  typeSaisie = 'absence';
  dureeSaisie = '';
  appliquerSaisieUI();
}

function appliquerSaisieUI() {
  const d = document.getElementById('saisie-date');
  const s = document.getElementById('saisie-seance');
  const t = document.getElementById('saisie-type');
  const du = document.getElementById('saisie-duree');
  if (d) d.value = dateSelectionnee || fmtDateISO(new Date());
  if (s) s.value = seanceSelectionnee || 'matin';
  if (t) t.value = typeSaisie || 'absence';
  if (du) {
    du.value = dureeSaisie || '';
    du.disabled = (typeSaisie === 'absence');
  }
}

function rafraichirPrise() {
  afficherListeEleves();
  mettreAJourCompteur();
}

function changerDateSaisie() {
  const v = document.getElementById('saisie-date').value;
  dateSelectionnee = v || fmtDateISO(new Date());
  rafraichirPrise();
}

function changerSeanceSaisie() {
  seanceSelectionnee = document.getElementById('saisie-seance').value;
  rafraichirPrise();
}

function changerTypeSaisie() {
  typeSaisie = document.getElementById('saisie-type').value;
  if (typeSaisie === 'absence') dureeSaisie = '';
  appliquerSaisieUI();
}

function changerDureeSaisie() {
  dureeSaisie = document.getElementById('saisie-duree').value;
}

// ========== THEME SOMBRE ==========
function appliquerTheme() {
  const sombre = localStorage.getItem('prefTheme') === 'sombre';
  document.body.classList.toggle('theme-sombre', sombre);
  document.querySelectorAll('.icone-theme').forEach(function (ic) {
    ic.className = 'icone-theme fas text-xl ' + (sombre ? 'fa-sun' : 'fa-moon');
  });
}

function basculerTheme() {
  localStorage.setItem('prefTheme', localStorage.getItem('prefTheme') === 'sombre' ? 'clair' : 'sombre');
  appliquerTheme();
}

appliquerTheme();

// ========== AUTHENTIFICATION ==========
function togglePassword() {
  const input = document.getElementById('login-password');
  const icon = document.getElementById('eye-icon');
  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'fas fa-eye-slash';
  } else {
    input.type = 'password';
    icon.className = 'fas fa-eye';
  }
}

function connexion() {
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value;
  const errorDiv = document.getElementById('login-error');
  const errorText = document.getElementById('login-error-text');

  errorDiv.classList.add('hidden');

  if (!email || !password) {
    errorText.textContent = 'Veuillez remplir tous les champs';
    errorDiv.classList.remove('hidden');
    return;
  }

  if (!email.endsWith('@taalim.ma')) {
    errorText.textContent = "L'email doit contenir @taalim.ma";
    errorDiv.classList.remove('hidden');
    return;
  }

  const compte = comptes.find(c => c.email === email && c.password === password);
  if (!compte) {
    errorText.textContent = 'Email ou mot de passe incorrect';
    errorDiv.classList.remove('hidden');
    return;
  }

  utilisateurConnecte = compte;
  localStorage.setItem('utilisateur', JSON.stringify(compte));

  if (compte.role === 'enseignant') {
    afficherEcran('enseignant');
    remplirListeClasses();
    choisirClasse('');
    afficherInfosProf();
    resetSaisie();
  } else if (compte.role === 'surveillant') {
    afficherEcran('surveillant');
    mettreAJourDashboardSurv();
  } else if (compte.role === 'directeur') {
    afficherEcran('directeur');
    mettreAJourDashboardDir();
  }
}

function deconnexion() {
  utilisateurConnecte = null;
  elevesCoches.clear();
  decochesManuellement.clear();
  classeSelectionnee = null;
  choisirClasse('');
  afficherInfosProf();
  resetSaisie();
  localStorage.removeItem('utilisateur');
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').classList.add('hidden');
  afficherEcran('login');
}

// ========== NAVIGATION ==========
function afficherEcran(nomPage) {
  document.querySelectorAll('.page-container').forEach(el => el.classList.remove('active'));
  const page = document.getElementById('page-' + nomPage);
  if (page) page.classList.add('active');
}

function switchEnsPage(page, el) {
  afficherEcran(page);
  // Trouver la bonne icône dans la nouvelle page
  const navItems = document.querySelectorAll('#page-' + page + ' .bottom-nav .nav-item');
  navItems.forEach(n => n.classList.remove('active'));
  // Activer l'icône correspondante dans le bon bottom-nav
  navItems.forEach(n => {
    const onclickAttr = n.getAttribute('onclick');
    if (onclickAttr && onclickAttr.includes("'" + page + "'")) {
      n.classList.add('active');
    }
  });
  if (page === 'enseignant') afficherListeEleves();
  if (page === 'historique-ens') afficherHistorique();
  if (page === 'stats-ens') afficherStatistiques();
}

function switchSurvPage(page, el) {
  afficherEcran(page);
  const navItems = document.querySelectorAll('#page-' + page + ' .bottom-nav .nav-item');
  navItems.forEach(n => n.classList.remove('active'));
  navItems.forEach(n => {
    const onclickAttr = n.getAttribute('onclick');
    if (onclickAttr && onclickAttr.includes("'" + page + "'")) {
      n.classList.add('active');
    }
  });
  if (page === 'surveillant') mettreAJourDashboardSurv();
  if (page === 'surv-classes') afficherClassesSurv();
  if (page === 'surv-rapports') {}
}

function switchDirPage(page, el) {
  afficherEcran(page);
  const navItems = document.querySelectorAll('#page-' + page + ' .bottom-nav .nav-item');
  navItems.forEach(n => n.classList.remove('active'));
  navItems.forEach(n => {
    const onclickAttr = n.getAttribute('onclick');
    if (onclickAttr && onclickAttr.includes("'" + page + "'")) {
      n.classList.add('active');
    }
  });
  if (page === 'directeur') mettreAJourDashboardDir();
  if (page === 'dir-gestion') afficherGestionDir();
  if (page === 'dir-absences') afficherAbsencesDir();
}

// ========== TOAST ==========
function afficherToast(message, type) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast ' + type;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

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
    filterActive = 'all';
    document.getElementById('ens-classe-name').textContent = 'Sélectionnez une classe';
    if (zone) zone.classList.add('hidden');
    const liste = document.getElementById('liste-eleves-enseignant');
    if (liste) liste.innerHTML = '';
    mettreAJourResumeClasse();
    return;
  }
  if (!classeSelectionnee || classeSelectionnee.id !== id) {
    classeSelectionnee = classes.find(c => c.id === id);
    if (classeSelectionnee) {
      elevesCoches.clear();
      decochesManuellement.clear();
      filterActive = 'all';
      const chips = document.querySelectorAll('#toolbar-filtres .filter-chip');
      chips.forEach(c => c.classList.remove('active'));
      if (chips[0]) chips[0].classList.add('active');
    }
  }
  if (!classeSelectionnee) return;
  document.getElementById('ens-classe-name').textContent = classeSelectionnee.nom;
  if (zone) zone.classList.remove('hidden');
  appliquerSaisieUI();
  afficherListeEleves();
  mettreAJourCompteur();
}

function afficherInfosProf() {
  const bloc = document.getElementById('ens-prof-info');
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
  const tousLesEleves = classeSelectionnee.eleves;
  const jour = dateSelectionnee || fmtDateISO(new Date());
  const seance = seanceSelectionnee || 'matin';
  const moi = utilisateurConnecte.nom;
  const memeSeance = a => (a.seance || 'matin') === seance;

  const incidentsJour = absences.filter(a =>
    a.classe === classeSelectionnee.nom && a.dateISO === jour && memeSeance(a) &&
    a.statut !== 'justifie_s' && a.statut !== 'justifie_d'
  );
  const absentsMoi = new Set(incidentsJour.filter(a => a.enseignant === moi).map(a => a.eleveId));
  const absentsAutres = new Set(incidentsJour.filter(a => a.enseignant !== moi).map(a => a.eleveId));
  const quiAutre = {};
  const typeAutre = {};
  const typeMoi = {};
  incidentsJour.filter(a => a.enseignant !== moi).forEach(a => {
    if (!quiAutre[a.eleveId]) {
      quiAutre[a.eleveId] = a.enseignant;
      typeAutre[a.eleveId] = libelleType(a.type) + (a.duree ? ' ' + a.duree : '');
    }
  });
  incidentsJour.filter(a => a.enseignant === moi).forEach(a => {
    if (!typeMoi[a.eleveId]) typeMoi[a.eleveId] = libelleType(a.type) + (a.duree ? ' ' + a.duree : '');
  });
  const absentsPrecedents = new Set(
    absences.filter(a => a.classe === classeSelectionnee.nom && a.dateISO < jour && a.statut !== 'justifie_s' && a.statut !== 'justifie_d')
      .map(a => a.eleveId)
  );

  let filtres;
  if (filterActive === 'absents') {
    filtres = tousLesEleves.filter(el =>
      elevesCoches.has(el.id) || absentsMoi.has(el.id) || absentsAutres.has(el.id) || absentsPrecedents.has(el.id)
    );
  } else if (filterActive === 'presents') {
    filtres = tousLesEleves.filter(el =>
      !elevesCoches.has(el.id) && !absentsMoi.has(el.id) && !absentsAutres.has(el.id) && !absentsPrecedents.has(el.id)
    );
  } else {
    filtres = tousLesEleves;
  }

  if (filtres.length === 0) {
    const msg = filterActive === 'absents' ? 'Aucun élève signalé' : filterActive === 'presents' ? 'Tous les élèves sont signalés' : 'Aucun élève';
    const iconeEmpty = filterActive === 'absents' ? 'fa-user-check' : 'fa-users';
    div.innerHTML = '<div class="empty-state py-8"><div class="empty-icon"><i class="fas ' + iconeEmpty + '"></i></div><p class="text-gray-500">' + msg + '</p></div>';
    return;
  }

  filtres.forEach(eleve => {
    const parAutre = absentsAutres.has(eleve.id);
    const precedent = absentsPrecedents.has(eleve.id);
    const estMoi = (elevesCoches.has(eleve.id) || absentsMoi.has(eleve.id)) && !decochesManuellement.has(eleve.id);
    const estVerrouille = parAutre || precedent;
    const estCoche = estVerrouille || estMoi;
    const numero = tousLesEleves.findIndex(e => e.id === eleve.id) + 1;

    const item = document.createElement('div');
    item.className = 'flex items-center justify-between px-4 py-3 border-b border-gray-100 transition-all';
    item.style = estCoche ? 'border-left: 5px solid #ef4444; background: #fef2f2' : 'border-left: 5px solid transparent';

    const checkboxHTML = estVerrouille
      ? '<input type="checkbox" checked disabled class="checkbox-locked"><i class="fas fa-lock lock-icon"></i>'
      : '<input type="checkbox" ' + (estCoche ? 'checked' : '') + ' onchange="gererCoche(' + eleve.id + ', this.checked)" class="checkbox-material">';

    let raison = '';
    if (parAutre) raison = 'déjà signalé · ' + (quiAutre[eleve.id] || 'un autre enseignant');
    else if (precedent) raison = 'séance préc.';
    let typeTxt = '';
    if (parAutre) typeTxt = typeAutre[eleve.id] || '';
    else if (estMoi && typeMoi[eleve.id]) typeTxt = typeMoi[eleve.id];

    item.innerHTML = `
      <div class="flex items-center gap-3 flex-1">
        <span class="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${estCoche ? 'bg-red-500 text-white' : 'bg-blue-100 text-blue-900'}">${numero}</span>
        <span class="font-medium ${estCoche ? 'text-red-700' : 'text-gray-800'}">${libelleEleve(eleve)}</span>
        ${estVerrouille ? '<span class="text-xs text-gray-400 ml-1">(' + raison + ')</span>' : (typeTxt ? '<span class="text-xs text-gray-400 ml-1">' + typeTxt + '</span>' : '')}
      </div>
      ${checkboxHTML}
    `;
    div.appendChild(item);
  });
}

function gererCoche(id, coche) {
  const jour = dateSelectionnee || fmtDateISO(new Date());
  const seance = seanceSelectionnee || 'matin';
  if (!coche) {
    const enregistreParAutre = absences.some(a =>
      a.eleveId === id && a.classe === classeSelectionnee.nom && a.dateISO === jour &&
      (a.seance || 'matin') === seance &&
      a.statut !== 'justifie_s' && a.statut !== 'justifie_d' && a.enseignant !== utilisateurConnecte.nom
    );
    if (enregistreParAutre) {
      afficherToast('Incident enregistré par un autre enseignant', 'error');
      afficherListeEleves();
      return;
    }
  }
  if (coche) {
    elevesCoches.add(id);
    decochesManuellement.delete(id);
  } else {
    elevesCoches.delete(id);
    decochesManuellement.add(id);
    absences = absences.filter(a => !(a.eleveId === id && a.dateISO === jour && (a.seance || 'matin') === seance && a.classe === classeSelectionnee.nom));
    localStorage.setItem('absences', JSON.stringify(absences));
  }
  mettreAJourCompteur();
  afficherListeEleves();
}

function filterEleves(type, el) {
  filterActive = type;
  el.closest('.toolbar').querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  // Masquer le bouton Enregistrer en mode Absents
  const btnEnregistrer = document.getElementById('btn-enregistrer-absences');
  if (btnEnregistrer) {
    btnEnregistrer.style.display = type === 'absents' ? 'none' : 'block';
  }
  afficherListeEleves();
}

function mettreAJourCompteur() {
  if (classeSelectionnee) {
    const jour = dateSelectionnee || fmtDateISO(new Date());
    const seance = seanceSelectionnee || 'matin';
    const incidents = absences.filter(a => a.classe === classeSelectionnee.nom && a.dateISO === jour && (a.seance || 'matin') === seance && a.statut !== 'justifie_s' && a.statut !== 'justifie_d').length;
    const precedents = absences.filter(a => a.classe === classeSelectionnee.nom && a.dateISO < jour && a.statut !== 'justifie_s' && a.statut !== 'justifie_d').length;
    const total = Math.max(elevesCoches.size + precedents, incidents + precedents);
    document.getElementById('count-absents').textContent = total;
    document.getElementById('count-total').textContent = classeSelectionnee.eleves.length;
  }
  mettreAJourResumeClasse();
}

function mettreAJourResumeClasse() {
  const bloc = document.getElementById('classe-resume');
  if (!bloc) return;
  if (!classeSelectionnee) {
    bloc.classList.add('hidden');
    bloc.textContent = '';
    return;
  }
  const jour = dateSelectionnee || fmtDateISO(new Date());
  const seance = seanceSelectionnee || 'matin';
  const incidents = absences.filter(a => a.classe === classeSelectionnee.nom && a.dateISO === jour && (a.seance || 'matin') === seance && a.statut !== 'justifie_s' && a.statut !== 'justifie_d');
  const mesSaisies = utilisateurConnecte ? incidents.filter(a => a.enseignant === utilisateurConnecte.nom) : [];
  const derniere = mesSaisies.length ? mesSaisies[mesSaisies.length - 1].heure : null;
  let txt = classeSelectionnee.eleves.length + ' élèves · ' + incidents.length + ' signalé(s) le ' + dateAffichage(jour) + ' (' + libelleSeance(seance) + ')';
  if (derniere) txt += ' · dernière saisie à ' + derniere;
  bloc.textContent = txt;
  bloc.classList.remove('hidden');
}

// ========== ENSEIGNANT — CONFIRMATION & ENREGISTREMENT ==========
function afficherConfirmationAbsences() {
  if (elevesCoches.size === 0) {
    afficherToast('Cochez au moins un élève', 'error');
    return;
  }
  const jour = dateSelectionnee || fmtDateISO(new Date());
  const details = libelleType(typeSaisie) + (dureeSaisie ? ' ' + dureeSaisie : '');
  document.getElementById('message-confirmation').textContent =
    'Enregistrer ' + elevesCoches.size + ' ' + (typeSaisie === 'absence' ? 'absence(s)' : 'signalement(s)') +
    ' — ' + dateAffichage(jour) + ' (' + libelleSeance(seanceSelectionnee) + ') · ' + details + ' ?';
  document.getElementById('modal-confirmation').classList.remove('hidden');
}

function annulerConfirmation() {
  document.getElementById('modal-confirmation').classList.add('hidden');
}

function confirmerAbsences() {
  const now = new Date();
  const heure = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  const jour = dateSelectionnee || fmtDateISO(now);
  const seance = seanceSelectionnee || 'matin';

  elevesCoches.forEach(idEleve => {
    if (decochesManuellement.has(idEleve)) return;
    const dejaSauve = absences.find(a => a.eleveId === idEleve && a.dateISO === jour && (a.seance || 'matin') === seance && a.classe === classeSelectionnee.nom);
    if (dejaSauve) return;
    const eleve = classeSelectionnee.eleves.find(e => e.id === idEleve);
    absences.push({
      id: Date.now() + Math.random(),
      eleveId: eleve.id,
      nom: libelleEleve(eleve),
      classe: classeSelectionnee.nom,
      heure: heure,
      date: dateAffichage(jour),
      dateISO: jour,
      seance: seance,
      type: typeSaisie,
      duree: typeSaisie === 'absence' ? '' : (dureeSaisie || ''),
      statut: 'absent',
      enseignant: utilisateurConnecte.nom,
      matiere: utilisateurConnecte.matiere
    });
  });

  localStorage.setItem('absences', JSON.stringify(absences));
  document.getElementById('modal-confirmation').classList.add('hidden');
  afficherToast((typeSaisie === 'absence' ? 'Absences' : 'Signalements') + ' enregistré(s) !', 'success');
  elevesCoches.clear();
  afficherListeEleves();
  mettreAJourCompteur();
}

// ========== ENSEIGNANT — HISTORIQUE ==========
function afficherHistorique() {
  const list = document.getElementById('historique-list');
  list.innerHTML = '';
  const mesAbsences = absences.filter(a => a.enseignant === utilisateurConnecte.nom).reverse();
  if (mesAbsences.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon"><i class="fas fa-inbox"></i></div><p>Aucun enregistrement</p></div>';
    return;
  }
  mesAbsences.forEach(abs => {
    const item = document.createElement('div');
    item.className = 'bg-white rounded-lg px-4 py-2 mb-2 shadow-sm flex justify-between items-center';
    item.innerHTML = `
      <div>
        <p class="font-semibold text-gray-800 text-sm">${abs.nom}</p>
        <p class="text-xs text-gray-500">${abs.classe} — ${abs.date} ${abs.heure}${abs.matiere ? ' · ' + abs.matiere : ''}</p>
      </div>
    `;
    list.appendChild(item);
  });
}

function supprimerAbsence(id) {
  absences = absences.filter(a => a.id !== id);
  localStorage.setItem('absences', JSON.stringify(absences));
  afficherHistorique();
  afficherToast('Absence supprimée', 'success');
}

// ========== ENSEIGNANT — STATISTIQUES ==========
function afficherStatistiques() {
  if (!classeSelectionnee) {
    document.getElementById('stat-presence').textContent = '—';
    document.getElementById('progress-presence').style.width = '0%';
    document.getElementById('chart-absences').innerHTML = '';
    document.getElementById('top-absents').innerHTML = '<p class="text-gray-500 text-center py-4">Choisissez une classe ci-dessus</p>';
    return;
  }
  const total = classeSelectionnee.eleves.length;
  const nbAbsents = absences.filter(a => a.classe === classeSelectionnee.nom).length;
  const taux = total > 0 ? Math.round(((total - Math.min(nbAbsents, total)) / total) * 100) : 100;
  document.getElementById('stat-presence').textContent = taux + '%';
  document.getElementById('progress-presence').style.width = taux + '%';

  // Graphique par classe
  const chartDiv = document.getElementById('chart-absences');
  chartDiv.innerHTML = '';
  classes.forEach(cl => {
    const count = absences.filter(a => a.classe === cl.nom).length;
    const maxCount = Math.max(...classes.map(c => absences.filter(a => a.classe === c.nom).length), 1);
    const height = Math.max((count / maxCount) * 100, 10);
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.height = height + '%';
    bar.innerHTML = `<div class="bar-value">${count}</div><div class="bar-label">${cl.nom}</div>`;
    chartDiv.appendChild(bar);
  });

  // Top élèves absents
  const topDiv = document.getElementById('top-absents');
  topDiv.innerHTML = '';
  const countByEleve = {};
  absences.filter(a => a.classe === classeSelectionnee.nom).forEach(a => {
    countByEleve[a.nom] = (countByEleve[a.nom] || 0) + 1;
  });
  const sorted = Object.entries(countByEleve).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (sorted.length === 0) {
    topDiv.innerHTML = '<p class="text-gray-500 text-center py-4">Aucune absence</p>';
    return;
  }
  sorted.forEach(([nom, count]) => {
    const row = document.createElement('div');
    row.className = 'flex justify-between items-center p-3 bg-gray-50 rounded-lg';
    row.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="avatar text-xs">${nom.charAt(0)}</div>
        <span class="font-medium text-gray-800">${nom}</span>
      </div>
      <span class="badge badge-danger">${count} absence(s)</span>
    `;
    topDiv.appendChild(row);
  });
}

// ========== SURVEILLANT — DASHBOARD ==========
function mettreAJourDashboardSurv() {
  const now = new Date();
  const today = fmtDateISO(now);
  const currentHour = String(now.getHours()).padStart(2, '0');
  const absencesToday = absences.filter(a => a.dateISO === today);
  const nouveauxCetteHeure = absencesToday.filter(a => a.heure && a.heure.startsWith(currentHour));
  const totalUnjustified = absences.filter(a => a.statut === 'absent').length;

  document.getElementById('surv-nouveaux').textContent = nouveauxCetteHeure.length;
  document.getElementById('surv-total-absents').textContent = absencesToday.length;
  document.getElementById('surv-total-unjustified').textContent = totalUnjustified;

  const listContainer = document.getElementById('surv-absences-list');
  listContainer.innerHTML = '';
  const absentsListe = absencesToday.filter(a => a.statut === 'absent');
  if (absentsListe.length === 0) {
    listContainer.innerHTML = '<div style="text-align: center; padding: 32px 16px; color: #94a3b8;"><i class="fas fa-user-check" style="font-size: 32px; margin-bottom: 12px; display: block; opacity: 0.4;"></i><p>Aucun élève signalé aujourd\'hui</p></div>';
  } else {
    absentsListe.forEach(abs => {
      const card = document.createElement('div');
      card.className = 'absence-card';
      card.onclick = () => afficherDetailAbsence(abs);
      card.innerHTML = `
        <div class="absence-card-ligne">
          <span class="absence-card-name">${abs.nom}</span>
          <span class="absence-card-classe">${abs.classe}</span>
          <i class="fas fa-chevron-right absence-card-icon"></i>
        </div>
      `;
      listContainer.appendChild(card);
    });
  }
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
  document.getElementById('detail-nom').textContent = abs.nom;
  document.getElementById('detail-classe').textContent = abs.classe;
  document.getElementById('detail-date').textContent = abs.date + (abs.seance ? ' · ' + libelleSeance(abs.seance) : '');
  document.getElementById('detail-heure').textContent = abs.heure || '-';
  document.getElementById('detail-prof').textContent = abs.enseignant || '-';
  document.getElementById('detail-matiere').textContent = abs.matiere || '-';
  document.getElementById('detail-type').textContent = libelleType(abs.type);

  const rowDuree = document.getElementById('row-duree');
  if (abs.duree) { document.getElementById('detail-duree').textContent = abs.duree; rowDuree.style.display = 'flex'; }
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

  const badgeContainer = document.getElementById('detail-statut-badge');
  const badgeClass = abs.statut === 'justifie_s' ? 'badge-info' : abs.statut === 'justifie_d' ? 'badge-success' : 'badge-danger';
  badgeContainer.innerHTML = '<span class="badge ' + badgeClass + '">' + libelleStatut(abs.statut) + '</span>';

  const blocMotif = document.getElementById('bloc-motif');
  const btnJustifier = document.getElementById('btn-justifier-absence');
  if (abs.statut === 'absent') {
    if (blocMotif) blocMotif.style.display = 'block';
    btnJustifier.style.display = 'block';
    btnJustifier.onclick = () => { justifierAbsence(abs.id, 'surv'); fermerDetailAbsence(); };
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
function afficherClassesSurv() {
  const div = document.getElementById('surv-classes-list');
  div.innerHTML = '';
  classes.forEach(cl => {
    const nbAbs = absences.filter(a => a.classe === cl.nom).length;
    const item = document.createElement('div');
    item.className = 'card-material p-4 flex justify-between items-center';
    item.innerHTML = `
      <div>
        <p class="font-bold text-gray-800">${cl.nom}</p>
        <p class="text-sm text-gray-500">${cl.eleves.length} élèves</p>
      </div>
      <div class="text-right">
        <span class="badge badge-danger">${nbAbs} absence(s)</span>
      </div>
    `;
    div.appendChild(item);
  });
}

// ========== SURVEILLANT — RAPPORTS ==========
function genererRapport() {
  const date = document.getElementById('rapport-date').value;
  if (!date) {
    afficherToast('Sélectionnez une date', 'error');
    return;
  }
  const absencesJour = absences.filter(a => a.dateISO === date);
  if (absencesJour.length === 0) {
    afficherToast('Aucune absence à cette date', 'info');
    return;
  }
  // Simuler la génération
  const rapportDiv = document.createElement('div');
  rapportDiv.className = 'card-material p-4 scale-in';
  rapportDiv.innerHTML = `
    <div class="flex justify-between items-center">
      <div>
        <p class="font-bold text-gray-800">Rapport du ${new Date(date).toLocaleDateString('fr-FR')}</p>
        <p class="text-sm text-gray-500">${absencesJour.length} absence(s)</p>
      </div>
      <i class="fas fa-file-pdf text-red-500 text-2xl"></i>
    </div>
  `;
  const list = document.getElementById('rapports-list');
  if (list.querySelector('.text-gray-500')) list.innerHTML = '';
  list.prepend(rapportDiv);
  afficherToast('Rapport généré !', 'success');
}

// ========== JUSTIFIER ABSENCE ==========
function justifierAbsence(id, source) {
  const abs = absences.find(a => a.id === id);
  if (!abs) return;
  abs.statut = source === 'surv' ? 'justifie_s' : 'justifie_d';
  const sel = document.getElementById(source === 'surv' ? 'select-motif' : 'dir-motif');
  abs.motif = (sel && sel.value) ? sel.value : (abs.motif || 'Non justifié');
  abs.justifiePar = utilisateurConnecte ? utilisateurConnecte.nom : '';
  const now = new Date();
  abs.justifieLe = fmtDateISO(now) + ' ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  localStorage.setItem('absences', JSON.stringify(absences));
  if (source === 'surv') mettreAJourDashboardSurv();
  if (source === 'dir') afficherAbsencesDir();
  afficherToast(libelleStatut(abs.statut) + ' · ' + abs.motif, 'success');
}

// ========== DIRECTEUR — DASHBOARD ==========
function mettreAJourDashboardDir() {
  const totalEleves = classes.reduce((sum, c) => sum + c.eleves.length, 0);
  const today = fmtDateISO(new Date());
  const absencesToday = absences.filter(a => a.dateISO === today);

  document.getElementById('dir-eleves').textContent = totalEleves;
  document.getElementById('dir-classes').textContent = classes.length;
  document.getElementById('dir-absents').textContent = absencesToday.length;

  // Alertes
  const alertDiv = document.getElementById('dir-alerts');
  alertDiv.innerHTML = '';
  classes.forEach(cl => {
    const absCount = absences.filter(a => a.classe === cl.nom && a.dateISO === today).length;
    const taux = cl.eleves.length > 0 ? (absCount / cl.eleves.length) * 100 : 0;
    if (taux > 20) {
      const alert = document.createElement('div');
      alert.className = 'bg-red-50 border-l-4 border-red-500 p-3 rounded';
      alert.innerHTML = `
        <p class="font-bold text-red-700"><i class="fas fa-exclamation-triangle mr-1"></i> ${cl.nom}</p>
        <p class="text-sm text-red-600">${absCount} absent(s) sur ${cl.eleves.length} — Taux: ${Math.round(taux)}%</p>
      `;
      alertDiv.appendChild(alert);
    }
  });
  elevesAuDessusSeuil(SEUIL_ALERTE_MOIS).slice(0, 8).forEach(x => {
    const alEl = document.createElement('div');
    alEl.className = 'bg-orange-50 border-l-4 border-orange-400 p-3 rounded';
    alEl.innerHTML = '<p class="font-bold text-orange-700"><i class="fas fa-user-clock mr-1"></i>' + x.nom + '</p><p class="text-sm text-orange-600">' + x.classe + ' — ' + x.count + ' absences ce mois</p>';
    alertDiv.appendChild(alEl);
  });
  if (alertDiv.children.length === 0) {
    alertDiv.innerHTML = '<p class="text-gray-500 text-center py-4">Aucune alerte</p>';
  }

  // Classes critiques
  const critDiv = document.getElementById('dir-critical-classes');
  critDiv.innerHTML = '';
  let hasCritical = false;
  classes.forEach(cl => {
    const totalAbs = absences.filter(a => a.classe === cl.nom).length;
    const tauxGlobal = cl.eleves.length > 0 ? (totalAbs / (cl.eleves.length * 5)) * 100 : 0;
    if (tauxGlobal > 20) {
      hasCritical = true;
      const item = document.createElement('div');
      item.className = 'flex justify-between items-center p-3 bg-orange-50 rounded-lg';
      item.innerHTML = `
        <div>
          <p class="font-bold text-gray-800">${cl.nom}</p>
          <p class="text-xs text-gray-500">${cl.eleves.length} élèves</p>
        </div>
        <span class="badge badge-warning">${Math.round(tauxGlobal)}% absences</span>
      `;
      critDiv.appendChild(item);
    }
  });
  if (!hasCritical) critDiv.innerHTML = '<p class="text-gray-500 text-center py-4">Toutes les classes sont normales</p>';

  // Tendance
  const tendanceDiv = document.getElementById('dir-tendance');
  tendanceDiv.innerHTML = '';
  const jours = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'];
  const todayDate = new Date();
  for (let i = 4; i >= 0; i--) {
    const d = new Date(todayDate);
    d.setDate(d.getDate() - i);
    const dateStr = fmtDateISO(d);
    const count = absences.filter(a => a.dateISO === dateStr).length;
    const maxCount = Math.max(...jours.map((_, j) => {
      const dd = new Date(todayDate);
      dd.setDate(dd.getDate() - (4 - j));
      return absences.filter(a => a.dateISO === fmtDateISO(dd)).length;
    }), 1);
    const height = Math.max((count / maxCount) * 80, 10);
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.height = height + '%';
    bar.innerHTML = `<div class="bar-value">${count}</div><div class="bar-label">${jours[4 - i]}</div>`;
    tendanceDiv.appendChild(bar);
  }
}

// ========== DIRECTEUR — GESTION CRUD ==========
function afficherGestionDir() {
  // Afficher la liste des classes
  const listDiv = document.getElementById('dir-classes-list');
  listDiv.innerHTML = '';
  if (classes.length === 0) {
    listDiv.innerHTML = '<p class="text-gray-500 text-center py-8">Aucune classe. Importez un fichier MASSAR.</p>';
    return;
  }
  classes.forEach(cl => {
    const item = document.createElement('div');
    item.className = 'bg-gray-50 rounded-xl p-4';
    const elevesHTML = cl.eleves.map(e =>
      `<div class="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
        <div>
          <span class="text-gray-700">${libelleEleve(e)}</span>
          ${e.massar ? '<span class="text-xs text-gray-400 ml-2">' + e.massar + '</span>' : ''}
        </div>
        <button onclick="supprimerEleve(${cl.id}, ${e.id})" class="text-red-400 hover:text-red-600 text-sm"><i class="fas fa-times"></i></button>
      </div>`
    ).join('');
    item.innerHTML = `
      <div class="flex justify-between items-center mb-2 cursor-pointer" onclick="ouvrirDetailClasse(${cl.id})">
        <div>
          <p class="font-bold text-gray-800">${cl.nom}</p>
          <p class="text-sm text-gray-500">${cl.eleves.length} élèves</p>
        </div>
        <i class="fas fa-chevron-right text-gray-400"></i>
      </div>
      ${elevesHTML}
    `;
    listDiv.appendChild(item);
  });
}

function supprimerEleve(classeId, eleveId) {
  const classe = classes.find(c => c.id === classeId);
  if (!classe) return;
  classe.eleves = classe.eleves.filter(e => e.id !== eleveId);
  absences = absences.filter(a => !(a.eleveId === eleveId && a.classe === classe.nom));
  localStorage.setItem('absences', JSON.stringify(absences));
  sauvegarderClasses();
  afficherGestionDir();
  mettreAJourDashboardDir();
  afficherToast('Eleve supprimé', 'success');
}

function supprimerClasseCourante() {
  if (classeDetailCourante) {
    const cl = classes.find(c => c.id === classeDetailCourante);
    if (cl) {
      absences = absences.filter(a => a.classe !== cl.nom);
      localStorage.setItem('absences', JSON.stringify(absences));
    }
    classes = classes.filter(c => c.id !== classeDetailCourante);
    sauvegarderClasses();
    fermerDetailClasse();
    afficherGestionDir();
    mettreAJourDashboardDir();
    afficherToast('Classe supprimée', 'success');
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
    elevesDiv.innerHTML = cl.eleves.map(e =>
      `<div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg mb-2">
        <div>
          <span class="font-medium">${libelleEleve(e)}</span>
          ${e.massar ? '<span class="text-xs text-gray-400 ml-2">(' + e.massar + ')</span>' : ''}
        </div>
        <button onclick="supprimerEleve(${cl.id}, ${e.id}); ouvrirDetailClasse(${cl.id});" class="text-red-500 hover:text-red-700"><i class="fas fa-trash-alt"></i></button>
      </div>`
    ).join('');
  }
  document.getElementById('modal-classe-detail').classList.remove('hidden');
}

function fermerDetailClasse() {
  document.getElementById('modal-classe-detail').classList.add('hidden');
  classeDetailCourante = null;
}

// ========== DIRECTEUR — ABSENCES & JUSTIFICATION ==========
function afficherAbsencesDir() {
  const tbody = document.getElementById('dir-absences-body');
  tbody.innerHTML = '';
  let filtres = absences.slice().reverse();
  if (filterDirActive === 'absent') filtres = filtres.filter(a => a.statut !== 'justifie_s' && a.statut !== 'justifie_d');
  if (filterDirActive === 'justifie_s') filtres = filtres.filter(a => a.statut === 'justifie_s');
  if (filterDirActive === 'justifie_d') filtres = filtres.filter(a => a.statut === 'justifie_d');

  if (filtres.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 py-8">Aucun signalement</td></tr>';
    return;
  }
  filtres.forEach(abs => {
    const tr = document.createElement('tr');
    const badgeClass = abs.statut === 'justifie_s' ? 'badge-info' : abs.statut === 'justifie_d' ? 'badge-success' : 'badge-danger';
    const isJustified = abs.statut === 'justifie_s' || abs.statut === 'justifie_d';
    const details = libelleType(abs.type) + (abs.duree ? ' (' + abs.duree + ')' : '') + (abs.motif ? ' · ' + abs.motif : '');
    tr.innerHTML = `
      <td class="font-medium">${abs.nom}<div class="text-xs text-gray-400">${details}</div></td>
      <td>${abs.classe}</td>
      <td>${abs.date}${abs.seance ? '<div class="text-xs text-gray-400">' + libelleSeance(abs.seance) + '</div>' : ''}</td>
      <td><span class="badge ${badgeClass}">${libelleStatut(abs.statut)}</span></td>
      <td>${!isJustified ? '<button onclick="justifierAbsence(' + abs.id + ', &quot;dir&quot;)" class="btn-warning">Justifier</button>' : '<span class="text-green-600 text-sm">✓</span>'}</td>
    `;
    tbody.appendChild(tr);
  });
}

function filterDirAbsences(type, el) {
  filterDirActive = type;
  el.closest('.toolbar').querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  afficherAbsencesDir();
}

// ========== DIRECTEUR — IMPORT MASSAR EXCEL ==========
let importData = null;

// Drag & drop
const dropZone = document.getElementById('drop-zone');
if (dropZone) {
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('border-blue-500', 'bg-blue-50'); });
  dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('border-blue-500', 'bg-blue-50'); });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-blue-500', 'bg-blue-50');
    const file = e.dataTransfer.files[0];
    if (file) processMassarFile(file);
  });
}

function importerMassar(input) {
  const file = input.files[0];
  if (file) processMassarFile(file);
  input.value = '';
}

function processMassarFile(file) {
  const errorDiv = document.getElementById('import-error');
  const previewDiv = document.getElementById('import-preview');
  errorDiv.classList.add('hidden');
  previewDiv.classList.add('hidden');

  if (!file.name.match(/\.xlsx?$/i)) {
    errorDiv.textContent = 'Fichier invalide. Seuls les fichiers .xlsx sont acceptés.';
    errorDiv.classList.remove('hidden');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      const resultats = [];
      workbook.SheetNames.forEach(nomFeuille => {
        const parsed = analyserFeuilleMASSAR(workbook.Sheets[nomFeuille]);
        if (parsed) resultats.push(parsed);
      });
      if (resultats.length === 0) {
        errorDiv.textContent = 'Aucune classe détectée. Vérifiez le format MASSAR (nom de classe en I9, élèves à partir de la ligne 18, colonnes C = code, D = nom arabe, E = nom français).';
        errorDiv.classList.remove('hidden');
        return;
      }
      importData = { classes: resultats };
      const total = resultats.reduce((s, c) => s + c.eleves.length, 0);
      document.getElementById('preview-classe-nom').textContent = resultats.length + ' classe(s) détectée(s)';
      document.getElementById('preview-eleves-count').textContent = total + ' élève(s) au total';
      document.getElementById('preview-eleves-list').innerHTML = resultats.map(c =>
        '<div class="flex justify-between py-1 border-b border-green-100"><span class="font-medium">' + c.nom + '</span><span class="text-xs text-gray-400">' + c.eleves.length + ' élèves</span></div>'
      ).join('');
      previewDiv.classList.remove('hidden');
    } catch (err) {
      errorDiv.textContent = 'Erreur de lecture du fichier : ' + err.message;
      errorDiv.classList.remove('hidden');
    }
  };
  reader.readAsArrayBuffer(file);
}

function analyserFeuilleMASSAR(ws) {
  if (!ws || !ws['!ref']) return null;
  const range = XLSX.utils.decode_range(ws['!ref']);
  const cellI9 = ws['I9'];
  const nomClasse = cellI9 && cellI9.v ? String(cellI9.v).trim() : '';
  if (!nomClasse) return null;
  const eleves = [];
  for (let row = 17; row <= range.e.r; row++) {
    const cellB = ws[XLSX.utils.encode_cell({ r: row, c: 1 })];
    const cellC = ws[XLSX.utils.encode_cell({ r: row, c: 2 })];
    const cellD = ws[XLSX.utils.encode_cell({ r: row, c: 3 })];
    const cellE = ws[XLSX.utils.encode_cell({ r: row, c: 4 })];
    const nomArabe = cellD && cellD.v ? String(cellD.v).trim() : '';
    const nomFr = cellE && cellE.v ? String(cellE.v).trim() : '';
    const massar = cellC && cellC.v !== undefined ? String(cellC.v).trim() : '';
    if (cellB && cellB.v && (nomArabe || nomFr)) {
      eleves.push({ id: nextEleveId++, massar: massar, nomArabe: nomArabe, nomFr: nomFr, nom: (nomFr || nomArabe), prenom: '' });
    }
  }
  if (eleves.length === 0) return null;
  return { nom: nomClasse, eleves: eleves };
}

function confirmerImport() {
  if (!importData || !importData.classes) return;
  let nouvelles = 0;
  let ajoutes = 0;
  importData.classes.forEach(clImport => {
    const existante = classes.find(c => c.nom.toLowerCase() === clImport.nom.toLowerCase());
    if (existante) {
      clImport.eleves.forEach(e => {
        existante.eleves.push({ id: e.id, nom: e.nom, prenom: e.prenom, massar: e.massar, nomArabe: e.nomArabe, nomFr: e.nomFr });
        ajoutes++;
      });
    } else {
      classes.push({
        id: nextClasseId++,
        nom: clImport.nom,
        eleves: clImport.eleves.map(e => ({ id: e.id, nom: e.nom, prenom: e.prenom, massar: e.massar, nomArabe: e.nomArabe, nomFr: e.nomFr }))
      });
      nouvelles++;
    }
  });
  sauvegarderClasses();
  const total = importData.classes.reduce((s, c) => s + c.eleves.length, 0);
  importData = null;
  document.getElementById('import-preview').classList.add('hidden');
  afficherGestionDir();
  mettreAJourDashboardDir();
  remplirListeClasses();
  afficherToast(nouvelles + ' classe(s) importée(s) · ' + ajoutes + ' élève(s) ajouté(s) — ' + total + ' au total', 'success');
}

// ========== RECHERCHE ELEVE ==========
function chercherEleves(terme) {
  terme = (terme || '').trim().toLowerCase();
  if (terme.length < 2) return [];
  const res = [];
  classes.forEach(cl => cl.eleves.forEach(el => {
    const nom = (libelleEleve(el) + ' ' + (el.nomArabe || '')).toLowerCase();
    const massar = (el.massar || '').toLowerCase();
    if (nom.indexOf(terme) >= 0 || massar.indexOf(terme) >= 0) res.push({ eleve: el, classe: cl });
  }));
  return res.slice(0, 30);
}

function rechercherEleves(idInput, idResultats) {
  const champ = document.getElementById(idInput);
  const cont = document.getElementById(idResultats);
  if (!champ || !cont) return;
  const terme = champ.value;
  cont.innerHTML = '';
  if (!terme || terme.trim().length < 2) {
    cont.innerHTML = '<p class="text-xs text-gray-400 text-center">Saisissez au moins 2 caractères</p>';
    return;
  }
  const res = chercherEleves(terme);
  if (res.length === 0) {
    cont.innerHTML = '<p class="text-xs text-gray-400 text-center">Aucun élève trouvé</p>';
    return;
  }
  res.forEach(r => {
    const nb = absences.filter(a => a.eleveId === r.eleve.id && a.classe === r.classe.nom).length;
    const item = document.createElement('div');
    item.className = 'flex justify-between items-center p-3 bg-gray-50 rounded-lg';
    item.style.cursor = 'pointer';
    item.onclick = () => ouvrirFicheEleve(r.eleve.id, r.classe.id);
    item.innerHTML = '<div><p class="font-medium text-gray-800">' + libelleEleve(r.eleve) + '</p><p class="text-xs text-gray-500">' + r.classe.nom + (r.eleve.massar ? ' · ' + r.eleve.massar : '') + '</p></div><span class="badge badge-danger">' + nb + '</span>';
    cont.appendChild(item);
  });
}

// ========== FICHE ELEVE ==========
let ficheEleveId = null;
let ficheClasseId = null;

function ligneFiche(titre, valeur) {
  return '<div class="detail-ligne"><span class="detail-titre">' + titre + '</span><span class="detail-reponse">' + valeur + '</span></div>';
}

function ouvrirFicheEleve(eleveId, classeId) {
  const cl = classes.find(c => c.id === classeId);
  if (!cl) return;
  const el = cl.eleves.find(e => e.id === eleveId);
  if (!el) return;
  ficheEleveId = eleveId;
  ficheClasseId = classeId;
  document.getElementById('fiche-titre').textContent = libelleEleve(el);
  const lignes = absences.filter(a => a.eleveId === eleveId && a.classe === cl.nom);
  const nbAbs = lignes.filter(a => (a.type || 'absence') === 'absence').length;
  const nbRet = lignes.filter(a => a.type === 'retard').length;
  const nbExc = lignes.filter(a => a.type === 'exclusion').length;
  document.getElementById('fiche-infos').innerHTML =
    ligneFiche('Classe', cl.nom) +
    ligneFiche('Code MASSAR', el.massar || '—') +
    ligneFiche('Nom arabe', el.nomArabe || el.nom || '—') +
    ligneFiche('Nom français', el.nomFr || el.nom || '—') +
    ligneFiche('Totaux', nbAbs + ' absence(s) · ' + nbRet + ' retard(s) · ' + nbExc + ' exclusion(s)');
  const hist = lignes.slice().sort((a, b) => String(b.dateISO || '').localeCompare(String(a.dateISO || '')));
  const cont = document.getElementById('fiche-historique');
  if (hist.length === 0) {
    cont.innerHTML = '<p class="text-gray-500 text-center py-4">Aucun incident enregistré</p>';
  } else {
    cont.innerHTML = hist.map(a => {
      const badge = a.statut === 'justifie_s' ? 'badge-info' : a.statut === 'justifie_d' ? 'badge-success' : 'badge-danger';
      const info = libelleType(a.type) + (a.duree ? ' (' + a.duree + ')' : '') + ' · ' + (a.matiere || '') + ' · ' + (a.enseignant || '') + (a.motif ? ' · Motif : ' + a.motif : '');
      return '<div class="p-3 bg-gray-50 rounded-lg"><div class="flex justify-between items-center"><span class="font-medium text-gray-800">' + (a.date || '') + ' · ' + (a.heure || '') + ' · ' + libelleSeance(a.seance) + '</span><span class="badge ' + badge + '">' + libelleStatut(a.statut) + '</span></div><p class="text-xs text-gray-500 mt-1">' + info + '</p></div>';
    }).join('');
  }
  document.getElementById('modal-fiche-eleve').classList.remove('hidden');
}

function fermerFicheEleve() {
  document.getElementById('modal-fiche-eleve').classList.add('hidden');
  ficheEleveId = null;
  ficheClasseId = null;
}

function exporterFicheEleve() {
  if (!ficheEleveId) return;
  const cl = classes.find(c => c.id === ficheClasseId);
  const el = cl ? cl.eleves.find(e => e.id === ficheEleveId) : null;
  if (!el) return;
  const lignes = absences.filter(a => a.eleveId === ficheEleveId && a.classe === cl.nom);
  const rows = lignes.map(a => ({
    Date: a.date || '',
    Seance: libelleSeance(a.seance),
    Heure: a.heure || '',
    Type: libelleType(a.type),
    Duree: a.duree || '',
    Matiere: a.matiere || '',
    Enseignant: a.enseignant || '',
    Statut: libelleStatut(a.statut),
    Motif: a.motif || '',
    JustifiePar: a.justifiePar || '',
    JustifieLe: a.justifieLe || ''
  }));
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Info: 'Aucun incident' }]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Fiche');
  XLSX.writeFile(wb, 'fiche_' + (el.nom || 'eleve').replace(/\s+/g, '_') + '.xlsx');
  afficherToast('Fiche exportée', 'success');
}

// ========== INIT ==========
function init() {
  const saved = localStorage.getItem('utilisateur');
  if (saved) {
    try {
      const compte = JSON.parse(saved);
      const valid = comptes.find(c => c.email === compte.email && c.role === compte.role);
      if (valid) {
        utilisateurConnecte = valid;
        if (valid.role === 'enseignant') { afficherEcran('enseignant'); remplirListeClasses(); choisirClasse(''); afficherInfosProf(); resetSaisie(); }
        else if (valid.role === 'surveillant') { afficherEcran('surveillant'); mettreAJourDashboardSurv(); }
        else if (valid.role === 'directeur') { afficherEcran('directeur'); mettreAJourDashboardDir(); }
        return;
      }
    } catch(e) {}
  }
  afficherEcran('login');
}

// Enter key pour login
document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && document.getElementById('page-login').classList.contains('active')) {
    connexion();
  }
});

init();
