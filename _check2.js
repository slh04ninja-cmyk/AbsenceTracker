
// ========== BASE DE DONNÉES ==========
const classesDemo = [
  { id: 1, nom: "3ème A", eleves: [
    { id: 1, nom: "Dupont", prenom: "Martin" },
    { id: 2, nom: "Martin", prenom: "Sophie" },
    { id: 3, nom: "Bernard", prenom: "Lucas" },
    { id: 4, nom: "Petit", prenom: "Élise" },
    { id: 5, nom: "Robert", prenom: "Thomas" },
    { id: 6, nom: "Durand", prenom: "Camille" },
    { id: 7, nom: "Lefèvre", prenom: "Hugo" },
    { id: 8, nom: "Moreau", prenom: "Chloé" },
    { id: 9, nom: "Simon", prenom: "Maxime" },
    { id: 10, nom: "Laurent", prenom: "Inès" }
  ]},
  { id: 2, nom: "3ème B", eleves: [
    { id: 11, nom: "Rousseau", prenom: "Antoine" },
    { id: 12, nom: "Blanc", prenom: "Lucie" },
    { id: 13, nom: "Fournier", prenom: "Gabriel" },
    { id: 14, nom: "Gagnon", prenom: "Marine" },
    { id: 15, nom: "Hervé", prenom: "Léo" },
    { id: 16, nom: "Maury", prenom: "Alice" },
    { id: 17, nom: "Lefevre", prenom: "Tom" },
    { id: 18, nom: "Godier", prenom: "Emma" }
  ]},
  { id: 3, nom: "4ème A", eleves: [
    { id: 19, nom: "Durant", prenom: "Alex" },
    { id: 20, nom: "Basile", prenom: "Louise" },
    { id: 21, nom: "Collet", prenom: "Nicolas" },
    { id: 22, nom: "Chambon", prenom: "Zoé" },
    { id: 23, nom: "Bonneau", prenom: "Tom" },
    { id: 24, nom: "Dupuis", prenom: "Clara" },
    { id: 25, nom: "Etienne", prenom: "Paul" },
    { id: 26, nom: "Fouquet", prenom: "Victoria" },
    { id: 27, nom: "Gerard", prenom: "Simon" }
  ]},
  { id: 4, nom: "4ème B", eleves: [
    { id: 28, nom: "Gilles", prenom: "Benjamin" },
    { id: 29, nom: "Gautier", prenom: "Océane" },
    { id: 30, nom: "Guillot", prenom: "David" },
    { id: 31, nom: "Henry", prenom: "Camille" },
    { id: 32, nom: "Hubert", prenom: "Julien" },
    { id: 33, nom: "Jacob", prenom: "Léa" },
    { id: 34, nom: "Lacroix", prenom: "Mathieu" },
    { id: 35, nom: "Lagarde", prenom: "Manon" },
    { id: 36, nom: "Langelier", prenom: "Pierre" },
    { id: 37, nom: "Launay", prenom: "Sophie" },
    { id: 38, nom: "Laurent", prenom: "Marc" }
  ]}
];

// ========== CHARGEMENT DES CLASSES (persistees en localStorage) ==========
let classes = [];
let nextClasseId = 1;
let nextEleveId = 1;

function chargerClasses() {
  const sauve = localStorage.getItem('classes');
  if (sauve) {
    try {
      const liste = JSON.parse(sauve);
      if (Array.isArray(liste) && liste.length > 0) {
        nextClasseId = liste.reduce((m, c) => Math.max(m, c.id), 0) + 1;
        nextEleveId = liste.reduce((m, c) => Math.max(m, c.eleves.reduce((mm, e) => Math.max(mm, e.id), 0)), 0) + 1;
        return liste;
      }
    } catch (e) {}
  }
  const init = JSON.parse(JSON.stringify(classesDemo));
  nextClasseId = 5;
  nextEleveId = 39;
  sauvegarderClasses(init);
  return init;
}

function sauvegarderClasses(liste) {
  localStorage.setItem('classes', JSON.stringify(liste || classes));
}

classes = chargerClasses();

// ========== COMPTES UTILISATEURS ==========
const comptes = [
  { email: "1@taalim.ma", password: "12345", role: "enseignant", nom: "Prof. Martin" },
  { email: "2@taalim.ma", password: "12345", role: "surveillant", nom: "Surveillant Durand" },
  { email: "3@taalim.ma", password: "12345", role: "directeur", nom: "Directeur Bernard" }
];

// ========== VARIABLES GLOBALES ==========
let absences = JSON.parse(localStorage.getItem('absences')) || [];
let utilisateurConnecte = null;
let elevesCoches = new Set();
let classeSelectionnee = null;
let matiereSelectionnee = 'Math\xe9matiques';
let filterActive = 'all';
let filterDirActive = 'all';
let classeDetailCourante = null;
let decochesManuellement = new Set(); // Élèves décochés manuellement après sauvegarde

// Date locale (evite le decalage UTC: toISOString renvoie la veille a 00h-01h au Maroc)
function fmtDateISO(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const j = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + j;
} // Élèves décochés manuellement après sauvegarde

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
  const select = document.getElementById('select-classe');
  select.innerHTML = '<option value="">-- Choisir une classe --</option>';
  classes.forEach(classe => {
    const opt = document.createElement('option');
    opt.value = classe.id;
    opt.textContent = classe.nom + ' (' + classe.eleves.length + ' élèves)';
    select.appendChild(opt);
  });
}

function changerClasse() {
  const id = parseInt(document.getElementById('select-classe').value);
  if (!id) {
    classeSelectionnee = null;
    document.getElementById('toolbar-filtres').classList.add('hidden');
    document.getElementById('liste-eleves-enseignant').innerHTML = '';
    document.getElementById('ens-classe-name').textContent = 'Sélectionnez une classe';
    return;
  }
  classeSelectionnee = classes.find(c => c.id === id);
  elevesCoches.clear();
  decochesManuellement.clear();
  filterActive = 'all';
  document.getElementById('ens-classe-name').textContent = classeSelectionnee.nom;
  document.getElementById('toolbar-filtres').classList.remove('hidden');
  document.querySelectorAll('#toolbar-filtres .filter-chip').forEach(c => c.classList.remove('active'));
  document.querySelector('#toolbar-filtres .filter-chip').classList.add('active');
  afficherListeEleves();
  mettreAJourCompteur();
}

function changerMatiere() {
  matiereSelectionnee = document.getElementById('select-matiere').value;
}

function afficherListeEleves() {
  const div = document.getElementById('liste-eleves-enseignant');
  div.innerHTML = '';
  if (!classeSelectionnee) {
    div.innerHTML = '<div class="empty-state py-12"><div class="empty-icon"><i class="fas fa-school"></i></div><p class="text-gray-600">Sélectionnez une classe</p></div>';
    return;
  }
  const tousLesEleves = classeSelectionnee.eleves;
  const todayISO = fmtDateISO(new Date());

  // Absences sauvegardées aujourd'hui (éditables)
  const absentsAujourdhui = new Set(
    absences.filter(a => a.classe === classeSelectionnee.nom && a.dateISO === todayISO && a.statut !== 'justifie_s' && a.statut !== 'justifie_d')
      .map(a => a.eleveId)
  );

  // Absences des séances précédentes (AVANT aujourd'hui) → verrouillées
  const absentsPrecedents = new Set(
    absences.filter(a => a.classe === classeSelectionnee.nom && a.dateISO < todayISO && a.statut !== 'justifie_s' && a.statut !== 'justifie_d')
      .map(a => a.eleveId)
  );

  let filtres;
  if (filterActive === 'absents') {
    filtres = tousLesEleves.filter(el => {
      const estAbsentAuj = (elevesCoches.has(el.id) || absentsAujourdhui.has(el.id)) && !decochesManuellement.has(el.id);
      return estAbsentAuj || absentsPrecedents.has(el.id);
    });
  } else if (filterActive === 'presents') {
    filtres = tousLesEleves.filter(el => {
      const estAbsentAuj = (elevesCoches.has(el.id) || absentsAujourdhui.has(el.id)) && !decochesManuellement.has(el.id);
      return !estAbsentAuj && !absentsPrecedents.has(el.id);
    });
  } else {
    filtres = tousLesEleves;
  }

  if (filtres.length === 0) {
    const msg = filterActive === 'absents' ? 'Aucun élève absent' : filterActive === 'presents' ? 'Tous les élèves sont absents' : 'Aucun élève';
    const iconeEmpty = filterActive === 'absents' ? 'fa-user-check' : 'fa-users';
    div.innerHTML = '<div class="empty-state py-8"><div class="empty-icon"><i class="fas ' + iconeEmpty + '"></i></div><p class="text-gray-500">' + msg + '</p></div>';
    return;
  }

  filtres.forEach(eleve => {
    const estAbsentAujourdhui = (elevesCoches.has(eleve.id) || absentsAujourdhui.has(eleve.id)) && !decochesManuellement.has(eleve.id);
    const estAbsentPrecedent = absentsPrecedents.has(eleve.id);
    const estVerrouille = estAbsentPrecedent;
    const estCoche = estAbsentAujourdhui || estAbsentPrecedent;
    const numero = tousLesEleves.findIndex(e => e.id === eleve.id) + 1;

    const item = document.createElement('div');
    item.className = 'flex items-center justify-between px-4 py-3 border-b border-gray-100 transition-all';
    item.style = estCoche ? 'border-left: 5px solid #ef4444; background: #fef2f2' : 'border-left: 5px solid transparent';

    const checkboxHTML = estVerrouille
      ? `<input type="checkbox" checked disabled class="checkbox-locked"><i class="fas fa-lock lock-icon"></i>`
      : `<input type="checkbox" ${estCoche ? 'checked' : ''} onchange="gererCoche(${eleve.id}, this.checked)" class="checkbox-material">`;

    item.innerHTML = `
      <div class="flex items-center gap-3 flex-1">
        <span class="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${estCoche ? 'bg-red-500 text-white' : 'bg-blue-100 text-blue-900'}">${numero}</span>
        <span class="font-medium ${estCoche ? 'text-red-700' : 'text-gray-800'}">${eleve.nom} ${eleve.prenom}</span>
        ${estVerrouille ? '<span class="text-xs text-gray-400 ml-1">(séance préc.)</span>' : ''}
      </div>
      ${checkboxHTML}
    `;
    div.appendChild(item);
  });
}

function gererCoche(id, coche) {
  if (coche) {
    elevesCoches.add(id);
    decochesManuellement.delete(id);
  } else {
    elevesCoches.delete(id);
    decochesManuellement.add(id);
    // Supprimer l'absence sauvegardée aujourd'hui pour cet élève
    const todayISO = fmtDateISO(new Date());
    absences = absences.filter(a => !(a.eleveId === id && a.dateISO === todayISO && a.classe === classeSelectionnee.nom));
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
    const todayISO = fmtDateISO(new Date());
    const absentsAuj = absences.filter(a => a.classe === classeSelectionnee.nom && a.dateISO === todayISO && a.statut !== 'justifie_s' && a.statut !== 'justifie_d').length;
    const absentsPrec = absences.filter(a => a.classe === classeSelectionnee.nom && a.dateISO < todayISO && a.statut !== 'justifie_s' && a.statut !== 'justifie_d').length;
    const total = Math.max(elevesCoches.size + absentsPrec, absentsAuj + absentsPrec);
    document.getElementById('count-absents').textContent = total;
    document.getElementById('count-total').textContent = classeSelectionnee.eleves.length;
  }
}

// ========== ENSEIGNANT — CONFIRMATION & ENREGISTREMENT ==========
function afficherConfirmationAbsences() {
  if (elevesCoches.size === 0) {
    afficherToast('Cochez au moins un élève', 'error');
    return;
  }
  document.getElementById('message-confirmation').textContent = 'Enregistrer les absences de ' + elevesCoches.size + ' élève(s) ?';
  document.getElementById('modal-confirmation').classList.remove('hidden');
}

function annulerConfirmation() {
  document.getElementById('modal-confirmation').classList.add('hidden');
}

function confirmerAbsences() {
  const now = new Date();
  const heure = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  const date = now.toLocaleDateString('fr-FR');
  const dateISO = fmtDateISO(now);

  // Sauvegarder seulement les élèves cochés qui ne sont pas dans decochesManuellement
  const todayISO2 = fmtDateISO(now);
  elevesCoches.forEach(idEleve => {
    if (decochesManuellement.has(idEleve)) return;
    // Ne pas dupliquer si déjà sauvegardé aujourd'hui
    const dejaSauve = absences.find(a => a.eleveId === idEleve && a.dateISO === todayISO2 && a.classe === classeSelectionnee.nom);
    if (dejaSauve) return;
    const eleve = classeSelectionnee.eleves.find(e => e.id === idEleve);
    absences.push({
      id: Date.now() + Math.random(),
      eleveId: eleve.id,
      nom: eleve.nom + ' ' + eleve.prenom,
      classe: classeSelectionnee.nom,
      heure: heure,
      date: date,
      dateISO: dateISO,
      statut: 'absent',
      enseignant: utilisateurConnecte.nom,
      matiere: matiereSelectionnee
    });
  });

  localStorage.setItem('absences', JSON.stringify(absences));
  document.getElementById('modal-confirmation').classList.add('hidden');
  afficherToast('Absences enregistrées !', 'success');
  elevesCoches.clear();
  // Ne PAS vider decochesManuellement pour garder l'état décoché
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
    document.getElementById('top-absents').innerHTML = '<p class="text-gray-500 text-center py-4">Sélectionnez une classe</p>';
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
    listContainer.innerHTML = '<div style="text-align: center; padding: 32px 16px; color: #94a3b8;"><i class="fas fa-user-check" style="font-size: 32px; margin-bottom: 12px; display: block; opacity: 0.4;"></i><p>Aucun élève absent aujourd\'hui</p></div>';
    return;
  }

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

function afficherDetailAbsence(abs) {
  document.getElementById('detail-nom').textContent = abs.nom;
  document.getElementById('detail-classe').textContent = abs.classe;
  document.getElementById('detail-date').textContent = abs.date;
  document.getElementById('detail-heure').textContent = abs.heure || '-';
  document.getElementById('detail-prof').textContent = abs.enseignant || '-';
  document.getElementById('detail-matiere').textContent = abs.matiere || '-';
  
  const badgeContainer = document.getElementById('detail-statut-badge');
  const badgeClass = abs.statut === 'justifie_s' ? 'badge-info' : abs.statut === 'justifie_d' ? 'badge-success' : 'badge-danger';
  const badgeText = abs.statut === 'justifie_s' ? 'Justifiée S' : abs.statut === 'justifie_d' ? 'Justifiée D' : 'Absent';
  badgeContainer.innerHTML = `<span class="badge ${badgeClass}">${badgeText}</span>`;
  
  const btnJustifier = document.getElementById('btn-justifier-absence');
  if (abs.statut === 'absent') {
    btnJustifier.style.display = 'block';
    btnJustifier.onclick = () => {
      justifierAbsence(abs.id, 'surv');
      fermerDetailAbsence();
    };
  } else {
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
  if (abs) {
    abs.statut = source === 'surv' ? 'justifie_s' : 'justifie_d';
    localStorage.setItem('absences', JSON.stringify(absences));
    if (source === 'surv') mettreAJourDashboardSurv();
    if (source === 'dir') afficherAbsencesDir();
    const label = source === 'surv' ? 'Justifiée S' : 'Justifiée D';
    afficherToast('Absence ' + label, 'success');
  }
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
          <span class="text-gray-700">${e.nom} ${e.prenom || ''}</span>
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
          <span class="font-medium">${e.nom} ${e.prenom || ''}</span>
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
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 py-8">Aucune absence</td></tr>';
    return;
  }
  filtres.forEach(abs => {
    const tr = document.createElement('tr');
    const badgeClass = abs.statut === 'justifie_s' ? 'badge-info' : abs.statut === 'justifie_d' ? 'badge-success' : 'badge-danger';
    const badgeText = abs.statut === 'justifie_s' ? 'Justifiée S' : abs.statut === 'justifie_d' ? 'Justifiée D' : 'Absent';
    const isJustified = abs.statut === 'justifie_s' || abs.statut === 'justifie_d';
    tr.innerHTML = `
      <td class="font-medium">${abs.nom}</td>
      <td>${abs.classe}</td>
      <td>${abs.date}</td>
      <td><span class="badge ${badgeClass}">${badgeText}</span></td>
      <td>
        ${!isJustified ? `<button onclick="justifierAbsence(${abs.id}, 'dir')" class="btn-warning">Justifier</button>` : '<span class="text-green-600 text-sm">✓</span>'}
      </td>
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
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const ws = workbook.Sheets[sheetName];
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

      // Extraire le nom de la classe depuis I9
      let classeNom = '';
      const cellI9 = ws['I9'];
      if (cellI9 && cellI9.v) {
        classeNom = String(cellI9.v).trim();
      }
      if (!classeNom) {
        errorDiv.textContent = 'Impossible de trouver le nom de la classe (cellule I9 vide). Vérifiez le format MASSAR.';
        errorDiv.classList.remove('hidden');
        return;
      }

      // Extraire les élèves à partir de la ligne 18
      const eleves = [];
      for (let row = 17; row <= range.e.r; row++) {
        const cellB = ws[XLSX.utils.encode_cell({ r: row, c: 1 })]; // Col B = ID
        const cellC = ws[XLSX.utils.encode_cell({ r: row, c: 2 })]; // Col C = Massar
        const cellD = ws[XLSX.utils.encode_cell({ r: row, c: 3 })]; // Col D = Nom arabe
        if (cellB && cellB.v && cellD && cellD.v) {
          const nomComplet = String(cellD.v).trim();
          const massarCode = cellC ? String(cellC.v).trim() : '';
          eleves.push({
            id: nextEleveId++,
            massar: massarCode,
            nom: nomComplet,
            prenom: '',
            nomComplet: nomComplet
          });
        }
      }

      if (eleves.length === 0) {
        errorDiv.textContent = 'Aucun élève trouvé dans le fichier. Vérifiez le format.';
        errorDiv.classList.remove('hidden');
        return;
      }

      // Stocker les données d'import
      importData = { nom: classeNom, eleves: eleves };

      // Afficher l'aperçu
      document.getElementById('preview-classe-nom').textContent = classeNom;
      document.getElementById('preview-eleves-count').textContent = eleves.length + ' élève(s) détecté(s)';
      const listHTML = eleves.map(e =>
        '<div class="flex justify-between py-1 border-b border-green-100">' +
        '<span>' + e.nomComplet + '</span>' +
        '<span class="text-xs text-gray-400">' + e.massar + '</span>' +
        '</div>'
      ).join('');
      document.getElementById('preview-eleves-list').innerHTML = listHTML;
      previewDiv.classList.remove('hidden');

    } catch (err) {
      errorDiv.textContent = 'Erreur de lecture du fichier : ' + err.message;
      errorDiv.classList.remove('hidden');
    }
  };
  reader.readAsArrayBuffer(file);
}

function confirmerImport() {
  if (!importData) return;

  // Vérifier si la classe existe déjà
  const existante = classes.find(c => c.nom.toLowerCase() === importData.nom.toLowerCase());
  if (existante) {
    importData.eleves.forEach(e => {
      existante.eleves.push({ id: e.id, nom: e.nom, prenom: e.prenom, massar: e.massar });
    });
    afficherToast(importData.eleves.length + ' élève(s) ajouté(s) à ' + existante.nom, 'success');
  } else {
    classes.push({
      id: nextClasseId++,
      nom: importData.nom,
      eleves: importData.eleves.map(e => ({ id: e.id, nom: e.nom, prenom: e.prenom, massar: e.massar }))
    });
    afficherToast('Classe ' + importData.nom + ' importée avec ' + importData.eleves.length + ' élève(s)', 'success');
  }

  sauvegarderClasses();
  importData = null;
  document.getElementById('import-preview').classList.add('hidden');
  afficherGestionDir();
  mettreAJourDashboardDir();
}

// ========== INIT ==========
function init() {
  // Données de test : élève N°5 de chaque classe absent depuis hier
  if (!localStorage.getItem('testDataLoaded')) {
    const hier = new Date();
    hier.setDate(hier.getDate() - 1);
    const hierISO = fmtDateISO(hier);
    const hierFR = hier.toLocaleDateString('fr-FR');

    classes.forEach(cl => {
      if (cl.eleves.length >= 5) {
        const eleve5 = cl.eleves[4]; // Index 4 = N°5
        absences.push({
          id: Date.now() + Math.random(),
          eleveId: eleve5.id,
          nom: eleve5.nom + ' ' + eleve5.prenom,
          classe: cl.nom,
          heure: '08:00',
          date: hierFR,
          dateISO: hierISO,
          statut: 'absent',
          enseignant: 'Prof. Martin'
        });
      }
    });
    localStorage.setItem('absences', JSON.stringify(absences));
    localStorage.setItem('testDataLoaded', 'true');
  }

  const saved = localStorage.getItem('utilisateur');
  if (saved) {
    try {
      const compte = JSON.parse(saved);
      const valid = comptes.find(c => c.email === compte.email && c.role === compte.role);
      if (valid) {
        utilisateurConnecte = valid;
        if (valid.role === 'enseignant') { afficherEcran('enseignant'); remplirListeClasses(); }
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
