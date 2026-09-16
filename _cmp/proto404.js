
// ========== BASE DE DONNÉES ==========
const prenomsDemo = ['Ahmed', 'Fatima', 'Mohamed', 'Khadija', 'Youssef', 'Salma', 'Omar', 'Aya', 'Mehdi', 'Imane', 'Karim', 'Noura', 'Hamza', 'Yassine', 'Sara', 'Anas', 'Malak', 'Reda', 'Ghita', 'Adam', 'Lina', 'Walid', 'Douae', 'Zakaria', 'Hiba', 'Bilal', 'Meriem', 'Soufiane', 'Nisrine', 'Amine', 'Ouiam', 'Taha', 'Rania', 'Ayoub', 'Kawtar', 'Ismail', 'Rim', 'Adil', 'Amal', 'Jawad'];
const nomsDemo = ['El Amrani', 'Benali', 'Alami', 'El Fassi', 'Chraibi', 'Berrada', 'El Idrissi', 'Bennani', 'Tazi', 'El Khatib', 'Ouazzani', 'Benjelloun', 'Sekkat', 'El Mansouri', 'Bouazza', 'El Ghazi', 'Tahiri', 'Naciri', 'El Harrak', 'Kabbaj', 'Zouiten', 'Bennis', 'Lamrani', 'Sefrioui', 'Benkirane', 'Fikri', 'Belkadi', 'El Moudden', 'Zniber', 'Baraka', 'El Hassani', 'Drissi', 'El Fadili', 'Ghannam', 'Haddadi', 'Jaidi', 'Kadiri', 'Laabi', 'Moutawakil', 'Nabil'];
const nomsClassesDemo = ['TCSF-1', 'TCSF-2', 'TCSF-3'];
const NB_ELEVES_DEMO = 12;
const classesDemo = [];
let idEleveDemo = 1;
nomsClassesDemo.forEach((nomClasse, idx) => {
  const eleves = [];
  for (let i = 0; i < NB_ELEVES_DEMO; i++) {
    eleves.push({
      id: idEleveDemo++,
      nom: nomsDemo[(idx * 13 + i * 5) % nomsDemo.length],
      prenom: prenomsDemo[(idx * 7 + i) % prenomsDemo.length]
    });
  }
  classesDemo.push({ id: idx + 1, nom: nomClasse, eleves: eleves });
});

// ========== DEPOT — LA SEULE PORTE VERS LE STOCKAGE ==========
// Toutes les lectures et ecritures de donnees passent par ici : aucun `localStorage` ailleurs
// dans l'application (verifie par les tests). C'est CETTE porte qu'on remplacera par Supabase,
// sans toucher au reste du code : les modules continueront d'appeler Depot.lire/ecrire.
const Depot = {
  // valeur brute (chaine) ou `defaut` si absente / impossible a lire
  lire(cle, defaut) {
    try {
      const v = localStorage.getItem(cle);
      return v === null ? (defaut === undefined ? null : defaut) : v;
    } catch (e) { return defaut === undefined ? null : defaut; }
  },
  // objet ou tableau ; `defaut` si absent ou illisible (jamais d'exception)
  lireJSON(cle, defaut) {
    try {
      const v = localStorage.getItem(cle);
      if (v === null) return defaut;
      const obj = JSON.parse(v);
      return obj === null ? defaut : obj;
    } catch (e) { return defaut; }
  },
  ecrire(cle, valeur) {
    try { localStorage.setItem(cle, valeur); return true; }
    catch (e) { console.warn('Depot : ecriture impossible pour ' + cle, e); return false; }
  },
  ecrireJSON(cle, valeur) { return Depot.ecrire(cle, JSON.stringify(valeur)); },
  effacer(cle) { try { localStorage.removeItem(cle); } catch (e) {} },
  effacerTout() { try { localStorage.clear(); } catch (e) {} }     // « repartir du serveur »
};
// ========== CHARGEMENT DES CLASSES (persistees en localStorage) ==========
let classes = [];
let nextClasseId = 1;
let nextEleveId = 1;

const DEMO_VERSION = 'v3.0';

// Les donnees de DEMONSTRATION (classes + historique) ne se chargent QUE si on le demande :
//   - le telephone de l'utilisateur qui veut une demo : Depot.ecrire('modeDemonstration', '1') ;
//   - une ecole livree n'a AUCUNE donnee de test : elle commence vide et importe ses listes.
function modeDemonstration() { return Depot.lire('modeDemonstration', null) === '1'; }

function chargerClasses() {
  const sauve = Depot.lire('classes', null);
  const version = Depot.lire('absenceTrackVersion', null);
  if (sauve) {
    try {
      const liste = JSON.parse(sauve);
      if (Array.isArray(liste) && liste.length > 0) {
        // REGLE : ce qui est enregistre n'est JAMAIS perdu. On ne remplace l'enregistrement
        // que sur le telephone de demonstration, quand la demonstration elle-meme a change.
        if (!modeDemonstration() || version === DEMO_VERSION) {
          nextClasseId = liste.reduce((m, c) => Math.max(m, c.id), 0) + 1;
          nextEleveId = liste.reduce((m, c) => Math.max(m, c.eleves.reduce((mm, e) => Math.max(mm, e.id), 0)), 0) + 1;
          return liste;
        }
      }
    } catch (e) {}
  }
  // Rien a reprendre : ecole (on part VIDE) ou telephone de demonstration (on pose le jeu de test)
  if (!modeDemonstration()) return [];
  Depot.effacer('absences');
  const init = JSON.parse(JSON.stringify(classesDemo));
  nextClasseId = init.reduce((m, c) => Math.max(m, c.id), 0) + 1;
  nextEleveId = init.reduce((m, c) => Math.max(m, c.eleves.reduce((mm, e) => Math.max(mm, e.id), 0)), 0) + 1;
  sauvegarderClasses(init);
  return init;
}

function sauvegarderClasses(liste) {
  Depot.ecrireJSON('classes', liste || classes);
  Depot.ecrire('absenceTrackVersion', DEMO_VERSION);
}

classes = chargerClasses();

// ========== TABLEAUX DE SERVICE (emploi du temps des enseignants) ==========
// jour : 1 = lundi ... 6 = samedi ; creneaux dans 08:00-12:00 et 14:00-18:00
// Une seance de 2 h (PC, SVT) = un creneau avec debut/fin plus large.
// Regle : la somme des heures d'un enseignant ne doit pas depasser 20 h.
const TABLEAUX_SERVICE_DEFAUT = {
  'math-prof1@taalim.ma': [
    { jour: 1, debut: '15:00', fin: '17:00', classe: 'TCSF-1', matiere: 'Maths', prof: 'math-prof1' },
    { jour: 2, debut: '14:00', fin: '16:00', classe: 'TCSF-3', matiere: 'Maths', prof: 'math-prof1' },
    { jour: 2, debut: '17:00', fin: '18:00', classe: 'TCSF-1', matiere: 'Maths', prof: 'math-prof1' },
    { jour: 3, debut: '14:00', fin: '16:00', classe: 'TCSF-2', matiere: 'Maths', prof: 'math-prof1' },
    { jour: 3, debut: '17:00', fin: '18:00', classe: 'TCSF-3', matiere: 'Maths', prof: 'math-prof1' },
    { jour: 4, debut: '08:00', fin: '10:00', classe: 'TCSF-3', matiere: 'Maths', prof: 'math-prof1' },
    { jour: 4, debut: '10:00', fin: '12:00', classe: 'TCSF-2', matiere: 'Maths', prof: 'math-prof1' },
    { jour: 5, debut: '15:00', fin: '16:00', classe: 'TCSF-2', matiere: 'Maths', prof: 'math-prof1' },
    { jour: 5, debut: '16:00', fin: '18:00', classe: 'TCSF-1', matiere: 'Maths', prof: 'math-prof1' },
  ],
  'pc-prof1@taalim.ma': [
    { jour: 1, debut: '10:00', fin: '12:00', classe: 'TCSF-2', matiere: 'PC', prof: 'pc-prof1' },
    { jour: 2, debut: '08:00', fin: '10:00', classe: 'TCSF-1', matiere: 'PC', prof: 'pc-prof1' },
    { jour: 2, debut: '10:00', fin: '12:00', classe: 'TCSF-2', matiere: 'PC', prof: 'pc-prof1' },
    { jour: 3, debut: '15:00', fin: '17:00', classe: 'TCSF-3', matiere: 'PC', prof: 'pc-prof1' },
    { jour: 4, debut: '14:00', fin: '16:00', classe: 'TCSF-3', matiere: 'PC', prof: 'pc-prof1' },
    { jour: 5, debut: '10:00', fin: '12:00', classe: 'TCSF-1', matiere: 'PC', prof: 'pc-prof1' },
  ],
  'svt-prof1@taalim.ma': [
    { jour: 1, debut: '08:00', fin: '10:00', classe: 'TCSF-1', matiere: 'SVT', prof: 'svt-prof1' },
    { jour: 2, debut: '08:00', fin: '10:00', classe: 'TCSF-3', matiere: 'SVT', prof: 'svt-prof1' },
    { jour: 3, debut: '10:00', fin: '12:00', classe: 'TCSF-2', matiere: 'SVT', prof: 'svt-prof1' },
    { jour: 4, debut: '14:00', fin: '16:00', classe: 'TCSF-1', matiere: 'SVT', prof: 'svt-prof1' },
    { jour: 4, debut: '16:00', fin: '18:00', classe: 'TCSF-3', matiere: 'SVT', prof: 'svt-prof1' },
    { jour: 5, debut: '09:00', fin: '11:00', classe: 'TCSF-2', matiere: 'SVT', prof: 'svt-prof1' },
  ],
  'fr-prof1@taalim.ma': [
    { jour: 1, debut: '16:00', fin: '18:00', classe: 'TCSF-3', matiere: 'Français', prof: 'fr-prof1' },
    { jour: 2, debut: '10:00', fin: '12:00', classe: 'TCSF-1', matiere: 'Français', prof: 'fr-prof1' },
    { jour: 3, debut: '08:00', fin: '10:00', classe: 'TCSF-2', matiere: 'Français', prof: 'fr-prof1' },
    { jour: 3, debut: '10:00', fin: '12:00', classe: 'TCSF-3', matiere: 'Français', prof: 'fr-prof1' },
    { jour: 4, debut: '16:00', fin: '18:00', classe: 'TCSF-2', matiere: 'Français', prof: 'fr-prof1' },
    { jour: 5, debut: '08:00', fin: '10:00', classe: 'TCSF-1', matiere: 'Français', prof: 'fr-prof1' },
  ],
  'ang-prof1@taalim.ma': [
    { jour: 1, debut: '15:00', fin: '17:00', classe: 'TCSF-2', matiere: 'Anglais', prof: 'ang-prof1' },
    { jour: 2, debut: '14:00', fin: '16:00', classe: 'TCSF-1', matiere: 'Anglais', prof: 'ang-prof1' },
    { jour: 3, debut: '08:00', fin: '09:00', classe: 'TCSF-3', matiere: 'Anglais', prof: 'ang-prof1' },
    { jour: 4, debut: '08:00', fin: '09:00', classe: 'TCSF-1', matiere: 'Anglais', prof: 'ang-prof1' },
    { jour: 5, debut: '08:00', fin: '09:00', classe: 'TCSF-2', matiere: 'Anglais', prof: 'ang-prof1' },
    { jour: 5, debut: '10:00', fin: '12:00', classe: 'TCSF-3', matiere: 'Anglais', prof: 'ang-prof1' },
  ],
  'ar-prof1@taalim.ma': [
    { jour: 1, debut: '09:00', fin: '11:00', classe: 'TCSF-3', matiere: 'Arabe', prof: 'ar-prof1' },
    { jour: 3, debut: '08:00', fin: '10:00', classe: 'TCSF-1', matiere: 'Arabe', prof: 'ar-prof1' },
    { jour: 5, debut: '16:00', fin: '18:00', classe: 'TCSF-2', matiere: 'Arabe', prof: 'ar-prof1' },
  ],
  'eps-prof1@taalim.ma': [
    { jour: 1, debut: '08:00', fin: '10:00', classe: 'TCSF-2', matiere: 'EPS', prof: 'eps-prof1' },
    { jour: 4, debut: '16:00', fin: '18:00', classe: 'TCSF-1', matiere: 'EPS', prof: 'eps-prof1' },
    { jour: 5, debut: '16:00', fin: '18:00', classe: 'TCSF-3', matiere: 'EPS', prof: 'eps-prof1' },
  ],
  'info-prof1@taalim.ma': [
    { jour: 1, debut: '10:00', fin: '12:00', classe: 'TCSF-1', matiere: 'Informatique', prof: 'info-prof1' },
    { jour: 2, debut: '16:00', fin: '18:00', classe: 'TCSF-3', matiere: 'Informatique', prof: 'info-prof1' },
    { jour: 4, debut: '08:00', fin: '10:00', classe: 'TCSF-2', matiere: 'Informatique', prof: 'info-prof1' },
  ],
  'philo-prof1@taalim.ma': [
    { jour: 2, debut: '14:00', fin: '16:00', classe: 'TCSF-2', matiere: 'Philo', prof: 'philo-prof1' },
    { jour: 4, debut: '09:00', fin: '11:00', classe: 'TCSF-1', matiere: 'Philo', prof: 'philo-prof1' },
    { jour: 5, debut: '08:00', fin: '10:00', classe: 'TCSF-3', matiere: 'Philo', prof: 'philo-prof1' },
  ],
  'ei-prof1@taalim.ma': [
    { jour: 1, debut: '14:00', fin: '16:00', classe: 'TCSF-3', matiere: 'Educ. islamique', prof: 'ei-prof1' },
    { jour: 3, debut: '14:00', fin: '16:00', classe: 'TCSF-1', matiere: 'Educ. islamique', prof: 'ei-prof1' },
    { jour: 4, debut: '14:00', fin: '16:00', classe: 'TCSF-2', matiere: 'Educ. islamique', prof: 'ei-prof1' },
  ],
  'hg-prof1@taalim.ma': [
    { jour: 2, debut: '16:00', fin: '18:00', classe: 'TCSF-2', matiere: 'Hist-Géo', prof: 'hg-prof1' },
    { jour: 3, debut: '10:00', fin: '12:00', classe: 'TCSF-1', matiere: 'Hist-Géo', prof: 'hg-prof1' },
    { jour: 4, debut: '10:00', fin: '12:00', classe: 'TCSF-3', matiere: 'Hist-Géo', prof: 'hg-prof1' },
  ]
};


// Tableaux de service : persistants (import xlsx) avec les donnees de demo comme defaut
function chargerTableauxService() {
  try {
    const sauve = Depot.lireJSON('tableauxService_v2', null);
    if (sauve && typeof sauve === 'object' && !Array.isArray(sauve)) return sauve;
  } catch (e) {}
  // Le telephone de demonstration recoit les tableaux de test ; une ECOLE commence VIDE.
  if (!modeDemonstration()) return {};
  return JSON.parse(JSON.stringify(TABLEAUX_SERVICE_DEFAUT));
}
function sauvegarderTableauxService() {
  Depot.ecrireJSON('tableauxService_v2', tableauxService);
}

const NOMS_JOURS = { 1: 'lundi', 2: 'mardi', 3: 'mercredi', 4: 'jeudi', 5: 'vendredi', 6: 'samedi', 7: 'dimanche' };
let tableauxService = chargerTableauxService();
const CLASSES_TABLEAUX_SERVICE = ['TCSF-1', 'TCSF-2', 'TCSF-3'];
const NB_ELEVES_CLASSE_SERVICE = 12;

// Ajout des classes des tableaux de service : jamais destructif, on saute celles qui existent
function ajouterClassesTableauxService() {
  if (!modeDemonstration()) return 0;      // aucune classe de demonstration dans une ecole
  let ajoutees = 0;
  // classes citees dans les tableaux + liste de test
  const aCreer = CLASSES_TABLEAUX_SERVICE.slice();
  Object.keys(tableauxService).forEach(mail => {
    tableauxService[mail].forEach(c => { if (aCreer.indexOf(c.classe) < 0) aCreer.push(c.classe); });
  });
  aCreer.forEach(nom => {
    if (classes.some(c => c.nom === nom)) return;
    const eleves = [];
    for (let i = 0; i < NB_ELEVES_CLASSE_SERVICE; i++) {
      eleves.push({
        id: nextEleveId++,
        nom: nomsDemo[(i * 7 + nom.length) % nomsDemo.length],
        prenom: prenomsDemo[(i * 3 + nom.length) % prenomsDemo.length],
        massar: 'M' + String(nextEleveId).padStart(5, '0')
      });
    }
    classes.push({ id: nextClasseId++, nom: nom, eleves: eleves });
    ajoutees++;
  });
  if (ajoutees > 0) sauvegarderClasses();
  return ajoutees;
}

// ===== Outils horaires des tableaux de service =====
function hhmmEnMinutes(h) {
  const p = String(h || '0:0').split(':');
  return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
}
function jourSemaineCourant() {
  const j = new Date().getDay();
  return j === 0 ? 7 : j;
}
function emailUtilisateur() {
  return utilisateurConnecte ? String(utilisateurConnecte.email || '') : '';
}
// Rapprochement des matieres (arabe / francais / abreviations)
function normaliserMatiere(m) {
  const t = String(m || '').toLowerCase();
  if (t.indexOf('رياض') >= 0 || t.indexOf('math') >= 0) return 'math';
  if (t.indexOf('عربية') >= 0 || t.indexOf('arabe') >= 0) return 'ar';
  if (t.indexOf('فرنس') >= 0 || t.indexOf('fran') >= 0) return 'fr';
  if (t.indexOf('انجليز') >= 0 || t.indexOf('anglais') >= 0 || t.indexOf('angl') >= 0) return 'en';
  if (t === 'pc' || t.indexOf('فيزي') >= 0 || t.indexOf('physique') >= 0 || t.indexOf('chimie') >= 0) return 'pc';
  if (t.indexOf('حياة') >= 0 || t.indexOf('svt') >= 0 || t.indexOf('science') >= 0) return 'svt';
  if (t.indexOf('فلسف') >= 0 || t.indexOf('philo') >= 0) return 'philo';
  if (t === 'hg' || t.indexOf('تاريخ') >= 0 || t.indexOf('جغراف') >= 0 || t.indexOf('histoire') >= 0 || t.indexOf('géo') >= 0) return 'hg';
  if (t.indexOf('اسلام') >= 0 || t.indexOf('إسلام') >= 0 || t.indexOf('islam') >= 0) return 'ei';
  if (t.indexOf('بدنية') >= 0 || t.indexOf('sport') >= 0 || t.indexOf('eps') >= 0) return 'eps';
  if (t.indexOf('معلوم') >= 0 || t.indexOf('inform') >= 0) return 'info';
  return t.slice(0, 14);
}
// Email du compte enseignant dont la matiere correspond (pour relier un tableau importe)
function emailPourMatiere(m) {
  const cle = normaliserMatiere(m);
  const c = comptes.find(x => x.role === 'enseignant' && normaliserMatiere(x.matiere) === cle);
  return c ? c.email : '';
}
// Creneaux d'un utilisateur : par email, sinon par son nom, sinon par sa matiere
function creneauxUtilisateur(email) {
  if (tableauxService[email]) return tableauxService[email];
  const c = comptes.find(x => x.email === email);
  if (c) {
    if (tableauxService[c.nom]) return tableauxService[c.nom];
    const em = emailPourMatiere(c.matiere);
    if (em && tableauxService[em]) return tableauxService[em];
  }
  return [];
}

function creneauxDuJour(email, jour) {
  const liste = creneauxUtilisateur(email);
  return liste.filter(c => c.jour === (jour || jourSemaineCourant()))
              .sort((a, b) => hhmmEnMinutes(a.debut) - hhmmEnMinutes(b.debut));
}
function creneauxEnCours(email) {
  const m = new Date().getHours() * 60 + new Date().getMinutes();
  return creneauxDuJour(email).filter(c => m >= hhmmEnMinutes(c.debut) && m < hhmmEnMinutes(c.fin));
}
function heuresServiceMinutes(email) {
  return creneauxUtilisateur(email).reduce((som, c) => som + (hhmmEnMinutes(c.fin) - hhmmEnMinutes(c.debut)), 0);
}
function formatDureeService(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h + ' h' + (m ? ' ' + m : '');
}
// Date du prochain creneau d'un enseignant (aujourd'hui si possible, sinon les jours suivants)
function dateProchainCreneau(email) {
  const jour = jourSemaineCourant();
  const m = new Date().getHours() * 60 + new Date().getMinutes();
  if (creneauxDuJour(email, jour).some(c => hhmmEnMinutes(c.debut) > m)) return fmtDateISO(new Date());
  for (let i = 1; i <= 7; i++) {
    const j = ((jour - 1 + i) % 7) + 1;
    const d = new Date();
    d.setDate(d.getDate() + i);
    if (creneauxDuJour(email, j).length > 0) return fmtDateISO(d);
  }
  return fmtDateISO(new Date());
}

function prochainCreneau(email) {
  const jour = jourSemaineCourant();
  const m = new Date().getHours() * 60 + new Date().getMinutes();
  const reste = creneauxDuJour(email, jour).filter(c => hhmmEnMinutes(c.debut) > m);
  if (reste.length) return { quand: "aujourd'hui", creneau: reste[0] };
  for (let d = jour + 1; d <= 7; d++) {
    const l = creneauxDuJour(email, d);
    if (l.length) return { quand: NOMS_JOURS[d], creneau: l[0] };
  }
  for (let d = 1; d < jour; d++) {
    const l = creneauxDuJour(email, d);
    if (l.length) return { quand: NOMS_JOURS[d], creneau: l[0] };
  }
  return null;
}

// ===== Application au Dashboard enseignant =====
function afficherReposEnseignant() {
  const bloc = document.getElementById('ens-repos');
  if (!bloc) return;
  bloc.classList.remove('hidden');
  const email = emailUtilisateur();
  const prochain = prochainCreneau(email);
  const elProchain = document.getElementById('ens-repos-prochain');
  if (elProchain) {
    if (!prochain) {
      elProchain.textContent = 'Aucun cours programmé';
    } else {
      const raison = raisonAnnulation(dateProchainCreneau(email), prochain.creneau.classe, prochain.creneau.debut);
      elProchain.textContent = (raison ? 'Prochain cours annulé : ' : 'Prochain cours : ') +
        prochain.quand + ' à ' + prochain.creneau.debut + ' · ' + prochain.creneau.classe +
        (raison ? ' — ' + raison.motif : '');
    }
  }
}

// ===== Tableau de service de la semaine (page Profil) =====
// Meme presentation que l'ancienne liste du Dashboard : classe a gauche, horaire a droite,
// regroupee par jour. Masque pour les roles sans tableau de service.
function afficherTableauServiceProfil() {
  const carte = document.getElementById('profil-service-card');
  if (!carte) return;
  const estProf = utilisateurConnecte && utilisateurConnecte.role === 'enseignant';
  const email = emailUtilisateur();
  const creneaux = estProf ? creneauxUtilisateur(email) : [];
  if (creneaux.length === 0) { carte.style.display = 'none'; return; }
  carte.style.display = 'block';
  const entete = document.getElementById('profil-service-entete');
  if (entete) entete.textContent = '(' + formatDureeService(heuresServiceMinutes(email)) + ')';
  const cont = document.getElementById('profil-service-creneaux');
  if (!cont) return;
  cont.innerHTML = '';
  for (let d = 1; d <= 7; d++) {
    const liste = creneaux.filter(c => c.jour === d).sort((a, b) => hhmmEnMinutes(a.debut) - hhmmEnMinutes(b.debut));
    if (liste.length === 0) continue;
    const titre = document.createElement('div');
    titre.className = 'text-xs font-bold text-gray-500 mt-3 mb-1';
    titre.textContent = NOMS_JOURS[d].charAt(0).toUpperCase() + NOMS_JOURS[d].slice(1);
    cont.appendChild(titre);
    liste.forEach(c => {
      const item = document.createElement('div');
      item.className = 'flex justify-between items-center px-3 py-1.5 bg-gray-50 rounded-lg';
      item.innerHTML = '<span class="font-medium text-gray-700">' + c.classe + '</span>' +
        '<span class="text-sm text-gray-500">' + c.debut + '–' + c.fin + (c.salle ? ' · ' + c.salle : '') + '</span>';
      cont.appendChild(item);
    });
  }
}

// Le tableau de service pilote le Dashboard : une seule classe (celle du creneau), rien en repos
function appliquerTableauService() {
  const select = document.getElementById('select-classe');
  if (!select) return;
  const zone = document.getElementById('zone-prise-absence');
  const repos = document.getElementById('ens-repos');
  const estProf = utilisateurConnecte && utilisateurConnecte.role === 'enseignant';
  const aTableau = estProf && creneauxUtilisateur(emailUtilisateur()).length > 0;

  // Pas de tableau de service : comportement classique (choix libre de la classe)
  if (!aTableau) {
    select.disabled = false;
    if (repos) repos.classList.add('hidden');
    return;
  }

  const enCours = creneauxEnCours(emailUtilisateur());
  select.disabled = true;   // bloque pour le moment (la div de selection est conservee)
  const blocAnnulee = document.getElementById('ens-annulee');
  if (blocAnnulee) blocAnnulee.classList.add('hidden');

  // Seance annulee par la vie scolaire : aucune saisie possible
  const raison = enCours.length > 0 ? raisonAnnulation(fmtDateISO(new Date()), enCours[0].classe, enCours[0].debut) : null;
  if (raison) {
    if (repos) repos.classList.add('hidden');
    classeSelectionnee = null;
    elevesCoches.clear();
    decochesManuellement.clear();
    if (zone) zone.classList.add('hidden');
    select.innerHTML = '<option value="">— Séance annulée —</option>';
    select.value = '';
    const listeAnnulee = document.getElementById('liste-eleves-enseignant');
    if (listeAnnulee) listeAnnulee.innerHTML = '';
    if (typeof mettreAJourEnteteListe === 'function') mettreAJourEnteteListe();
    if (blocAnnulee) {
      blocAnnulee.classList.remove('hidden');
      const det = document.getElementById('ens-annulee-detail');
      if (det) det.textContent = enCours[0].classe + ' · ' + enCours[0].debut + '–' + enCours[0].fin +
        ' — ' + raison.motif + (raison.par ? ' (par ' + raison.par + ')' : '');
    }
    return;
  }

  if (enCours.length > 0) {
    if (repos) repos.classList.add('hidden');
    select.innerHTML = '';
    enCours.forEach(c => {
      const cl = classes.find(x => x.nom === c.classe);
      if (!cl) return;
      const opt = document.createElement('option');
      opt.value = cl.id;
      opt.textContent = c.classe + ' · ' + c.debut + '–' + c.fin + (c.salle ? ' · ' + c.salle : '');
      select.appendChild(opt);
    });
    const cible = classes.find(x => x.nom === enCours[0].classe);
    if (cible) {
      if (!classeSelectionnee || classeSelectionnee.id !== cible.id) {
        choisirClasse(cible.id);
      } else {
        if (zone) zone.classList.remove('hidden');
        afficherListeEleves();
      }
    }
    return;
  }

  // En repos : aucune classe, aucune zone de saisie
  classeSelectionnee = null;
  elevesCoches.clear();
  decochesManuellement.clear();
  select.innerHTML = '<option value="">— Aucune séance en cours —</option>';
  select.value = '';
  if (zone) zone.classList.add('hidden');
  const liste = document.getElementById('liste-eleves-enseignant');
  if (liste) liste.innerHTML = '';
  if (typeof mettreAJourEnteteListe === 'function') mettreAJourEnteteListe();
  afficherReposEnseignant();
}

// Suivi de l'heure : on reevalue le creneau en cours toutes les minutes
setInterval(function () {
  if (!utilisateurConnecte || utilisateurConnecte.role !== 'enseignant') return;
  const page = document.getElementById('page-enseignant');
  if (page && page.classList.contains('active')) appliquerTableauService();
}, 60000);

// Classes des tableaux de service (ajout non destructif)
ajouterClassesTableauxService();

// ========== COMPTES UTILISATEURS ==========
// Professeurs reels (tableau des professeurs du PDF) : code = {matiere}-prof{x}
const comptes = [
  { email: "math-prof1@taalim.ma",  password: "12345", role: "enseignant", code: "math-prof1",  matiere: "Maths",           nom: "أيوب الكمرة" },
  { email: "pc-prof1@taalim.ma",    password: "12345", role: "enseignant", code: "pc-prof1",    matiere: "PC",              nom: "غزالي صالح" },
  { email: "svt-prof1@taalim.ma",   password: "12345", role: "enseignant", code: "svt-prof1",   matiere: "SVT",             nom: "كمال الوردي" },
  { email: "fr-prof1@taalim.ma",    password: "12345", role: "enseignant", code: "fr-prof1",    matiere: "Français",        nom: "سامية الحاضي" },
  { email: "ang-prof1@taalim.ma",   password: "12345", role: "enseignant", code: "ang-prof1",   matiere: "Anglais",         nom: "هشام أجامي" },
  { email: "ar-prof1@taalim.ma",    password: "12345", role: "enseignant", code: "ar-prof1",    matiere: "Arabe",           nom: "المهدي الصلحي" },
  { email: "eps-prof1@taalim.ma",   password: "12345", role: "enseignant", code: "eps-prof1",   matiere: "EPS",             nom: "يسرى البوسعيدي" },
  { email: "info-prof1@taalim.ma",  password: "12345", role: "enseignant", code: "info-prof1",  matiere: "Informatique",    nom: "سكينة الرازي" },
  { email: "philo-prof1@taalim.ma", password: "12345", role: "enseignant", code: "philo-prof1", matiere: "Philo",           nom: "زكية المندريلي" },
  { email: "ei-prof1@taalim.ma",    password: "12345", role: "enseignant", code: "ei-prof1",    matiere: "Educ. islamique", nom: "محمد خليفي" },
  { email: "hg-prof1@taalim.ma",    password: "12345", role: "enseignant", code: "hg-prof1",    matiere: "Hist-Géo",        nom: "ياسين القامة" },
  { email: "s1@taalim.ma", password: "12345", role: "surveillant", nom: "Surveillant 1" },
  { email: "s2@taalim.ma", password: "12345", role: "surveillant", nom: "Surveillant 2" },
  { email: "d@taalim.ma",  password: "12345", role: "directeur",   nom: "Directeur" }
];

// ========== ETABLISSEMENT & ANNEE SCOLAIRE ==========
const ETABLISSEMENT_DEFAUT = { code: '', nom: '', academie: '', direction: '' };
const ANNEE_SCOLAIRE_DEFAUT = {
  libelle: '2026-2027',
  semestres: [
    { nom: '1', debut: '2026-09-01', fin: '2027-01-15' },
    { nom: '2', debut: '2027-02-01', fin: '2027-05-15' }
  ]
};
// ========== ACADEMIES REGIONALES & DIRECTIONS PROVINCIALES ==========
const ACADEMIES = [
  { nom: 'Tanger-Tétouan-Al Hoceïma', directions: ['Tanger-Assilah', "M'diq-Fnideq", 'Tétouan', 'Fahs-Anjra', 'Larache', 'Chefchaouen', 'Ouazzane', 'Al Hoceïma'] },
  { nom: "L'Oriental", directions: ['Oujda-Angad', 'Nador', 'Berkane', 'Taourirt', 'Jerada', 'Driouch', 'Guercif', 'Figuig'] },
  { nom: 'Fès-Meknès', directions: ['Fès', 'Meknès', 'El Hajeb', 'Ifrane', 'Moulay Yacoub', 'Sefrou', 'Boulemane', 'Taounate', 'Taza'] },
  { nom: 'Rabat-Salé-Kénitra', directions: ['Rabat', 'Salé', 'Skhirate-Témara', 'Kénitra', 'Khémisset', 'Sidi Kacem', 'Sidi Slimane'] },
  { nom: 'Béni Mellal-Khénifra', directions: ['Béni Mellal', 'Azilal', 'Fquih Ben Salah', 'Khénifra', 'Khouribga'] },
  { nom: 'Grand Casablanca-Settat', directions: ['Casablanca-Anfa', 'Al Fida-Mers Sultan', 'Aïn Sebaâ-Hay Mohammadi', 'Hay Hassani', 'Aïn Chock', 'Sidi Bernoussi', "Ben M'sick", 'Moulay Rachid', 'Mohammedia', 'Nouaceur', 'Médiouna', 'Settat', 'Berrechid', 'El Jadida', 'Sidi Bennour'] },
  { nom: 'Marrakech-Safi', directions: ['Marrakech', 'Chichaoua', 'Al Haouz', 'El Kelâa des Sraghna', 'Essaouira', 'Rehamna', 'Safi', 'Youssoufia'] },
  { nom: 'Drâa-Tafilalet', directions: ['Errachidia', 'Ouarzazate', 'Midelt', 'Tinghir', 'Zagora'] },
  { nom: 'Souss-Massa', directions: ['Agadir-Ida Ou Tanane', 'Inezgane-Aït Melloul', 'Chtouka-Aït Baha', 'Taroudannt', 'Tiznit', 'Tata'] },
  { nom: 'Guelmim-Oued Noun', directions: ['Guelmim', 'Assa-Zag', 'Tan-Tan', 'Sidi Ifni'] },
  { nom: 'Laâyoune-Sakia El Hamra', directions: ['Laâyoune', 'Boujdour', 'Tarfaya', 'Es-Semara'] },
  { nom: 'Dakhla-Oued Ed-Dahab', directions: ['Oued Ed-Dahab', 'Aousserd'] }
];
const ANNEES_SCOLAIRES = ['2024-2025', '2025-2026', '2026-2027', '2027-2028', '2028-2029'];
function directionsAcademie(nom) {
  const a = ACADEMIES.find(x => x.nom === String(nom || ''));
  return a ? a.directions.slice() : [];
}
function remplirOptionSelect(select, valeurs, valeurCourante, placeholder) {
  if (!select) return;
  select.innerHTML = '';
  if (placeholder) {
    const o = document.createElement('option');
    o.value = '';
    o.textContent = placeholder;
    select.appendChild(o);
  }
  valeurs.forEach(v => {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = v;
    select.appendChild(o);
  });
  if (valeurCourante && valeurs.indexOf(valeurCourante) >= 0) select.value = valeurCourante;
}
// La direction provinciale depend de l'academie choisie
function changerAcademie() {
  const selAca = document.getElementById('etab-academie');
  const selDir = document.getElementById('etab-direction');
  if (!selAca || !selDir) return;
  const dirs = directionsAcademie(selAca.value);
  const ancienne = selDir.value;
  remplirOptionSelect(selDir, dirs, dirs.indexOf(ancienne) >= 0 ? ancienne : '', dirs.length === 0 ? '— Choisir une académie —' : '');
}

function chargerParametres(cle, defaut) {
  const base = JSON.parse(JSON.stringify(defaut));
  try {
    const brut = Depot.lire(cle, null);
    if (!brut) return base;
    const obj = JSON.parse(brut);
    return Object.assign(base, (obj && typeof obj === 'object') ? obj : {});
  } catch (e) { return base; }
}
let etablissement = chargerParametres('etablissement', ETABLISSEMENT_DEFAUT);
let anneeScolaire = chargerParametres('anneeScolaire', ANNEE_SCOLAIRE_DEFAUT);
if (!Array.isArray(anneeScolaire.semestres) || anneeScolaire.semestres.length < 2) {
  anneeScolaire.semestres = JSON.parse(JSON.stringify(ANNEE_SCOLAIRE_DEFAUT.semestres));
}
// Les libelles ne sont plus saisis : "S1"/"S2" (anciens enregistrements) -> "1"/"2"
anneeScolaire.semestres.forEach((sem, i) => {
  const n = String(sem.nom || '').replace(/^s(?:emestre)?\s*/i, '').trim();
  sem.nom = (n === '1' || n === '2') ? n : String(i + 1);
});
function sauvegarderParametres() {
  Depot.ecrireJSON('etablissement', etablissement);
  Depot.ecrireJSON('anneeScolaire', anneeScolaire);
}
// Semestre auquel appartient une date (ou null hors semestres)
function semestreDeDate(dateISO) {
  const d = String(dateISO || '');
  if (d.length < 10) return null;
  return anneeScolaire.semestres.find(s => s.debut && s.fin && d >= s.debut && d <= s.fin) || null;
}
function semestreCourant() { return semestreDeDate(fmtDateISO(new Date())); }
function libelleEtablissement() {
  const e = etablissement || {};
  return e.nom || e.code || 'Établissement';
}
function libelleAnneeScolaire() {
  const s = semestreCourant();
  return 'Année ' + (anneeScolaire.libelle || '—') + (s ? ' · Semestre ' + s.nom : '');
}
function majEtiquetteAnnee() {
  const elLogin = document.getElementById('login-annee');
  if (elLogin) elLogin.textContent = libelleEtablissement() + ' — ' + libelleAnneeScolaire();
}
// Etiquettes des options Semestre 1 / 2 / annee dans les filtres de periode
function majOptionsSemestres() {
  const remplir = sel => {
    if (!sel) return;
    anneeScolaire.semestres.forEach((sem, i) => {
      const opt = sel.querySelector('option[value="s' + (i + 1) + '"]');
      if (opt) opt.textContent = 'Semestre ' + (sem.nom || (i + 1)) + ' (' + dateAffichage(sem.debut) + ' → ' + dateAffichage(sem.fin) + ')';
    });
    const optAn = sel.querySelector('option[value="annee"]');
    if (optAn) optAn.textContent = 'Année scolaire ' + (anneeScolaire.libelle || '');
  };
  remplir(document.getElementById('stats-periode'));
  remplir(document.getElementById('dir-stats-periode'));
}
function afficherParametres() {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  set('etab-code', etablissement.code);
  set('etab-nom', etablissement.nom);
  // Academies (liste) puis directions de l'academie choisie (liste dependante)
  remplirOptionSelect(document.getElementById('etab-academie'), ACADEMIES.map(a => a.nom), etablissement.academie, '— Choisir —');
  changerAcademie();
  const selDir = document.getElementById('etab-direction');
  if (selDir && etablissement.direction && directionsAcademie(etablissement.academie).indexOf(etablissement.direction) >= 0) {
    selDir.value = etablissement.direction;
  }
  // Annee scolaire (liste) : on garde toujours la valeur enregistree dans la liste
  const annees = ANNEES_SCOLAIRES.slice();
  if (anneeScolaire.libelle && annees.indexOf(anneeScolaire.libelle) < 0) annees.push(anneeScolaire.libelle);
  remplirOptionSelect(document.getElementById('annee-libelle'), annees, anneeScolaire.libelle, '');
  anneeScolaire.semestres.forEach((sem, i) => {
    set('sem' + (i + 1) + '-debut', sem.debut);
    set('sem' + (i + 1) + '-fin', sem.fin);
  });
  majEtiquetteAnnee();
  majOptionsSemestres();
}
function enregistrerParametres() {
  const val = id => { const el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; };
  etablissement = { code: val('etab-code'), nom: val('etab-nom'), academie: val('etab-academie'), direction: val('etab-direction') };
  anneeScolaire = {
    libelle: val('annee-libelle') || ANNEE_SCOLAIRE_DEFAUT.libelle,
    semestres: [
      { nom: (anneeScolaire.semestres[0] || {}).nom || '1', debut: val('sem1-debut'), fin: val('sem1-fin') },
      { nom: (anneeScolaire.semestres[1] || {}).nom || '2', debut: val('sem2-debut'), fin: val('sem2-fin') }
    ]
  };
  sauvegarderParametres();
  afficherParametres();
  afficherToast('Paramètres enregistrés', 'modif');
}

// ========== NOMS DES PROFESSEURS (corrigeables par le directeur) ==========
function chargerNomsProfs() {
  try {
    const brut = Depot.lire('nomsProfs', null);
    const obj = brut ? JSON.parse(brut) : {};
    return (obj && typeof obj === 'object') ? obj : {};
  } catch (e) { return {}; }
}
let nomsProfs = chargerNomsProfs();
function sauvegarderNomsProfs() { Depot.ecrireJSON('nomsProfs', nomsProfs); }
function appliquerNomsProfs() {
  comptes.forEach(c => {
    const cle = c.code || c.email;
    if (cle && nomsProfs[cle]) c.nom = nomsProfs[cle];
  });
}
// Mots de passe modifies ou generes : persistes par email (avant, le changement etait perdu au rechargement)
function chargerMotsDePasse() {
  try {
    const brut = Depot.lire('motsDePasse', null);
    const obj = brut ? JSON.parse(brut) : {};
    return (obj && typeof obj === 'object') ? obj : {};
  } catch (e) { return {}; }
}
let motsDePasse = chargerMotsDePasse();
function sauvegarderMotsDePasse() { Depot.ecrireJSON('motsDePasse', motsDePasse); }
function appliquerMotsDePasse() {
  comptes.forEach(c => { if (motsDePasse[c.email]) c.password = motsDePasse[c.email]; });
}
// Mot de passe aleatoire valide (lettres + chiffres, sans caracteres speciaux)
function genererMotDePasse(longueur) {
  const n = longueur || 8;
  const lettres = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';
  const chiffres = '23456789';
  const tous = lettres + chiffres;
  const tirer = t => t[Math.floor(Math.random() * t.length)];
  let mdp = tirer(lettres) + tirer(chiffres);
  while (mdp.length < n) mdp += tirer(tous);
  return mdp.split('').sort(() => Math.random() - 0.5).join('');
}
function genererMotDePasseProf() {
  const champ = document.getElementById('renommer-mdp');
  if (!champ) return;
  champ.value = genererMotDePasse(8);
  const suc = document.getElementById('renommer-success');
  if (suc) suc.classList.add('hidden');
}

// ========== FERMETURES DE L'ETABLISSEMENT & INDISPONIBILITES DES PROFS ==========
function chargerListe(cle) {
  try {
    const brut = Depot.lire(cle, null);
    const liste = brut ? JSON.parse(brut) : [];
    return Array.isArray(liste) ? liste : [];
  } catch (e) { return []; }
}
// Fermeture : { id, dateISO, libelle, type, debut, fin, portee, par, le, profCode }
let fermeturesEtab = chargerListe('fermeturesEtab');
let indispoProfs = chargerListe('indispoProfs');
function sauvegarderFermetures() { Depot.ecrireJSON('fermeturesEtab', fermeturesEtab); }
function sauvegarderIndispo() { Depot.ecrireJSON('indispoProfs', indispoProfs); }
function bornesAnneeScolaire() {
  const s1 = anneeScolaire.semestres[0] || {};
  const s2 = anneeScolaire.semestres[1] || {};
  return { debut: s1.debut || '2000-01-01', fin: s2.fin || '2100-12-31' };
}
// Bornes de l'annee scolaire sur tous les champs de date concernes
function bornerDatesAnnee() {
  const b = bornesAnneeScolaire();
  ['annul-date', 'indispo-debut', 'indispo-fin', 'abs-surv-debut', 'abs-surv-fin', 'ferm-debut', 'ferm-fin'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.min = b.debut;
    el.max = b.fin;
  });
}
// Portee : 'journee' (defaut) | 'matin' | 'apres-midi'
function porteeCorrespond(portee, heure) {
  if (!portee || portee === 'journee') return true;
  const matin = hhmmEnMinutes(heure) < 12 * 60;
  return portee === 'matin' ? matin : !matin;
}
function libellePortee(portee) {
  return portee === 'matin' ? 'matin' : (portee === 'apres-midi' ? 'après-midi' : 'toute la journée');
}
function dansPeriode(entree, dateISO) {
  if (!entree || !entree.debut || !dateISO) return false;
  return dateISO >= entree.debut && dateISO <= (entree.fin || entree.debut);
}
function nomProfCode(code) {
  const c = comptes.find(x => x.code === code);
  return c ? c.nom : (code || '');
}
// Creneau reel d'une classe qui couvre une heure donnee
function creneauDeHeure(classe, jour, heure) {
  const m = hhmmEnMinutes(heure);
  return creneauxClasseJour(classe, jour).find(c => m >= hhmmEnMinutes(c.debut) && m < hhmmEnMinutes(c.fin)) || null;
}

// ========== ANNULATION DE SEANCE (directeur + surveillant) ==========
function chargerSeancesAnnulees() {
  try {
    const brut = Depot.lire('seancesAnnulees', null);
    const liste = brut ? JSON.parse(brut) : [];
    return Array.isArray(liste) ? liste : [];
  } catch (e) { return []; }
}
let seancesAnnulees = chargerSeancesAnnulees();
function sauvegarderSeancesAnnulees() { Depot.ecrireJSON('seancesAnnulees', seancesAnnulees); }
function estRoleVieScolaire() {
  return !!utilisateurConnecte && (utilisateurConnecte.role === 'directeur' || utilisateurConnecte.role === 'surveillant');
}
function nomApprobateur() {
  if (!utilisateurConnecte) return '';
  return utilisateurConnecte.role === 'directeur' ? 'Directeur' : (utilisateurConnecte.nom || 'Surveillant');
}
// Pourquoi une seance n'a pas lieu : annulation explicite, fermeture de l'etablissement
// ou indisponibilite de l'enseignant. Renvoie null si la seance a bien lieu.
function raisonAnnulation(dateISO, classe, heure) {
  if (!dateISO || !classe || !heure) return null;
  const m = hhmmEnMinutes(heure);
  // 1. seance annulee explicitement (directeur / surveillant)
  const sna = seancesAnnulees.find(s => s.dateISO === dateISO && s.classe === classe &&
    m >= hhmmEnMinutes(s.debut) && m < hhmmEnMinutes(s.fin || s.debut));
  if (sna) return { source: 'seance', motif: sna.motif || 'Séance annulée', par: sna.par || '', debut: sna.debut, fin: sna.fin };
  // 2. fermeture de l'etablissement (vacances, examens, fetes, reunion...)
  const ferm = fermeturesEtab.find(f => dansPeriode(f, dateISO) && porteeCorrespond(f.portee, heure));
  if (ferm) return { source: 'fermeture', motif: ferm.libelle || ferm.type || 'Établissement fermé', par: ferm.par || '', type: ferm.type || '' };
  // 3. indisponibilite de l'enseignant qui assure la seance
  const jour = new Date(dateISO + 'T12:00:00').getDay();
  const cr = creneauDeHeure(classe, jour, heure);
  if (cr && cr.prof) {
    const ind = indispoProfs.find(i => i.profCode === cr.prof && dansPeriode(i, dateISO) && porteeCorrespond(i.portee, heure));
    if (ind) return { source: 'indispo', motif: ind.motif || 'Absence du professeur', par: ind.par || '', profCode: cr.prof, debut: cr.debut, fin: cr.fin };
  }
  return null;
}
function seanceAnnulee(dateISO, classe, heure) { return raisonAnnulation(dateISO, classe, heure); }
// Une absence prise pendant une seance annulee ne compte pas
function absenceEnSeanceAnnulee(a) {
  return !!a && !!seanceAnnulee(a.dateISO, a.classe, a.heure);
}
// Creneaux reels d'une classe pour un jour (deduits des tableaux de service)
function creneauxClasseJour(classe, jour, avecDefaut) {
  const par = {};
  Object.keys(tableauxService).forEach(mail => (tableauxService[mail] || []).forEach(c => {
    if (c.classe !== classe || c.jour !== jour) return;
    if (!par[c.debut]) par[c.debut] = { debut: c.debut, fin: c.fin, matiere: c.matiere, prof: c.prof };
  }));
  const liste = Object.keys(par).map(k => par[k]).sort((a, b) => hhmmEnMinutes(a.debut) - hhmmEnMinutes(b.debut));
  if (liste.length) return liste;
  if (avecDefaut === false) return [];      // pour compter les seances DUES : pas de repli
  const std = [];
  for (let h = 8; h < 12; h++) std.push({ debut: String(h).padStart(2, '0') + ':00', fin: String(h + 1).padStart(2, '0') + ':00', matiere: '', prof: '' });
  for (let h = 14; h < 18; h++) std.push({ debut: String(h).padStart(2, '0') + ':00', fin: String(h + 1).padStart(2, '0') + ':00', matiere: '', prof: '' });
  return std;
}
function heureMaintenant() {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
// Date affichee dans la liste des annulations (carte Fermeture de l'etablissement)
function rafraichirListeAnnulations() {
  const el = document.getElementById('annul-date-card');
  if (el && !el.value) el.value = fmtDateISO(new Date());
  afficherSeancesAnnulees();
}

// Formulaire "Annuler une séance" (carte Fermeture de l'etablissement, page Gestion)
function preparerFormulaireAnnulation() {
  bornerDatesAnnee();
  const dateEl = document.getElementById('annul-date');
  if (dateEl && !dateEl.value) dateEl.value = fmtDateISO(new Date());
  const selClasse = document.getElementById('annul-classe');
  if (selClasse) {
    const courant = selClasse.value;
    selClasse.innerHTML = '';
    classes.forEach(cl => {
      const o = document.createElement('option');
      o.value = cl.nom;
      o.textContent = cl.nom;
      selClasse.appendChild(o);
    });
    if (courant && classes.some(c => c.nom === courant)) selClasse.value = courant;
  }
  majCreneauxAnnulation();
}
function majCreneauxAnnulation() {
  const dateEl = document.getElementById('annul-date');
  const selClasse = document.getElementById('annul-classe');
  const selCr = document.getElementById('annul-creneau');
  const dateISO = (dateEl && dateEl.value) ? dateEl.value : fmtDateISO(new Date());
  if (selCr && selClasse) {
    const jour = new Date(dateISO + 'T12:00:00').getDay();
    selCr.innerHTML = '';
    creneauxClasseJour(selClasse.value, jour).forEach(c => {
      const o = document.createElement('option');
      o.value = c.debut + '|' + c.fin;
      o.textContent = c.debut + '–' + c.fin + (c.matiere ? ' · ' + c.matiere : '');
      selCr.appendChild(o);
    });
  }
}
// Teinte d'un bouton d'action de carte : une CLASSE, jamais une couleur en dur dans le JS.
// Les regles existent en clair (00-base.css) et en sombre (02-theme-sombre.css).
function classeTeinteCarte(couleur) {
  if (couleur === '#dc2626') return 'carte-action-danger';
  if (couleur === 'var(--primary)') return 'carte-action-principale';
  return 'carte-action-lien';
}
// Carte de liste commune (meme rendu pour les seances annulees et les absences du personnel)
function carteLigne(titre, sousTitre, action) {
  const item = document.createElement('div');
  item.className = 'flex justify-between items-center bg-gray-50 rounded-lg';
  const bloc = document.createElement('div');
  bloc.style = 'min-width: 0; flex: 1;';
  const p1 = document.createElement('p');
  p1.className = 'carte-ligne-titre';
  p1.innerHTML = titre;
  const p2 = document.createElement('p');
  p2.className = 'carte-ligne-sous';
  p2.innerHTML = sousTitre;
  bloc.appendChild(p1);
  bloc.appendChild(p2);
  item.appendChild(bloc);
  if (action) {
    const b = document.createElement('button');
    b.type = 'button';
    // La teinte vient d'une CLASSE (feuille claire ET feuille sombre) : un bleu fonce ecrit
    // en dur devenait illisible sur la carte en mode sombre (defaut signale : « Modifier »,
    // « Rétablir »).
    b.className = 'btn-inline flex-shrink-0 ' + classeTeinteCarte(action.couleur);
    b.innerHTML = action.icone || false;
    if (action.texte) b.textContent = action.texte;
    b.onclick = action.onclick;
    item.appendChild(b);
  }
  return item;
}

// Seances annulees PARCE QU'UN ENSEIGNANT EST ABSENT : calculees depuis son tableau de service.
// (limite de securite : 60 jours par absence et 600 seances au total)
function seancesAnnuleesParAbsence() {
  const resultat = [];
  const MAX_JOURS = 60;
  const MAX_SEANCES = 600;
  indispoProfs.filter(i => roleAbsence(i) === 'enseignant').forEach(ind => {
    const code = ind.profCode;
    const debut = ind.debut;
    const fin = ind.fin || ind.debut;
    if (!code || !debut) return;
    // creneaux hebdomadaires du prof (jour de la semaine -> creneaux)
    // ATTENTION : dans les tableaux de service, « prof » porte tantot le CODE
    // (math-prof1), tantot le NOM AFFICHE (أيوب الكمرة). Comparer au seul code
    // faisait que les seances annulees par une absence n'apparaissaient JAMAIS
    // chez le directeur ni chez le surveillant (defaut reellement signale).
    const nomDuProf = (function () {
      try { return nomProfCode(code); } catch (e) { return ''; }
    })();
    const nomsPossibles = [code, nomDuProf];
    if (nomsProfs && nomsProfs[code]) nomsPossibles.push(nomsProfs[code]);
    const estCeProf = c => nomsPossibles.some(n => n && String(c.prof || '') === String(n));
    const parJour = {};
    Object.keys(tableauxService).forEach(mail => (tableauxService[mail] || []).forEach(c => {
      if (!estCeProf(c)) return;
      parJour[c.jour] = parJour[c.jour] || [];
      if (!parJour[c.jour].some(x => x.classe === c.classe && x.debut === c.debut)) parJour[c.jour].push(c);
    }));
    const depart = new Date(debut + 'T12:00:00');
    let compte = 0;
    for (let d = new Date(depart); fmtDateISO(d) <= fin && compte < MAX_JOURS; d.setDate(d.getDate() + 1)) {
      compte++;
      const dateISO = fmtDateISO(d);
      const jour = d.getDay();
      if (jour === 0 || jour === 6) continue;                       // pas de cours le week-end
      (parJour[jour] || []).forEach(c => {
        if (resultat.length >= MAX_SEANCES) return;
        if (!porteeCorrespond(ind.portee, c.debut)) return;
        resultat.push({
          genere: true, origine: 'absence', idAbsence: ind.id, profCode: code,
          dateISO: dateISO, classe: c.classe, debut: c.debut, fin: c.fin,
          motif: ind.motif || 'Absence', par: ind.par || ''
        });
      });
    }
  });
  return resultat;
}

// Les 2 sources fusionnees, sans doublon (une saisie directe prime sur l'absence du prof)
function listeSeancesAnnulees() {
  const vues = {};
  const fusion = [];
  seancesAnnulees.forEach(sn => {
    const cle = sn.dateISO + '|' + sn.classe + '|' + sn.debut;
    if (vues[cle]) return;
    vues[cle] = true;
    fusion.push(Object.assign({ origine: 'saisie' }, sn));
  });
  seancesAnnuleesParAbsence().forEach(c => {
    const cle = c.dateISO + '|' + c.classe + '|' + c.debut;
    if (vues[cle]) return;
    vues[cle] = true;
    fusion.push(c);
  });
  return fusion;
}

// L'etablissement est-il ferme a cette date ? (et sur ce demi-jour, si la fermeture
// ne couvre qu'une demi-journee)
function fermetureCouvre(dateISO, estMatin) {
  return fermeturesEtab.some(f => {
    const d = String(dateISO || '');
    if (d < f.debut || d > f.fin) return false;
    if (!f.portee || f.portee === 'journee') return true;
    return (f.portee === 'matin') === !!estMatin;
  });
}

// Les SEANCES DUES d'une classe sur une periode : les creneaux du tableau de service,
// MOINS les fermetures de l'etablissement, les annulations et les absences de professeurs
// (ces deux dernieres sont deja fusionnees par listeSeancesAnnulees).
// C'est le denominateur juste du taux de presence : avant, l'application le deduisait des
// signalements eux-memes, donc plus il y avait d'absences... plus le taux montait.
function seancesDuesClasse(classe, debut, fin) {
  const annulees = {};
  listeSeancesAnnulees().forEach(sn => { annulees[sn.dateISO + '|' + sn.classe + '|' + sn.debut] = true; });
  let n = 0;
  const d = new Date(debut + 'T12:00:00');
  const dernier = new Date(fin + 'T12:00:00');
  while (d <= dernier) {
    const jour = d.getDay();                       // 0 = dimanche : aucune seance
    if (jour >= 1 && jour <= 6) {
      const dateISO = fmtDateISO(d);
      creneauxClasseJour(classe, jour, false).forEach(c => {
        if (fermetureCouvre(dateISO, hhmmEnMinutes(c.debut) < 12 * 60)) return;
        if (annulees[dateISO + '|' + classe + '|' + c.debut]) return;
        n++;
      });
    }
    d.setDate(d.getDate() + 1);
  }
  return n;
}

// Les absences qui comptent vraiment sur une periode : les signalements dont le type
// EFFECTIF est « absence » (un retard de plus de 30 min en est une), hors fermeture de
// l'etablissement. `classe` est facultatif (sinon : tout l'etablissement).
function absencesCompteesPeriode(debut, fin, classe) {
  return absences.filter(a => {
    const d = String(a.dateISO || '');
    if (d < debut || d > fin) return false;
    if (classe && a.classe !== classe) return false;
    if (typeEffectif(a) === 'retard') return false;
    return !fermetureCouvre(d, (a.seance || 'matin') === 'matin');
  });
}

// Ordre : de la plus proche a la plus lointaine (les seances a venir d'abord, puis les passees recentes)
// Ordre d'affichage : la seance la PLUS PROCHE d'aujourd'hui vient en premier
// (hier ou demain d'abord, puis on s'eloigne). A egalite de distance, celle a venir
// passe avant celle passee. Remarque de l'utilisateur : « ordre decroissant de plus
// proche » — c'est-a-dire de la plus proche vers la plus lointaine.
function trierSeancesAnnulees(liste) {
  const auj = fmtDateISO(new Date());
  const distant = (d) => {
    const j = new Date(String(d || auj) + 'T12:00:00').getTime();
    const t = new Date(auj + 'T12:00:00').getTime();
    return Math.abs(j - t);
  };
  return (liste || seancesAnnulees).slice().sort((a, b) => {
    const da = String(a.dateISO || '');
    const db = String(b.dateISO || '');
    const ea = distant(da);
    const eb = distant(db);
    if (ea !== eb) return ea - eb;                 // la plus proche d'abord
    const fa = da > auj;
    const fb = db > auj;
    if (fa !== fb) return fa ? -1 : 1;             // meme distance : a venir d'abord
    if (da !== db) return fa ? da.localeCompare(db) : db.localeCompare(da);
    return String(a.debut || '').localeCompare(String(b.debut || ''));
  });
}
// Remplit TOUTES les cartes "Seances annulees" (Dashboard directeur + surveillant)
function afficherSeancesAnnulees() {
  const conteneurs = document.querySelectorAll('.js-seances-annulees');
  const auj = fmtDateISO(new Date());
  const liste = trierSeancesAnnulees(listeSeancesAnnulees());
  for (let i = 0; i < conteneurs.length; i++) {
    const cont = conteneurs[i];
    cont.innerHTML = '';
    if (liste.length === 0) {
      cont.innerHTML = '<p class="text-sm text-gray-500 text-center py-2">Aucune séance annulée.</p>';
      continue;
    }
    liste.forEach(sn => {
      const jour = String(sn.dateISO || '');
      const parAbsence = sn.origine === 'absence';
      // Plus de pastille « Absence prof » (retiree le 15/09 : elle ne s'affichait pas en mode
      // clair). Une seance annulee par une absence reste reconnaissable a son sous-titre
      // « Absence de ... ».
      const titre = dateAffichage(jour) + ' · ' + sn.classe + ' · ' + sn.debut + '–' + (sn.fin || '') +
        (jour > auj ? ' <span class="tag-avenir">À venir</span>' : '');
      const sous = parAbsence
        ? 'Absence de ' + nomProfCode(sn.profCode) + (sn.motif ? ' · ' + sn.motif : '')
        : ((sn.motif || '') + (sn.par ? ' · par ' + sn.par : ''));
      // une seance annulee par une absence se retire depuis la rubrique RH, pas ici
      cont.appendChild(carteLigne(titre, sous, parAbsence ? null : { texte: 'Rétablir', onclick: () => retablirSeance(sn.id) }));
    });
  }
}
function rafraichirListeAnnulations() { afficherSeancesAnnulees(); }

// Annulations enregistrees (saisie directe) : liste de la carte "Annulation de seances" (Gestion)
function afficherAnnulationsEnregistrees() {
  const cont = document.getElementById('annulations-liste');
  if (!cont) return;
  cont.innerHTML = '';
  const liste = trierSeancesAnnulees(seancesAnnulees);
  if (liste.length === 0) {
    cont.innerHTML = '<p class="text-sm text-gray-500 text-center py-2">Aucune annulation enregistrée.</p>';
    return;
  }
  const auj = fmtDateISO(new Date());
  liste.forEach(sn => {
    const titre = dateAffichage(sn.dateISO) + ' · ' + sn.classe + ' · ' + sn.debut + '–' + (sn.fin || '') +
      (String(sn.dateISO) > auj ? ' <span class="tag-avenir">À venir</span>' : '');
    cont.appendChild(carteLigne(titre, (sn.motif || '') + (sn.par ? ' · par ' + sn.par : ''),
      { texte: 'Rétablir', onclick: () => retablirSeance(sn.id) }));
  });
}

function confirmerAnnulationSeance() {
  if (!estRoleVieScolaire()) return;
  const dateEl = document.getElementById('annul-date');
  const classe = (document.getElementById('annul-classe') || {}).value || '';
  const parties = String((document.getElementById('annul-creneau') || {}).value || '').split('|');
  const motif = (document.getElementById('annul-motif') || {}).value || 'Séance non assurée';
  const dateISO = (dateEl && dateEl.value) ? dateEl.value : fmtDateISO(new Date());
  if (!classe || !parties[0]) { afficherToast('Choisissez une classe et une séance', 'error'); return; }
  const jourSem = new Date(dateISO + 'T12:00:00').getDay();
  if (jourSem === 0 || jourSem === 6) { afficherToast('Pas de cours le week-end', 'error'); return; }
  const bornes = bornesAnneeScolaire();
  if (dateISO < bornes.debut || dateISO > bornes.fin) { afficherToast("Date en dehors de l'année scolaire", 'error'); return; }
  if (seancesAnnulees.some(sn => sn.dateISO === dateISO && sn.classe === classe && sn.debut === parties[0])) {
    afficherToast('Séance déjà annulée', 'error');
    return;
  }
  seancesAnnulees.push({
    id: Date.now() + Math.random(), dateISO: dateISO, classe: classe,
    debut: parties[0], fin: parties[1] || '', motif: motif, par: nomApprobateur(),
    le: dateISO + ' ' + heureMaintenant()
  });
  sauvegarderSeancesAnnulees();
  afficherSeancesAnnulees();
  afficherAnnulationsEnregistrees();
  afficherToast('Séance annulée', 'modif');
  rafraichirApresAnnulation();
}
function retablirSeance(id) {
  const cible = seancesAnnulees.find(sn => String(sn.id) === String(id));
  if (!cible) return;
  confirmerSuppression('Rétablir la séance du ' + dateAffichage(cible.dateISO) + ' · ' + cible.classe + ' ' + cible.debut + ' ?',
    () => vraimentRetablirSeance(cible.id));
}
function vraimentRetablirSeance(id) {
  seancesAnnulees = seancesAnnulees.filter(sn => sn.id !== id);
  sauvegarderSeancesAnnulees();
  rafraichirListeAnnulations();
  afficherAnnulationsEnregistrees();
  afficherToast('Séance rétablie', 'modif');
  rafraichirApresAnnulation();
}
function rafraichirApresAnnulation() {
  if (utilisateurConnecte && utilisateurConnecte.role === 'enseignant') appliquerTableauService();
  if (typeof mettreAJourDashboardSurv === 'function') mettreAJourDashboardSurv();
  if (typeof mettreAJourDashboardDir === 'function') mettreAJourDashboardDir();
}

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
function enregistrerAbsence(prefixe, idCompte, role) {
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
  indispoProfs.push({
    id: Date.now() + Math.random(), profCode: compte, role: role, debut: debut, fin: fin,
    portee: portee, motif: motif, par: nomApprobateur(), le: fmtDateISO(new Date()) + ' ' + heureMaintenant()
  });
  sauvegarderIndispo();
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
  indispoProfs = indispoProfs.filter(i => i.id !== id);
  sauvegarderIndispo();
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
function afficherListeProfs() {
  afficherComptes('dir-profs-list', 'enseignant');
  afficherComptes('dir-surveillants-list', 'surveillant');
}

// ========== SURVEILLANTS : ajout, modification, suppression ==========
// ========== BOUTON UNIQUE DU MOT DE PASSE ==========
// « Générer » à la CRÉATION (il n'y a rien à réinitialiser) : il remplit le champ.
// « Réinitialiser » à la MODIFICATION : il applique un nouveau mot de passe.
// Un seul bouton, même place et même taille — seul le libellé change.
function libelleActionMdp() {
  const b = document.getElementById('btn-mdp-action');
  if (!b) return;
  b.innerHTML = creationProfil
    ? '<i class="fas fa-dice"></i> Générer'
    : '<i class="fas fa-rotate-right"></i> Réinitialiser';
}
function actionMotDePasse() {
  if (creationProfil) { genererMotDePasseProf(); return; }
  reinitialiserMotDePasse();
}

// ========== RÉINITIALISATION D'UN MOT DE PASSE (oubli) ==========
// « Générer » (dans la même fenêtre) sert à CHOISIR un mot de passe, notamment à la
// création. « Réinitialiser » sert à DÉPANNER quelqu'un qui a oublié le sien : le
// nouveau s'affiche en grand, avec la date du changement et une fiche PDF à remettre.
// Aucun envoi d'email n'est possible : les adresses @taalim.ma sont des identifiants
// internes, pas des boîtes mail — c'est donc le directeur qui rétablit l'accès.
let dernierReset = null;      // {cle, nom, email, mdp, role} — pour la fiche PDF

function chargerDatesMdp() {
  try {
    const brut = Depot.lire('datesMdp', null);
    const obj = brut ? JSON.parse(brut) : {};
    return (obj && typeof obj === 'object') ? obj : {};
  } catch (e) { return {}; }
}
function sauvegarderDatesMdp(d) { Depot.ecrireJSON('datesMdp', d); }

function reinitialiserMotDePasse() {
  const cle = profARenommer;
  if (!cle) return;
  const prof = comptes.find(c => c.code === cle || c.email === cle);
  if (!prof) return;
  demanderConfirmation('Réinitialiser le mot de passe de « ' + (prof.nom || '') + ' » ? Le nouveau s\'affichera ici, à lui remettre.',
    function () {
      const mdp = genererMotDePasse(8);
      prof.password = mdp;
      if (prof.email) { motsDePasse[prof.email] = mdp; sauvegarderMotsDePasse(); }
      const dates = chargerDatesMdp();
      dates[cle] = jourCourant();
      sauvegarderDatesMdp(dates);
      dernierReset = { cle: cle, nom: prof.nom, email: prof.email || '', mdp: mdp, role: prof.role };

      // affichage en grand (la fenêtre de modification est restée ouverte)
      const champ = document.getElementById('reset-mdp'); if (champ) champ.value = mdp;
      const mail = document.getElementById('reset-email');
      if (mail) mail.textContent = prof.email || '(compte non encore créé)';
      const dt = document.getElementById('reset-date');
      if (dt) dt.textContent = 'Modifié le ' + dateAffichage(dates[cle]);
      const mdpSaisi = document.getElementById('renommer-mdp'); if (mdpSaisi) mdpSaisi.value = '';
      const bloc = document.getElementById('renommer-reset'); if (bloc) bloc.classList.remove('hidden');
      afficherListeProfs();
      afficherToast('Mot de passe réinitialisé', 'modif');
    });
}

// Copie dans le presse-papiers (navigator.clipboard n'existe pas partout, notamment
// quand la page est ouverte depuis un fichier : on prévoit le repli par sélection)
function copierTexte(idChamp) {
  const el = document.getElementById(idChamp);
  if (!el) return;
  const texte = String(el.value || '');
  if (!texte) return;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texte).then(
        function () { afficherToast('Mot de passe copié', 'success'); },
        function () { copierParSelection(el); });
      return;
    }
  } catch (e) {}
  copierParSelection(el);
}
function copierParSelection(el) {
  try {
    const etait = el.readOnly;
    el.readOnly = false;
    el.select();
    el.setSelectionRange(0, 999);
    document.execCommand('copy');
    el.readOnly = etait;
    afficherToast('Mot de passe copié', 'success');
  } catch (e) {
    afficherToast('Copie impossible : notez le mot de passe', 'error');
  }
}

// Fiche PDF individuelle : un seul tableau, pour la personne concernée
async function ficheIdentifiantPersonne() {
  if (!dernierReset) { afficherToast('Réinitialisez d\'abord le mot de passe', 'error'); return; }
  if (!(await pdfPret())) return;
  try {
    const lib = window.PDFLib;
    const sections = [{
      titre: dernierReset.role === 'surveillant' ? 'Surveillant' : 'Enseignant',
      lignes: [{ nom: dernierReset.nom, email: dernierReset.email, password: dernierReset.mdp }]
    }];
    const doc = await construirePdfIdentifiants(lib, lib.PDFDocument, window.fontkit,
      base64VersOctets(POLICE_ARABE_B64), sections, {
        etablissement: (etablissement && etablissement.nom) || '',
        annee: (anneeScolaire && anneeScolaire.libelle) || '',
        date: dateAffichage(jourCourant())
      });
    const octets = await doc.save();
    const nomFichier = 'identifiant-' + String(dernierReset.cle).replace(/[^A-Za-z0-9-]/g, '') + '.pdf';
    telechargerFichier(octets, nomFichier);
    afficherToast('Fiche téléchargée', 'success');
  } catch (e) {
    afficherToast('Génération du PDF impossible : ' + (e && e.message ? e.message : e), 'error');
  }
}

// Ils ne viennent d'aucun fichier importe (ni MASSAR ni FET n'en contiennent) : c'est
// le directeur qui les cree. La liste est donc conservee localement ; les emails et
// mots de passe generes vivent dans motsDePasse (comme pour les enseignants).
let surveillantsRH = null;        // null = jamais modifiee : on garde les surveillants de demonstration
let creationProfil = false;       // true quand la fenetre sert a AJOUTER un surveillant

function chargerSurveillantsRH() {
  try {
    const brut = Depot.lire('surveillantsRH', null);
    const obj = brut ? JSON.parse(brut) : null;
    return Array.isArray(obj) ? obj : null;
  } catch (e) { return null; }
}

// La liste courante : celle enregistree, sinon celle deduite des comptes existants
function listeSurveillantsRH() {
  if (surveillantsRH) return surveillantsRH.map(s => ({ cle: s.cle, code: s.code, nom: s.nom, email: s.email || '' }));
  return comptes.filter(c => c.role === 'surveillant')
    .map(c => ({ cle: c.code || c.email, code: c.code || null, nom: c.nom, email: c.email || '' }));
}

function sauvegarderSurveillantsRH(liste) {
  surveillantsRH = liste;
  Depot.ecrireJSON('surveillantsRH', liste);
  appliquerListeSurveillants();
}

// Reconstruit les surveillants des comptes a partir de la liste conservee
function appliquerListeSurveillants() {
  if (!surveillantsRH) return;
  for (let i = comptes.length - 1; i >= 0; i--) {
    if (comptes[i].role === 'surveillant') comptes.splice(i, 1);
  }
  surveillantsRH.forEach(s => {
    comptes.push({
      email: s.email || '',
      password: (s.email && motsDePasse[s.email]) ? motsDePasse[s.email] : '',
      role: 'surveillant',
      nom: s.nom,
      code: s.code || null
    });
  });
  appliquerNomsProfs();
  appliquerMotsDePasse();
}

// Modification d'un surveillant (nom ou email) dans la liste conservee
function majSurveillantRH(cle, changement) {
  const liste = listeSurveillantsRH();
  const cible = liste.find(s => s.cle === cle || s.code === cle || s.email === cle);
  if (!cible) return false;
  Object.keys(changement || {}).forEach(k => { cible[k] = changement[k]; });
  sauvegarderSurveillantsRH(liste);
  return true;
}

// Ouvrir la fenetre en mode AJOUT
function ouvrirAjoutSurveillant() {
  creationProfil = true;
  profARenommer = null;
  const t = document.getElementById('renommer-titre');   if (t) t.textContent = 'Nouveau surveillant';
  const n = document.getElementById('renommer-nom');      if (n) n.value = '';
  const m = document.getElementById('renommer-mdp');      if (m) m.value = '';
  const i = document.getElementById('renommer-info');     if (i) i.textContent = "Ses identifiants de connexion seront generes avec le bouton « Telecharger les identifiants ».";
  const e = document.getElementById('renommer-email');    if (e) e.textContent = '';
  const s = document.getElementById('renommer-success');  if (s) s.classList.add('hidden');
  const b = document.getElementById('renommer-supprimer');if (b) b.classList.add('hidden');
  const rb = document.getElementById('renommer-reset');  if (rb) rb.classList.add('hidden');
  libelleActionMdp();          // « Générer » (on crée une personne : rien à réinitialiser)
  document.getElementById('modal-renommer').classList.remove('hidden');
}

// Suppression, avec confirmation (comme partout ailleurs)
function supprimerProfilCourant() {
  const cle = profARenommer;
  if (!cle) return;
  const prof = comptes.find(c => c.code === cle || c.email === cle);
  if (!prof) return;
  if (prof.role !== 'surveillant') { afficherToast('Suppression impossible depuis cet ecran', 'error'); return; }
  fermerRenommageProf();
  demanderConfirmation('Supprimer le surveillant « ' + (prof.nom || '') + ' » ? Son identifiant ne sera plus attribue.',
    function () {
      const liste = listeSurveillantsRH().filter(s => (s.cle || s.code) !== (prof.code || prof.email));
      sauvegarderSurveillantsRH(liste);
      if (prof.email && motsDePasse[prof.email]) { delete motsDePasse[prof.email]; sauvegarderMotsDePasse(); }
      afficherListeProfs();
      afficherToast('Surveillant supprime', 'suppression');
    });
}

// Mise en forme arabe (formes contextuelles) + ligatures lam-alef.
// Table extraite de la reference Python validee (arabic_reshaper v1).
const ARABE_FORMES = {
  "ء": ["ﺀ", "", "", ""],
  "آ": ["ﺁ", "", "", "ﺂ"],
  "أ": ["ﺃ", "", "", "ﺄ"],
  "ؤ": ["ﺅ", "", "", "ﺆ"],
  "إ": ["ﺇ", "", "", "ﺈ"],
  "ئ": ["ﺉ", "ﺋ", "ﺌ", "ﺊ"],
  "ا": ["ﺍ", "", "", "ﺎ"],
  "ب": ["ﺏ", "ﺑ", "ﺒ", "ﺐ"],
  "ة": ["ﺓ", "", "", "ﺔ"],
  "ت": ["ﺕ", "ﺗ", "ﺘ", "ﺖ"],
  "ث": ["ﺙ", "ﺛ", "ﺜ", "ﺚ"],
  "ج": ["ﺝ", "ﺟ", "ﺠ", "ﺞ"],
  "ح": ["ﺡ", "ﺣ", "ﺤ", "ﺢ"],
  "خ": ["ﺥ", "ﺧ", "ﺨ", "ﺦ"],
  "د": ["ﺩ", "", "", "ﺪ"],
  "ذ": ["ﺫ", "", "", "ﺬ"],
  "ر": ["ﺭ", "", "", "ﺮ"],
  "ز": ["ﺯ", "", "", "ﺰ"],
  "س": ["ﺱ", "ﺳ", "ﺴ", "ﺲ"],
  "ش": ["ﺵ", "ﺷ", "ﺸ", "ﺶ"],
  "ص": ["ﺹ", "ﺻ", "ﺼ", "ﺺ"],
  "ض": ["ﺽ", "ﺿ", "ﻀ", "ﺾ"],
  "ط": ["ﻁ", "ﻃ", "ﻄ", "ﻂ"],
  "ظ": ["ﻅ", "ﻇ", "ﻈ", "ﻆ"],
  "ع": ["ﻉ", "ﻋ", "ﻌ", "ﻊ"],
  "غ": ["ﻍ", "ﻏ", "ﻐ", "ﻎ"],
  "ـ": ["ـ", "ـ", "ـ", "ـ"],
  "ف": ["ﻑ", "ﻓ", "ﻔ", "ﻒ"],
  "ق": ["ﻕ", "ﻗ", "ﻘ", "ﻖ"],
  "ك": ["ﻙ", "ﻛ", "ﻜ", "ﻚ"],
  "ل": ["ﻝ", "ﻟ", "ﻠ", "ﻞ"],
  "م": ["ﻡ", "ﻣ", "ﻤ", "ﻢ"],
  "ن": ["ﻥ", "ﻧ", "ﻨ", "ﻦ"],
  "ه": ["ﻩ", "ﻫ", "ﻬ", "ﻪ"],
  "و": ["ﻭ", "", "", "ﻮ"],
  "ى": ["ﻯ", "ﯨ", "ﯩ", "ﻰ"],
  "ي": ["ﻱ", "ﻳ", "ﻴ", "ﻲ"],
  "ٱ": ["ﭐ", "", "", "ﭑ"],
  "ٷ": ["ﯝ", "", "", ""],
  "ٹ": ["ﭦ", "ﭨ", "ﭩ", "ﭧ"],
  "ٺ": ["ﭞ", "ﭠ", "ﭡ", "ﭟ"],
  "ٻ": ["ﭒ", "ﭔ", "ﭕ", "ﭓ"],
  "پ": ["ﭖ", "ﭘ", "ﭙ", "ﭗ"],
  "ٿ": ["ﭢ", "ﭤ", "ﭥ", "ﭣ"],
  "ڀ": ["ﭚ", "ﭜ", "ﭝ", "ﭛ"],
  "ڃ": ["ﭶ", "ﭸ", "ﭹ", "ﭷ"],
  "ڄ": ["ﭲ", "ﭴ", "ﭵ", "ﭳ"],
  "چ": ["ﭺ", "ﭼ", "ﭽ", "ﭻ"],
  "ڇ": ["ﭾ", "ﮀ", "ﮁ", "ﭿ"],
  "ڈ": ["ﮈ", "", "", "ﮉ"],
  "ڌ": ["ﮄ", "", "", "ﮅ"],
  "ڍ": ["ﮂ", "", "", "ﮃ"],
  "ڎ": ["ﮆ", "", "", "ﮇ"],
  "ڑ": ["ﮌ", "", "", "ﮍ"],
  "ژ": ["ﮊ", "", "", "ﮋ"],
  "ڤ": ["ﭪ", "ﭬ", "ﭭ", "ﭫ"],
  "ڦ": ["ﭮ", "ﭰ", "ﭱ", "ﭯ"],
  "ک": ["ﮎ", "ﮐ", "ﮑ", "ﮏ"],
  "ڭ": ["ﯓ", "ﯕ", "ﯖ", "ﯔ"],
  "گ": ["ﮒ", "ﮔ", "ﮕ", "ﮓ"],
  "ڱ": ["ﮚ", "ﮜ", "ﮝ", "ﮛ"],
  "ڳ": ["ﮖ", "ﮘ", "ﮙ", "ﮗ"],
  "ں": ["ﮞ", "", "", "ﮟ"],
  "ڻ": ["ﮠ", "ﮢ", "ﮣ", "ﮡ"],
  "ھ": ["ﮪ", "ﮬ", "ﮭ", "ﮫ"],
  "ۀ": ["ﮤ", "", "", "ﮥ"],
  "ہ": ["ﮦ", "ﮨ", "ﮩ", "ﮧ"],
  "ۅ": ["ﯠ", "", "", "ﯡ"],
  "ۆ": ["ﯙ", "", "", "ﯚ"],
  "ۇ": ["ﯗ", "", "", "ﯘ"],
  "ۈ": ["ﯛ", "", "", "ﯜ"],
  "ۉ": ["ﯢ", "", "", "ﯣ"],
  "ۋ": ["ﯞ", "", "", "ﯟ"],
  "ی": ["ﯼ", "ﯾ", "ﯿ", "ﯽ"],
  "ې": ["ﯤ", "ﯦ", "ﯧ", "ﯥ"],
  "ے": ["ﮮ", "", "", "ﮯ"],
  "ۓ": ["ﮰ", "", "", "ﮱ"],
  "‍": ["‍", "‍", "‍", "‍"],
  "ێ": ["", "", "", ""],
  "ە": ["ە", "", "", ""]
};
const ARABE_LAM_ALEF = {
  "ا": ["ﻻ", "ﻼ"],
  "أ": ["ﻷ", "ﻸ"],
  "إ": ["ﻹ", "ﻺ"],
  "آ": ["ﻵ", "ﻶ"]
};

// Met un texte arabe en forme : chaque lettre prend sa forme contextuelle
// (isolee / initiale / mediane / finale) et les ligatures lam-alef sont composees.
//
// POURQUOI PAS D'INVERSION ICI : pdf-lib applique LUI-MEME le sens droite -> gauche.
// Lui donner un texte deja inverse le fait inverser deux fois, et le rendu sort
// « miroir » (mots non continus). Verifie par mesure : correlation avec la version
// miroir +0,76 contre +0,41 dans le bon sens, puis corrige.
// Le test test_pdf_arabe.js relit les glyphes reellement ecrits dans le PDF et
// verifie l'ordre affiche : si pdf-lib changeait de comportement, il echouerait.
function formeArabe(texte) {
  const t = String(texte || '');
  if (!t) return '';
  const ch = Array.from(t);
  const formes = c => ARABE_FORMES[c];
  const lieAvant   = c => !!c && !!formes(c) && formes(c)[1] !== '';
  const lieArriere = c => !!c && !!formes(c) && formes(c)[3] !== '';
  const sortie = [];
  for (let i = 0; i < ch.length; i++) {
    const c = ch[i], suiv = ch[i + 1], prec = ch[i - 1];
    // ligature lam + alef (ﻻ) : une seule lettre, forme isolee ou finale
    if (c === '\u0644' && suiv && ARABE_LAM_ALEF[suiv]) {
      sortie.push(ARABE_LAM_ALEF[suiv][lieAvant(prec) ? 1 : 0]);
      i++;
      continue;
    }
    const f = formes(c);
    if (!f) { sortie.push(c); continue; }
    const avant = lieAvant(prec), apres = lieArriere(suiv);
    let tiree;
    if (avant && apres) tiree = f[2] || f[3] || f[0];
    else if (avant)     tiree = f[3] || f[0];
    else if (apres)     tiree = f[1] || f[0];
    else                tiree = f[0];
    sortie.push(tiree || c);
  }
  return sortie.join('');          // ordre logique : pdf-lib s'occupe de l'affichage
}

// ============================================================================
// Identifiants de connexion des enseignants — generation + PDF (pdf-lib)
// SOURCE DE VERITE : teste seul (Node), puis recopie tel quel dans l'application.
//
// pdf-lib (et non jsPDF) : jsPDF n'arrive pas a exploiter ces polices arabes
// (metadonnees de police vides -> texte illisible). pdf-lib utilise fontkit,
// un vrai analyseur de polices : verifie, l'arabe sort correct.
// ============================================================================

// Un mot de passe est repris tel quel seulement s'il respecte la regle de
// l'application (>= 6 caracteres, au moins une lettre, au moins un chiffre,
// aucun caractere special). Sinon il est regenere : les identifiants de
// demonstration (mot de passe « 12345 ») ne doivent pas partir dans le PDF.
function motDePasseAcceptable(mdp) {
  return !!mdp && mdp.length >= 6 && /[a-zA-Z]/.test(mdp) && /[0-9]/.test(mdp) && !/[^a-zA-Z0-9]/.test(mdp);
}

// L'email suit la convention générale : {préfixe}[-prof]{numéro}@taalim.ma
// (enseignants : math-prof1@taalim.ma · surveillants : surv1@taalim.ma)
function emailIdentifiantConforme(mail) {
  return !!mail && /^[a-z]+(-prof)?\d+@taalim\.ma$/.test(String(mail).toLowerCase());
}

// Convention EXACTE attendue pour une personne donnée : c'est elle qui décide si
// l'email déjà en place peut être conservé (il ne doit jamais être réattribué).
//   abréviation 'MATH' + séparateur '-prof' -> math-prof1@taalim.ma
//   abréviation 'surv' + séparateur ''      -> surv1@taalim.ma
function emailConformePour(mail, abreviation, separateur) {
  if (!mail || !abreviation) return false;
  const sep = (separateur === undefined ? '-prof' : String(separateur)).replace(/[-]/g, '\\-');
  return new RegExp('^' + String(abreviation).toLowerCase() + sep + '\\d+@taalim\\.ma$')
    .test(String(mail).toLowerCase());
}

// ---------------------------------------------------------------------------
// 3. Generation des identifiants
//    - email : {abreviation minuscule}-prof{n}@taalim.ma
//      n evite tout email deja pris : Supabase refuse deux comptes avec le
//      meme email, et un email ne doit JAMAIS etre reattribue.
//    - un mot de passe different par enseignant.
// ---------------------------------------------------------------------------
const DOMAINE_IDENTIFIANTS = '@taalim.ma';

function genererIdentifiants(enseignants, emailsPris, aleatoire) {
  // Les emails DES ENSEIGNANTS DE LA LISTE ne doivent pas etre comptes comme « deja
  // pris » : sinon on leur en fabriquerait un nouveau a chaque passage (l'appelant
  // transmet naturellement la liste complete des emails de l'etablissement).
  const abDe = ens => ens.abreviation || abrevMatiere(ens.matiere);
  const sepDe = ens => (ens.separateur === undefined ? '-prof' : String(ens.separateur));
  const propres = {};
  (enseignants || []).forEach(e => {
    if (emailConformePour(e.email, abDe(e), sepDe(e))) propres[String(e.email).toLowerCase()] = true;
  });
  const pris = {};
  (emailsPris || []).forEach(e => {
    if (!e) return;
    const cle = String(e).toLowerCase();
    if (propres[cle]) return;               // c'est l'email d'un enseignant de la liste : il lui reste acquis
    pris[cle] = true;
  });
  const compteurs = {};
  const sortie = [];

  (enseignants || []).forEach(ens => {
    const ab = abDe(ens);
    const separateur = sepDe(ens);            // '' pour les surveillants, '-prof' sinon
    let email = ens.email;
    let nouveau = false;

    // REGLE D'OR : un email deja attribue ET conforme a la convention de cette
    // personne ne change jamais (Supabase refuse deux comptes avec le meme email,
    // et des identifiants deja distribues cesseraient de fonctionner).
    if (!emailConformePour(email, ab, separateur) || pris[String(email).toLowerCase()]) {
      let n = compteurs[ab] || 0;
      do {
        n++;
        email = ab.toLowerCase() + separateur + n + DOMAINE_IDENTIFIANTS;
      } while (pris[email.toLowerCase()]);
      compteurs[ab] = n;
      nouveau = true;
    } else {
      // on compte cet email pour que les suivants du meme préfixe prennent le numéro d'après
      const num = String(email).toLowerCase().match(/(\d+)@taalim\.ma$/);
      if (num) compteurs[ab] = Math.max(compteurs[ab] || 0, parseInt(num[1], 10));
    }
    pris[String(email).toLowerCase()] = true;

    // mot de passe : conserve s'il est valable, sinon regenere (8 caracteres)
    const mdp = motDePasseAcceptable(ens.password) ? ens.password : genererMotDePasse(8, aleatoire);
    if (mdp !== ens.password) nouveau = true;

    sortie.push({ nom: ens.nom, matiere: ens.matiere, abreviation: ab, separateur: separateur,
                  email: email, password: mdp, nouveau: nouveau });
  });

  // un mot de passe ne doit jamais etre partage par deux enseignants
  const vus = {};
  sortie.forEach(l => {
    if (!l.password) return;
    let garde = 0;
    while (vus[l.password] && garde < 50) { l.password = genererMotDePasse(8, aleatoire); garde++; }
    vus[l.password] = true;
  });
  return sortie;
}

// Une personne peut s'appeler en arabe (سامية الحاضي) ou en latin (Samia El Hadi,
// « Surveillant 1 »). La police arabe ne contient PAS les lettres latines : dessinees
// avec elle, elles sortent en carres vides. On choisit donc la police selon le texte.
function policePourNom(texte) {
  return /[\u0600-\u06FF]/.test(String(texte || '')) ? 'arabe' : 'latin';
}

// ---------------------------------------------------------------------------
// 4. Le PDF — un tableau par section (« Surveillants », « Enseignants »…)
//    pdf-lib travaille en points (1 mm = 2,8346 pt) et son origine est en BAS
//    a GAUCHE : d'ou la conversion _yBas().
//    sections = [{ titre: 'Surveillants', lignes: [{nom, email, password}, …] }, …]
//    Une section vide est ignoree ; on passe a la page suivante si besoin.
// ---------------------------------------------------------------------------
const PT = 2.83465;                        // mm -> points
const PDF_MM = { largeur: 210, hauteur: 297, marge: 12 };
const PDF_COLS = [66, 72, 48];             // mm — total 186
const PDF_LIGNE_MM = 10;
const PDF_SECTION_MM = 9;                  // hauteur du titre d'une section

function _colX() {
  const x = [PDF_MM.marge];
  PDF_COLS.forEach(l => x.push(x[x.length - 1] + l * PT));
  return x;
}
function _yBas(yHautMm, hauteurMm) {
  return (PDF_MM.hauteur - yHautMm - hauteurMm) * PT;
}

async function construirePdfIdentifiants(PDFLib, PDFDocument, fontkit, octetsPolice, sections, infos) {
  const i = infos || {};
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fNom = await doc.embedFont(octetsPolice, { subset: false });
  const fGras = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
  const fTexte = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
  const fMono = await doc.embedFont(PDFLib.StandardFonts.CourierBold);
  const noir = PDFLib.rgb(0.12, 0.12, 0.12);
  const gris = PDFLib.rgb(0.4, 0.4, 0.4);
  const nuit = PDFLib.rgb(0.149, 0.224, 0.353);   // #26395A
  const blanc = PDFLib.rgb(1, 1, 1);
  const bordure = PDFLib.rgb(0.82, 0.85, 0.88);

  let page = doc.addPage([PDF_MM.largeur * PT, PDF_MM.hauteur * PT]);
  let y = PDF_MM.marge;                      // y = haut de la ligne courante (en mm)
  const centre = (PDF_MM.largeur / 2) * PT;
  const T = t => String(t == null ? '' : t);
  const largeurTexte = (t, police, taille) => police.widthOfTextAtSize(T(t), taille);
  const centrer = (t, police, taille) => centre - largeurTexte(t, police, taille) / 2;
  // passe a la page suivante s'il ne reste pas la place voulue
  const besoin = hauteurMm => {
    if (y + hauteurMm > PDF_MM.hauteur - PDF_MM.marge) {
      page = doc.addPage([PDF_MM.largeur * PT, PDF_MM.hauteur * PT]);
      y = PDF_MM.marge;
    }
  };

  // --- titre ---
  page.drawText(T('Identifiants de connexion - AbsenceTrack'),
                { x: centrer('Identifiants de connexion - AbsenceTrack', fGras, 15),
                  y: _yBas(y, 4) + 4, size: 15, font: fGras, color: nuit });
  y += 9;

  // --- etablissement (arabe, mis en forme a la main) ---
  if (i.etablissement) {
    const ar = policePourNom(i.etablissement) === 'arabe';
    const t = ar ? formeArabe(i.etablissement) : T(i.etablissement);
    const p = ar ? fNom : fTexte;
    page.drawText(t, { x: centrer(t, p, 12), y: _yBas(y, 4.2) + 4, size: 12, font: p, color: gris });
    y += 8;
  }

  // --- sous-titre ---
  const soustitre = 'Annee scolaire ' + T(i.annee) + ' - document a remettre a chaque personne';
  page.drawText(soustitre, { x: centrer(soustitre, fTexte, 10), y: _yBas(y, 3.5) + 3.5,
                             size: 10, font: fTexte, color: gris });
  y += 10;

  const x = _colX();
  const entetes = ['Nom', 'Email de connexion', 'Mot de passe'];

  (sections || []).forEach(section => {
    if (!section || !section.lignes || !section.lignes.length) return;
    besoin(PDF_SECTION_MM + PDF_LIGNE_MM + 6);

    // --- titre de la section ---
    page.drawText(T(section.titre), { x: PDF_MM.marge * PT, y: _yBas(y, 3.5) + 3.5,
                                      size: 11.5, font: fGras, color: nuit });
    y += 6;
    page.drawLine({ start: { x: PDF_MM.marge * PT, y: _yBas(y, 0) }, end: { x: (PDF_MM.largeur - PDF_MM.marge) * PT, y: _yBas(y, 0) },
                    thickness: 0.8, color: nuit });
    y += 3;

    // --- en-tete du tableau ---
    for (let c = 0; c < 3; c++) {
      page.drawRectangle({ x: x[c], y: _yBas(y, PDF_LIGNE_MM), width: PDF_COLS[c] * PT,
                           height: PDF_LIGNE_MM * PT, color: nuit });
      const l = largeurTexte(entetes[c], fGras, 10.5);
      page.drawText(entetes[c], { x: x[c] + (PDF_COLS[c] * PT - l) / 2,
                                  y: _yBas(y, PDF_LIGNE_MM) + PDF_LIGNE_MM * PT / 2 - 3.4,
                                  size: 10.5, font: fGras, color: blanc });
    }
    y += PDF_LIGNE_MM;

    // --- lignes ---
    section.lignes.forEach((l, n) => {
      besoin(PDF_LIGNE_MM);
      const fond = (n % 2 === 1) ? PDFLib.rgb(0.957, 0.965, 0.98) : blanc;
      for (let c = 0; c < 3; c++) {
        page.drawRectangle({ x: x[c], y: _yBas(y, PDF_LIGNE_MM), width: PDF_COLS[c] * PT,
                             height: PDF_LIGNE_MM * PT, color: fond,
                             borderColor: bordure, borderWidth: 0.5 });
      }
      const milieu = _yBas(y, PDF_LIGNE_MM) + PDF_LIGNE_MM * PT / 2 - 4;
      // nom : police arabe si le nom est en arabe, sinon police latine (aligne a droite)
      const enArabe = policePourNom(l.nom) === 'arabe';
      const policeNom = enArabe ? fNom : fTexte;
      const nom = enArabe ? formeArabe(T(l.nom)) : T(l.nom);
      page.drawText(nom, { x: x[1] - 6 - largeurTexte(nom, policeNom, 12), y: milieu, size: 12,
                           font: policeNom, color: noir });
      // email (latin, aligne a gauche)
      page.drawText(T(l.email), { x: x[1] + 6, y: milieu, size: 10.5, font: fTexte, color: noir });
      // mot de passe (chasse fixe, centre)
      const mdp = T(l.password);
      page.drawText(mdp, { x: x[2] + (PDF_COLS[2] * PT - largeurTexte(mdp, fMono, 11.5)) / 2,
                           y: milieu, size: 11.5, font: fMono, color: noir });
      y += PDF_LIGNE_MM;
    });

    y += 6;                                  // respiration entre les sections
  });

  // --- pied ---
  besoin(10);
  const pied = 'Document confidentiel - ' + T(i.date) +
               ' - chaque personne change son mot de passe dans Profil.';
  page.drawText(pied, { x: centrer(pied, fTexte, 9), y: _yBas(y, 4), size: 9,
                        font: fTexte, color: gris });
  return doc;
}


// ========== IDENTIFIANTS : emails, mots de passe et PDF ==========
// Une bibliotheque PDF ecrit de gauche a droite et ne sait pas joindre les lettres
// arabes : on met donc les lettres en forme nous-memes (formeArabe) et on laisse
// pdf-lib appliquer le sens droite -> gauche (il le fait DEJA : lui donner un texte
// deja inverse produirait un rendu « miroir »).

const POLICE_ARABE_B64 = "AAEAAAAOAIAAAwBgR0RFRnnvmz4AAWvUAAAZUkdQT1MZM8aqAAGFKAAAM5RHU1VC3NavOAABuLwAAA8uT1MvMrhTbMkAAAFoAAAAYGNtYXD1S7/WAAAZvAAABMxnYXNwAAcABwABa8gAAAAMZ2x5ZujqfTwAACqEAAE7GmhlYWQR3chFAAAA7AAAADZoaGVhF8AMzAAAASQAAAAkaG10eDGRCMoAAAHIAAAX9GxvY2Gbx+IcAAAeiAAAC/xtYXhwBj0EqgAAAUgAAAAgbmFtZYysuUAAAWWgAAAGBnBvc3T/aQBmAAFrqAAAACAAAQAAAAEUe0iXxgBfDzz1AAsIAAAAAADNMFTWAAAAANZeFnn+AvsKES4IcwAAAAkAAgAAAAAAAAABAAAIjfruAAARC/4C+tURLgABAAAAAAAAAAAAAAAAAAAF/QABAAAF/QOXABIBEQAlAAEAAAAAAAAAAAAAAAAACAABAAQGDgGQAAUAAAWaBTMAAAEfBZoFMwAAA9EAZgIACAICCwUCBAUEAgIEgAAgA4AAIAAAAAAIAAAAAEdPT0cAQAAA/v8IjfruAAAIjQUSAAAAQQAIAAAAAAAAAAAAIAAFBSoABgAAAAABxAAAAcQAAAGlAF4BpQBeAaUAXg1WAEIETf/sBE3/7AawAIsEbABGBcgARgNcACEBswBRAmcAVAbVAIsFLwBOAAD/6wAA/+cAAP92AAD/jwAA/vUAAP9dAAD+cwAA/2wAAP+QAAD/kQAA/5ABswBaAtoAXgNmAHEE8gBEA34AbwHn/+QB5wBkA78ARgIMAJAE8gBEAecAnQYtAI8DYwBWBi0AjwYtAI8FFgCABRYAgAUWAIADTwBGA08ARgL6/7oC+v+6CBsAiwgbAIsIxACLCMQAiwYnAFcGJwBXBNUAgATVAIAFxgCLBcYAiwTyAEQE8gBEBPIARAGu/+8GyQCLBS0ARAR2ACMEwwBEA+kAiwSxAEQDRACLA78ARgTyAEQE8gBEAAD/1AAA/48AAAAAAAD/6gAA/8YAAP/qAAD/3gAA//wAAP90AAD/8gAAADAAAP/iAAD/+gAAABUAAAA1AAAAPAAAADwAAP9qAAAAGAAAADIAAP+8AoQAnAKIAJ0DTgCdA9IAnQNcAIsDDgBgA5AANAN9ABMDfQARA3cAVwM2AEYBxwBVAUkAGQM0ACYGLQCPBS0ARAAA/+IB5wAOAecAAAIMACcBBP//ArIAnQO/AEYDvwBGBfoARAYtAI8GLQCPBi0AjwYtAI8GLQCPBi0AjwYtAI8GLQCPBRYAgAUWAIAFFgCABRYAgAUWAIAFFgCABRYAgANXAE0DTwBGA08ARgNPAEYDTwBGA08ARgNPAEYDTwBGA08ARgL6/7oC+v+6Avr/ugL6/7oC+v+6Avr/ugL6/7oDFv+6Avr/uggbAIsIGwCLCBsAiwjEAIsIxACLBicAVwTVAIAGyQCLBskAiwbJAIsGyQCLBtAAiwbJAIsFLQBEBS0ARAXGAIsIHgASBX8AiwR2ACMEdgAjBHYAIwXGAIsFxgCLBcYAiwXGAIsFxgCLBcYAiwTDAEQEwwBEBMMARATDAEQEsQBEBLEARASxAEQEsQBEBLEARAUMACMFFgCAA0QAiwNEAIsDRACLA2MAVwO/AEYDvwBGA78ARgO/AEYDvwBGA78ARgO/AEYDvwBGBPIARAYHAIsE8gBEA78ARgTyAEQE8gBEBi8AiwYvAIsB8gBTA0QAiwAA/gIAAP6ZAAD+cwAA/y4AAP8jAAD/PgAA/rgJugBkB18AKgAA/5EAAP+RAAD/WgAA/34AAP64AAD+/AGkACsCwQBYAAD+7gAA/0QEFQAqAAD/egAA/3oAAP9qAAD/fgNPAEYC+v+6AoQAnAKIAJ0DTgCdA9IAnQO6AJ0DogBgA40AegN9ABMDfQARA28AWggbAIsIxACLBNUAgAN+AG8D6QCLBQwAIwYtAI8GLQCPBi0AjwYtAI8GLQCPBi0AjwYtAI8FFgCABYAAgANXAE0DTwBGA2D/uggbAIsE1QCABNUAgATVAIAGyQCLBskAiwXGAIsFxgCLBcYAiwPpAIsD6QCLBLEARASxAEQEsQBEBMMARAL6/7oC+v+6CBsAiwUWAIAFFgCACBsAiwL6/7oFFgCAAef/rAHn/6oE8gBEBPIARATyAEQDv///A7///wZhAKcGYQCnBRYAgAgbAIsIGwCLBHYAIwAAAAAAAP/cAAD/JQAA/9wAAP5RBNMAYgIG//0GiQCPAjT/7wJX/+8GiQCPAr//7wLi/+8GiQCPAr//7wLi/+8GiQCPAr//7wLi/+8GiQCPAr//7wLi/+8GiQCPAjT/8QLi/+8GigCLA03/7wMY/+8GigCLA03/7wMY/+8FUwCFBRb/7wVT/+8FUwCFBRb/7wVT/+8FUwCFBRb/7wVT/+8FUwCFBRb/7wVT/+8DygBGA8oARgPKAEYDygBGAx//ugMf/7oGNQCJA1H/7wOs/+8GNQCJA1H/zAOs/6cGNQCJA1H/zAOs/6cGNQCJA1H/zAOs/6cErwBEBK8ARAOeAIsDZgCLAjT/7wMp/+8FEgAjBBD/7wQb/+8EPQBpBBoASgNmAQgDZgDlA2YAlgNmAHMDZgC6A2YAqwNmAMEDZgC2Aw8AoAMPAKAClADIAe8AbQIFAHYB1gCEApQAbAKUAGwF5ACLA1H/7wOs/+8DvwBGA78ARgO/AEYDvwBGA78ARgO/AEYFfwBiAr//7wLi/+8CNP/vAlf/7wV/AGICv//vAuL/7wGQ/78BkAABAZAADAGQ//UBkAAJAZAAJAQBABEEAQBXB+QA0QGQAAMBkP/pAZAACgGQABIBkAAWAZAAEgGQACQBkABmAgb/0gIGAFIDvwBGAgYAnAV/AGICNP/vAlf/7wIGAJwGiQCPAjT/7wJX/+8DvQCqBokAjwI0/+8C4v/vBokAjwKn/+8C4v/vBU8AhQUW/+8FU//vBVMAhQUW/+8FU//vBU8AhQUW/+8FU//vA8oARgPKAEYDH/+6Ax//uggiAIsFQ//vBU3/7wgiAIsFQ//vBU3/7wjLAIsGSv/vBjn/7wjLAIsGSv/vBjn/7wY0AFcFSP/vBQn/7wY0AFcFSP/vBQn/7wPQAIwECv/vA0//7wPQAIwECv/vA0//7waKAIsDXP/vAxj/7wUiAEQDXP/vAxj/7wXkAIsDUf/vA6z/7wS7AEQBs//sAfX/7wQ5AIsDpf/vA07/7wSvAEQCNP/vAlf/7wOeAIsEEP/vAwz/7wO/AEYFfwBiBX8AYgK//+8C4v/vBCT/bQTh/6kEJP/tBOEAKgQkAEcE4QBGBCQARwThAEYGyQCLBSIARAHnAJ0CBgCgAAAAEQI0/+8GiQCPAr//7wJX/+8C4v/vAxj/7waKAIsDXP/vAAD/bwQk/5gE4f/VAAD/aANmAIsDZgCLA2YA6wPbAEsCTQBcAk0AYgAA/2kAAP/DAAD/0wAA/5UAAP/KAAD/4wAAADAAAAAwAAD/UQAA/+MAAP+pAAD/sgAA/5sAAP/hA7gApwNcADgCBv/uAgYAfQIGAJwDvwBGA78ARgV/AGIGiQCPAjT/7wLi/+8GiQCPAr//7wLi/+8FUwCFBRb/7wVT/+8FTwCFBRb/7wVT/+8FUwCFBRb/7wVT/+8DygBGA8oARgPKAEYDygBGA8oARgMf/7oDH/+6Ax//ugMf/7oDH/+6Ax//ugMf/7oIIgCLBUP/7wVN/+8IIgCLBUP/7wVN/+8IIgCLBUP/7wVN/+8IywCLBkr/7wY5/+8IywCLBkr/7wY5/+8GNABXBUj/7wUJ/+8D0ACMBAr/7wNP/+8GigCLA1z/7wMY/+8GigCLA1z/7wMY/+8GigCLA1z/7wMY/+8FIgBEBSIARAiFABIHGf/vB4L/7wY1AIkDUf/vA6z/7wXkAIsDUf/vA6z/7wXkAIsDUf/vA6z/7wY1AIkDUf/QA6z/pwY1AIkDUf/QA6z/pwY1AIkDUf/MA6z/pwS7AEQBs//EAfX/xAS7AEQBs//sAfX/7wS7AEQBs/+aAfX/mgS7AEQC0f/vAfX/7wSvAEQCNP/vAlf/7wSvAEQCNP/vAlf/7wSvAEQFUwCFBRb/7wVT/+8DvwBGBpQAiwZK/+8GOf/vCMsAiwQK/+8DT//vA9AAjAQk/4kE4f/FBCQARwThAEYEJABHBOEARgQkAEcE4QBGBCQARwThAEYEJABHBOEARgQrAEcE4QBGA8oARgMf/7oFEgAjBBD/7wQb/+8GiQCPA9n/7wPo/+8CNP/vAlf/7waJAI8GiQCPAt7/7wLi/+8GiQCPAt7/7wLi/+8GiQCPAr//7wLi/+8GiQCPAr//7wLi/+8GiQCPAr//7wLi/+8FTwCFBRb/7wVT/+8FUwCFBRb/7wVT/+8DygBGA8oARgMf/7oIIgCLBUP/7wVN/+8DngCMBAr/7wNP/+8D0ACMBAr/7wNhAAAD0ACMBAr/7wNhAAAGigCLA1z/7wMY/+8GigCLA1z/7wMY/+8GNQCJA1H/7wOs/+8GNQCJA1H/7wOs/+8GNQCJA1H/7wOs/+8EPgCLA6X/7wNO/+8EPgCLA6X/7wNO/+8ErwBEAr//7wLi/+8ErwBEAjT/7wJG/+IErwBEAjT/7wJX/+8EuwBEAbP/7AH1/+8DH/+6Ax//uggiAIsFQ//vBU3/7wO/AEYDvwBGAr//7wLi/+8FfwBiBX8AYgVD/+8FTf/vCCIAiwQkAEcE4QBGAAD+bgAA/okDTf/vAjT/7wGcAAQJhQCLAjT/7wMp/+8AAP/eAccAVQV/AGICNP/vAlf/7wY1AIkDUf/vA6z/7wY1AIkDUf/vA6z/7wV/AGICv//vAuL/7wV/AGICNP/sAuL/7wV/AGICp//tAuL/7wVTAIUFFv/vBVP/7wgiAIsFQ//vBU3/7wMf/7oFTwCFBRb/7wVT/+8CBv+bAgb/mQV/AGICnv/ZAuL/7wV/AGICnv/YAuL/7wV/AGICnv/vAuL/7wO///8Dv///Ap7/2QLi/+8EGgBHAp7/2ALi/+8EGgBHBVMAhQUW/+8FU//vCCIAiwVD/+8FTf/vCCIAiwVD/+8FTf/vBeQAiwNR/+8DrP/vBVMAhQUW/+8FU//vA5gBPAOYAQ0DmACJA5gATQOYAKsDmACwA5gAOAOYACMDmAAmA5gAiQOYAGsDmABhA5gAYAOYAHoDmABgAecAVAHnAC0CqP/vAtD/7wAA/+8AAP9TAAAAAAAAAAACDQA3AecAQwHvAG0Brv/vAa7/7wGu/+8Brv/vAa7/7wGu/+8AAAAgA9n/7wPo/+8GLQCPBokAjwK///EC4v/vBRYAgAVPAIUFFv/vBVP/7wYnAFcGNABXBUj/7wUJ/+8GyQCLBooAiwNN/+8DGP/vBS0ARAUiAEQDXP/vAxj/7wTDAEQEuwBEAbP/7AH1/+8D6QCLBD4AiwOl/+8DTv/vBPIARAV/AGICv//vAuL/7wTyAEQFfwBiAr//7wLi/+8DZAAKA4oACgO/ACgDvwAoBIsAgQAA/0QAAP/WAAD/RAAA/toAAP9fAAD++AAA/5kAAP89AAD/bgAA/5kAAP89AAD/bgAA/+oAAP/GAAD/6gAA/2MAAP9OAAD/LwAA/y8AAP9UAAD/OAAA/1QAAP84AAD+1wAA/qUAAP8OAAD/Xgm8AGQIyABkD4oAZAGcAEUBngBiAh4AXgJyAF4CJgBRAfUAPgJIABoCOwANAjsACwI4ADgCYgBeAlMAPgJGAE4CYgBrAiYAJQHpAAACBwAAAkEAAAJiAAAHngCLAAADrARN/+wAAAGCCTMARgkzAEYJMwBGCTMARg1WAEINVgBCDVYAQg1WAEIJxQBpCcUAaQnFAGkJxQBpCNsARgjbAEYI2wBGCNsARg+xAG4PsQBuD7EAbg+xAG4PsQBuCboAZAm6AGQJugBkBCQBUAAAAEYE4QBsAAAARQQkAVAEJAFQBCQBUAQkAVAEJAFQAAD/bQAA/4kAAABGAAD/mAAA/+0AAABGBOEAbAThAGwE4QBsBOEAbAThAGwAAP+hAAD/vQAAAEUAAP/MAAAAIQAA/9wAAABFAY8AAAQkAVADvwAoA78AKASLAIEAAP+dAAAAoAAA/y8EXQCcBb0AiwYWAEYGFgBGBhYARgYWAEYH1gBiB9YAYgV2/7oFdv+6BpAAiwcGAEQH1gBiB9YAYgV2/7oFdv+6BpAAiwcGAEQH1gBiB9YAYgYB/7oGAf+6BxsAiweRAEQIYQBiCGEAYgYB/7oGAf+6BxsAiweRAEQIYQBiCGEAYgiXAGIIlwBiCJcAYgiXAGIFsgCcCGcARAflAIsJKwBiCSsAYgYuAIsHdABiB3QAYgVUAJwHhwCLBXb/ugV2/7oGkACLBwYARAfWAGIH1gBiBX8AYgYB/7oGAf+6BxsAiweRAEQIYQBiCGEAYgqIAGIKiABiCM4AYgjOAGIIzgBiCM4AYgrMAGIKzABiCswAYgrMAGIK0gBiCtIAYgrSAGIK0gBiCtIAYgrSAGILuABiC7gAYgu4AGILuABiCpwAhQqgAIUKnACFCYYAiwhs/7oIbP+6CVj/uglY/7oCBgCcBRb/7wSL/+8Hh//vB4f/7weH/+8Fgv/vBUD/7weH/+8Hh//vB4f/7wWC/+8FQP/vB/H/7wfx/+8H8f/vBez/7wWq/+8F9f/vCmn/7whk/+8Kaf/vCGT/7wpp/+8IZP/vCpb/7wqW/+8Klv/vCJH/7wud/+8Lnf/vCZj/7wud/+8Lnf/vC53/7wmY/+8Km//vCJb/7wld/+8HWP/vCV3/7wdY/+8Ir//vCK//7wiv/+8Gqv/vCK//7waq/+8IpP/vCKT/7wik/+8FRv/vBp//7wcG/+8HBv/vBwb/7wUB/+8Ev//vCPj/7wj4/+8I+P/vBvP/7weH/+8Hh//vB4f/7wWC/+8FQP/vCWP/7wde/+8EEP/vCBL/7wgS/+8IEv/vBg3/7wXL/+8Klv/vCpb/7wqW/+8Ikf/vCE//7whP/+8Ilv/vBDoAnAWaAIsF8wBGBfMARgXzAEYF8wBGB7MAYgezAGIHgwCFB4cAhQZtAIsHswBiB7MAYgeDAIUHhwCFB4MAhQZtAIsHswBiB7MAYgftAIUH8QCFB+0AhQbXAIsIHQBiCB0AYgf2AIUG4ACLCCYAYggmAGIKaQCFCU8AiwplAIUJTwCLCmUAhQppAIUJTwCLCpIAhQqWAIUKkgCFCXwAiwudAIUKgwCLC5kAhQudAIULmQCFCoMAiwqbAIUJgQCLCYEAiwlZAIUIQwCLCVkAhQhDAIsIqwCFCK8AhQirAIUHlQCLCNsAYgjbAGIIrwCFB5UAiwjbAGII2wBiBVcAnAigAIUIpACFCKAAhQgMAEQHigCLCNAAYgjQAGIHAgCFBwYAhQcCAIUF7ACLBzIAYgcyAGII9ACFCPgAhQj0AIUH3gCLCSQAYgkkAGIHgwCFB4cAhQeDAIUGbQCLB7MAYgezAGIJXwCFCEkAiwmPAGIJjwBiCA4AhQgSAIUIDgCFBvgAiwg+AGIIPgBiA08ARgL6/7oE8gBECscAYgrHAGIJiQBiCYkAYgmJAGIJiQBiCsIAYgrCAGIKwgBiCsIAYgqVAGIKlQBiCpUAYgqVAGIKlQBiCpUAYgvJAGILyQBiC8kAYgvJAGIKkgCFCpYAhQqSAIUJfACLCGL/ughi/7oJaf+6CWn/ugHnAJ0Fpf/vBWP/7wWl/+8FY//vBjD/7wXu/+8GMP/vBe7/7wib/+8IWf/vCJv/7whZ/+8Fof/vBvr/7wVD/+8Fpf/vBWP/7wYw/+8F7v/vCqD/7wqg/+8KoP/vCqD/7wqg/+8KoP/vCFf/7whX/+8NhACFDfQAhQ4gAGIOIABiEB8AYg3uAIUM1ACLEN8AhQ3AAIsO2QCLEB8AYg3qAIUM1ACLEQsAYg/FAIsNqgCFDdYAYgzbAIsK1gCLDBwAYgrWAIsMHABiDBwAYgykAIsLuQCFCp8AiwuBAIsMxwBiDMcAYgyXAIULgQCLCpYAhQ4gAGINKQBiC+MAiw0pAGILJABiCyQAYgppAIsNKQBiDbQAYg20AGINtABiDbQAYguvAGILrwBiDiAAYhAlAGIOIABiEB8AYhELAGIQHwBiEQsAYgzHAGIKwgBiDbQAYg20AGILrwBiDBsAYgvlAGINKQBiDBwAYgx5AGIOIABiCzMAiwuBAIsM/QCFECUAYhAlAGIOIABiC+UAYg0pAGIQHwBiDSkAYgs//+8NRP/vCz//7ws//+8LP//vCz//7ws//+8Nt//vD+n/7w/p/+8N5P/vDeT/7wvf/+8Q8P/vDeT/7w3k/+8L3//vDuv/7w3p/+8L5P/v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ePF5AXkVeSl5PXlReWF5cXmFeZV5qXm5ec153XnxegF6FXolejl6SXpdem16gXqReqV6tXrJetl67Xr9exF7IXs1e0V7WXtle3F7fXuJe5l7pXuxe8F7zXvZe+l7/XwNfCF8MXxFfFF8YXx1fIV8mXypfL18yXzZfOV89X0FfRl9JX01fUV9WX1lfXV9hX2Zfal9vX3Jfdl96X39fhF+IX41fkV+VX5hfm1+fX6Jfp1+rX7BftF+5X71fwV/GX8pfz1/TX9df3F/gX+Vf6V/tX/Ff9V/5X/1gAGAFYAlgDWAQYBRgF2AaYB5gIWAmYCpgL2AzYDZgOmA+YEFgRmBKYE9gU2BYYFxgYGBkYGhga2BvYHJgdWB5YHxggGCDYIZgimCNYJFglGCZYJ1gomCmYKpgrmCxYLRguWC9YMJgxmDKYM9g02DYYNxg32DjYOZg6mDuYPJg92D8YQFhBmEKYQ9hE2EXYRthIGElYSlhLmEyYTZhO2FAYURhSWFNYVFhVmFbYV9hY2FoYWxhcGF0YXdhfGGAYYRhiGGLYY9hkmGVYZhhnWGhYaZhqmGtYbBhtGG4YbthwGHEYclhzWHSYdZh2mHfYeNh52HrYfBh82H3Yfph/mIBYgRiB2ILYg9iEmIWYhliHGIgYiRiJ2IrYi5iMWI1YjpiPmJDYkdiS2JQYlRiV2JaYl5iY2JnYmxicGJ0YnlifWKAYoNihmKKYo1ikWKVYppinWKhYqViqmKtYrFitWK6Yr5iw2LGYspizmLTYthi3GLhYuVi6WLsYu9i82L2Yvpi/mMCYwZjCmMOYxJjFmMZYxxjIGMkYydjKmMtYzFjNWM5Yz1jQWNEY0hjTWNRY1ZjWWNdY2NjaGNtY3FjdmN6Y35jgmOGY4tjkmOYY51jomOoY6xjsWO2Y7pjvmPDY8ljzmPUY9lj3mPiY+dj62PxY/Zj+mP/ZARkCmQQZBZkG2QgZCdkLmQ0ZDtkQWRHZExkUmRXZFxkYWRmZGxkcmR4ZH1kg2SKZJBklWSbZKFkpmSrZLFktWS6ZMBkxmTMZNJk2GTeZORk62TxZPdk/GUCZQhlDWUTZRhlHWUiZSZlK2UvZTNlOGU+ZUNlSWVNZVFlVWVbZWFlZmVqZW9lc2V4ZX1lg2WIZY5lk2WXZZxlomWnZaxlsGW2Zbtlv2XEZchlyGXLJc3l0OXcZeK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Um54pkQPi1I9YwxJOz81SriZZ4gBJAQWVES88u+MY7BjS0u4puABEm4c/YpIb5UnV2VYPWoBM493/uECpAAAAQB6AAADTwSJACMAADc2Njc3JiY1NDY2MzIWFwcmJiMiBgcUFhc3NjcWFhUUBwYGB3pTYFcEcI1MhFNFgGMmXUItR283npsIYKEIDna64IhjoJNqBRyOV2C2bUBVRyMNISd3eAcFRUkMPBI6Tnvs6QD//wATAAADawSLAgYAZwAA//8AEQAAA2sEiwIGAGgAAP//AFr//QL4BK8ABgBpAwD//wCL/egHsgRVAiYAMwAAACcBfAPDAFMABwF5BEv/w///AIv96AhbBKACJgA1AAAAJwF4BCYAvgAHAXkE3//z//8AgP1TBQkFfAImADkAAAAnAXgAMAGaAAcBeQGPAOn//wBv/Y0DWgKbAiYAIQAAAAcBggCn/4n//wCL/Y8DmgMvAiYARQAAAAcBggEaADf//wAj/3cEowWWAiYAvgAAAAcCGQEQANr//wCP/l0FyANEAiYAbgAAAAcCFwEKAAj//wCP/lIFyAThAiYAbgAAACcBeQGS//MABwF8ASoA3///AI/96QXIA0QCJgBuAAAABwF/AUn/zP//AI/96QXIBH0CJgBuAAAAJwF/AUn/zAAHAXoBNACO//8Aj/5dBcgEkAImAG4AAAAnAXsBe//+AAcBeAFSAK7//wCP/hUFyANEAiYAbgAAAAcF7gJHAGr//wCP/5YFyATnAiYAbgAAAAcCGAGbACb//wCA/VAE8wTGAiYALQAAAAcBegEEANf//wCA/VAE8wNwACYALQAAAAcBfwEyATf//wBN/YEDAAVtACYALwcAACcCEwFlAOcABwGEAND/t///AEb+FAL5A5QCJgAvAAAABwXuAPkAaf///7r9+gL1Ax4AJgAxAAAABwPPALT9Ef//AIv96AeyBGACJgAzAAAABwGABBgAUP//AID9UwUJBXICJgA5AAAABwF6ABMBg///AID9UwUJBeECJgA5AAAABwF+//oB8P//AID9UwUJBk0CJgA5AAAABwGDAMoB+P//AIv+XQZhBD0CJgIDAAAABwF7A6P//v//AIv96QZhBD0CJgIDAAAABwF/A3H/zP//AIv/lgWhBn0CJgCpAAAABwNtA8UCKP//AIv/lgWhBmICJgCpAAAABwNqA+EAav//AIv96QWhBTwCJgCpAAAABwF/Adz/zP//AIv9jwOaBJACJgBFAAAABwF4ACwArv//AIv9jwOaAy8CJgBFAAAABwF5AOQAQf//AET8SwRIAzACJgC6AAAAJwF4AH//TgAHAXsAkf3s//8ARP2EBEgFCQImALoAAAAnAXgAf/9OAAcCEwG0AIP//wBE/YQESATnAiYAugAAACcBeAB//04ABwIYAMUAJv//AET9hASpBcICJgBEAAAABwPPAmgAAP///7r9+gKSBVACJgAxAAAABwGDAHMA+////7r9+gKSBKMCJgAxAAAABwBUAOz+/f//AIv96AeyBNYCJgAzAAAABwGDBIQAgf//AID9UATzA3ACJgAtAAAABwITApf8l///AID9UATzA3ACJgAtAAAABwNrAfj8Kf//AIv96AeyBTkCJgAzAAAABwNrBGgAEP///7r9+gKSBbMCJgAxAAAABwNrAFYAiv//AID9UATzBUkCJgAtAAAABwITAl0Aw////6z/lgFsBbkCJgIFAAAABwNj/1j/n////6r/lgFsBboCJgIFAAAABwNk/33/n///AET9hASsA7cCJgBJAAAABwNjANT9nf//AET9hASsA7wCJgBJAAAABwNkAPz9of//AET7CgSsArgCJgBJAAAABwNsATT3lf/////9/ANXBJYCJgBIAAAABwNj/6v+Lf/////9/ANXBJYCJgBIAAAABwNk/9L+Lf//AKf/lgYnBJYAJgDSHAAABwNjAFf+fP//AKf/lgYnBJcAJgDSHAAABwNkAH7+fP//AID9UATzA3ACJgAtAAAABwNsAiT7Uf//AIv96AeyBMoCJgAzAAAABwNsBJn+2///AIv96AeyBF4CJgAzAAAABwIZBHH/ov//ACP/lgP8BV4CJgBDAAAABwIWACIAlAAB/9z/owAkBW8AAwAAExEjESRIBW/6NAXMAAH/Jf+jANsFbwAOAAAXIxEHJzcnNxc3FwcXByckSIYxq6sxqqoxq6sxhl0EoYgxqagxq6sxqKkxiAAB/9z/owGuBW8ACgAAAQcnNyERIxEhJzcBrtkxif72RwFRiTEEmNYxgvsuBRmCMQAB/lH/owAjBW8ACgAAFyMRIRcHJzcXByEjR/72iTHZ2TGJAVFdBNKCMdbXMYIAEgBi/toEXgOeAAAAAQAJABEAGQAh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AiYCCQAAACcBegGE/9gABwBSAyb62P///+/+kQIwBLkCJgIIAAAAJwBSAIH7BQAHAXr/ZADK////7/5kAwUDjQImAgwAAAAmAXoDngAHAFIBAPrY//8Aj/+WBq8ENgImAgkAAAAHAX4BagBF////7/+WAoYFKAImAgoAAAAHAX7/uAE3////7/+WAwUD/AImAgwAAAAGAX7pC///AIX9UwV3BQUCJgG/AAAABwIHAgAAIP///+//lgTQBN0CJgHAAAAABwIHAdj/+P///+//lgV2BN0CJgHBAAAABwIHAdr/+P//AIX9UwV3BXYAJgG/AAAABwGDAbsBIf///+//lgTQBU4CJgHAAAAABwGDAZMA+f///+//lgV2BU0CJgHBAAAABwGDAZYA+P//AIX9UwV3BPUCJgG/AAAABwF8APoA8////+//lgTQBM0CJgHAAAAABwF8ANIAy////+//lgV2BM0CJgHBAAAABwF8ANQAy///AEb+ZAPtA5QCJgHFAAAABwBSAWb62P//AEb+UgPtA5QCJgHFAAAABgF5dvP//wBG/lID7QVtAiYBxQAAACYBeXbzAAcCEwFsAOf//wBG/5YD7QVaAiYBxQAAAAcBfv/8AWn//wBG/5YD7QVQAiYBxQAAAAcBgABhAUD///+6/foDQgTVAiYBxwAAAAYCGEEU////uvzIA0IDHgImAccAAAAHAFIATPk8////uvy2A0IDHgImAccAAAAHAXn/W/5X////uvx5A0IDHgImAccAAAAHBe3/0P7O////uvy2A0IDHgImAccAAAAnAXn/kAGMAAcBef9b/lf///+6/foDQgR1AiYBxwAAAAcBev/aAIb///+6/foDQgTaAiYBxwAAAAcBgAAlAMr//wCL/egIRAQFAiYByQAAACcBeAQyACMABwF5BGn/wf///+/+UgTbBAUCJgHKAAAAJwF4ARwAIwAHAXkBPf/z////7/5SBXAEBQImAcsAAAAnAXgBMgAjAAcBeQE1//P//wCL/b0IRAKkAiYByQAAAAcBfQQs/8b////v/e8E2wK4AiYBygAAAAcBfQEA//j////v/e8FcAKkAiYBywAAAAcBfQD4//j//wCL/b0IRARVAiYByQAAACcBfAQLAFMABwF9BCz/xv///+/97wTbBFUCJgHKAAAAJwF8APUAUwAHAX0BAP/4////7/3vBXAEVQImAcsAAAAnAXwBCwBTAAcBfQD4//j//wCL/egI7gM/AiYBzwAAAAcBewTd//7////v/l0FvwM/AiYB0AAAAAcBewJZ//7////v/l0GXAM/AiYB0QAAAAcBewJa//7//wCL/egI7gTwAiYBzwAAAAcBfAQTAO7////v/5YFvwTwAiYB0AAAAAcBfAF9AO7////v/5YGXATxAiYB0QAAAAcBfAF9AO///wBX/4IGVwVeAiYB1QAAAAcBfAJ8ASr////v/5YE4AVeAiYB1gAAAAcBfAGdAUL////v/5YFKwVeAiYB1wAAAAcBfAGgAUL//wCM/VMEVQUTAiYB2wAAAAcBfAA4ARH////v/5YD1gUTAiYB3AAAAAcBfP/1ARH////v/5YDcgUTAiYB3QAAAAcBfP/vARH//wCL/lIGrQOFAiYCDgAAAAcBeQN///P////v/lIC9AQaAiYCDwAAAAYBeVzz////7/5SAzsDYgImAg0AAAAGAXkZ8///AIv+UgatBOYCJgIOAAAAJwF4A1oBBAAHAXkDf//z////7/5SAvQFewImAg8AAAAnAXj/9wGZAAYBeVzz////7/5SAzsEwwImAg0AAAAnAXj//gDhAAYBeRnz//8Ai/3vBq0DhQImAg4AAAAHAX0DQv/4////7/3vAvQEGgImAg8AAAAGAX0f+P///+/97wM7A2ICJgINAAAABgF93Pj//wBE/YQFRQSOAiYCBAAAAAcBeAFiAKz//wBE/YQFRQTeAiYCBAAAAAcBfAE7ANwABAAS/5YIqASKADsAPAA9AD4AACEjIiYmJzcWISAkNyYmIyIFBCMiJjU0PgI3FhUUBw4CFRQWMzIlJDMyFhYVBxcWMzIVFRQjIicnBAQDARUCSlPxsUIBA+gBLgF/AtbpH4t1gv7j/uKWiXpOoeFyBV1W3G+WSXUBHAEbfWarYAQPXXkREY15Cv7V/TJyAzsnTTYjMSEdWU8QEVdmT5aPdh4aGHAlJH1eHBspDw5FgFgnCDURehFTBisuBIr7Oi4ABP/v/5YGsQSKAC4ALwAwADEAADEiNTU0MyAkNyYmIyIFBCMiJjU0NiQ3FhUUBgcOAhUUFjMyJSQzMhYWFRQHBgQTARUREQK2AvG9H4t1gv7j/uKWiXqQASOPBSE8VtxvlklzAR0BHXxmq2As9fxDQAMvEXoRIB5ZTxARV2Zsya4lGRglWBkkfV4cGykPDkWAWEVhKy8Eivs6LgAABP/v/5YHpQSKADYANwA4ADkAACEiJwYEISI1NTQzICQ3JiYjIgUEIyImNTQ2JDcWFRQGBw4CFRQWMzIlJDMyFhYVBxYzMhUVFAEBFQeTjoH1/En+KBERArYC8b0fi3WC/uP+4paJepABI48FITxW3G+WSXMBHQEdfGarYANjghL6eANTWisvEXoRIB5ZTxARV2Zsya4lGRglWBkkfV4cGykPDkWAWCY+EXoRBIr7Oi4A//8Aif+WBkMFPAImAWEAAAAHAFID9P+b////7/+WAy0FPAImAegAAAAHAFIBc/+4////7/+WA88FPAImAekAAAAHAFIBYf+Y//8Ai/+WBgcFXgImAecAAAAHAXgBQgDX////7/+WAy0GfQImAegAAAAHA20BUQIo////7/+WA88GfQImAekAAAAHA20BlQIo//8Ai/3vBgcFXgImAecAAAAHAX0BS//4////7/3vAy0FPAImAegAAAAGAX3g+P///+/97wPPBTwCJgHpAAAABgF95fj//wCJ/5YGQwYFAiYBYQAAACcAUgP0/5sABwMNA6j/Tf///9D/lgMtBgUCJgHoAAAAJwMMAWL/WQAHAFIBeP+7////p/+WA88GBQImAekAAAAnAw0BHv9NAAcAUgFz/5///wCJ/YEGQwYFAiYBYQAAACcDDQOo/00ABwGEAtv/t////9D9gQMtBgUCJgHoAAAAJwMMAWL/WQAHAYQAo/+3////p/2BA88GBQImAekAAAAnAw0BHv9NAAcBhACo/7f//wCJ/5YGQwd5AiYBYQAAACcDDQOo/00ABwNpBBEAlP///8z/lgMtB3sCJgHoAAAAJwMMAV7/WQAHA2kBWQCW////p/+WA88HewImAekAAAAnAw0BHv9NAAcDaQGGAJb//wBE/YQE3gdXAiYB6gAAAAcAWgIhA0n////E/5YBOgdXAiYB6wAAAAcAWv+IA0n////E/5YCGAdXAiYB7AAAAAcAWv+IA0n//wBE/YQE3gcjAiYB6gAAAAcBeAGhA0H////s/5YBOgcjAiYB6wAAAAcBeP8HA0H////v/5YCGAcjAiYB7AAAAAcBeP8IA0H//wBE/YQE3gdzAiYB6gAAAAcBfAF6A3H///+a/5YBpwdz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Bq8CcAImAgkAAAAHBe4C6wBp////7/4UAlcDYgImAgoAAAAHBe4AqgBp////7/4UAwUCNgImAgwAAAAHBe4AxQBp//8Aj/+WBq8EJwImAgkAAAAHAhgB6/9m////7/+WAlcFGQImAgoAAAAGAhg5WP///+//lgMFA+4CJgIMAAAABwIYAGr/Lf//AIX9UwV3BJsAJgG/AAAABwF6AQQArP///+//lgTQBHMCJgHAAAAABwF6ANwAhP///+//lgV2BHMCJgHBAAAABwF6AN0AhP//AIX9UwV3A0QCJgG/AAAABwF/AN8A/P///+/96QTQAxwCJgHAAAAABwF/ANH/zP///+/96QV2AxwCJgHBAAAABwF/AM//zP//AEb9gQPtBW0CJgHFAAAAJwGEAPv/twAHAhMBbADn//8ARv4UA+0DlAImAcUAAAAHBe4BKwBpAAP/uv36A0IDHgAnACgAKQAAFyE2NyYnJiY1NDY3FhcWFhcWMzIVFRQjIicGBiMiJic3FjMyNjY3IRMDtQFmGBIbI0hBPzgPGkEtBUVbERFgRyP3qjGqMRxwUUl6ZB/+2M6uAjA2Qj98lzM0Pxw4RKuaNCkRehEy1v5NJkQXKEwpA4P63AD//wCL/egIRARgAiYByQAAAAcBgARgAFD////v/5YE2wRgAiYBygAAAAcBgAFKAFD////v/5YFcARgAiYBywAAAAcBgAFgAFD//wCM/VMEVQS5ACYB2wAAAAcBegBCAMr////v/5YD1gS5AiYB3AAAAAcBev//AMr////v/5YDcgS5AiYB3QAAAAcBev/5AMr//wCM/VMEVQUoAiYB2wAAAAcBfgAoATf////v/5YD1gUoAiYB3AAAAAcBfv/lATf//wAA/5YDgwUoACYB3REAAAcBfv/wATf//wCM/VMEVQWUAiYB2wAAAAcBgwD5AT/////v/5YD1gWUAiYB3AAAAAcBgwC2AT///wAA/5YDgwWUACYB3REAAAcBgwDBAT///wCL/l0GrQOFAiYCDgAAAAcBewNn//7////v/l0C9AQaAiYCDwAAAAYBe0X+////7/5dAzsDYgImAg0AAAAGAXsD/v//AIv96QatA4UCJgIOAAAABwF/Azb/zP///+/96QL0BBoCJgIPAAAABgF/E8z////v/ekDOwNiAiYCDQAAAAYBf9LM//8Aif+WBkMGfQImAWEAAAAHA20EHwIo////7/+WAy0GfQImAegAAAAHA20BUQIo////7/+WA88GfQImAekAAAAHA20BlQIo//8Aif+WBkMGsAImAWEAAAAHA2kEOf/L////7/+WAy0GsAImAegAAAAHA2kBa//L////7/+WA88GsAImAekAAAAHA2kBr//L//8Aif3pBkMFPAImAWEAAAAHAX8CDP/M////7/3pAy0FPAImAegAAAAGAX/UzP///+/96QPPBTwCJgHpAAAABgF/2cz//wCL/Y8EYQR9ACYB7QAAAAcBeACaAJv////v/4IDRQR9AiYB7gAAAAcBeABfAJv////v/4IDcQR9AiYB7wAAAAcBeP/zAJv//wCL/Y8EYQMcACYB7QAAAAcBeQE//5f////v/j4DRQMcAiYB7gAAAAYBeWbf////7/4+A3EDHAImAe8AAAAGAXl73///AET8SwTSAv4CJgFtAAAAJwF7AJH97AAHAXgAgv8c////7/5dAoYEwwImAgoAAAAmAXvd/gAHAXj/7wDh////7/5dAwUDlwImAgwAAAAmAXggtQAGAXv5/v//AET9hATSBNgCJgFtAAAAJwF4AIL/HAAHAhMBtwBS////7/+WAfwF2QImAw8AAAAmAXiXHgAHAhMAzAFT////4v+WAmwFcAAmAgvzAAAmAXiHtQAHAhMAvADq//8ARP2EBNIEowImAW0AAAAnAXgAg/8KAAcCGADJ/+L////v/5YBzwW3AiYDDwAAACYBeJceAAcCGP/dAPb////v/5YCeQVOAiYCCwAAACYBeJS1AAcCGP/aAI3//wBE/YQE3gXCAiYB6gAAAAcDzwJoAAD////s/5YB6QXCAiYB6wAAAAYDzQAA////7/+WAhgFwgImAewAAAAGA80AAP///7r9+gNCBVACJgHHAAAABwGDAJEA+////7r9+gNCBKMCJgHHAAAABwBUAQr+/f//AIv96AhEBNYCJgHJAAAABwGDBMwAgf///+//lgTbBNYCJgHKAAAABwGDAbYAgf///+//lgVwBNYCJgHLAAAABwGDAcwAgf//AEb9/APiBIQCJgH2AAAABwF6ADcAlf//AEb9/APiBI4CJgH2AAAABwF4AFQArP///+/+XQKGBRkCJgIKAAAAJgF73f4ABgIYOVj////v/l0DBQPuAiYCDAAAACcCGABq/y0ABgF7+f7//wBi/YYFogL3AiYB9wAAAAcCGAFe/jb//wBi+98FogFAAiYB9wAAAAcBfQCT/ej////v/lIE2wRVAiYBygAAACcBfAD1AFMABwF5AT3/8////+/+UgVwBFUCJgHLAAAAJwF8AQsAUwAHAXkBNf/z//8Ai/3oCEQEVQImAckAAAAnAXwECwBTAAcBeQRp/8H//wBH/5YEGQXlAiYCAQAAAAcDzQIwAKD//wBG/5YFBAXCAiYCAgAAAAcDzQK6AQEAAv5uBMABsQasAA0ADgAAASY1NDc3ARYVBwYHBwQl/n8RBGcCtyEBCTF7/vv+3ATARhoKAjMBTRklDisXN3NfAAL+iQSyAisGuAAPABAAAAEmNTQ3NjckNxYVBwYHBwQn/pkQBK/wAQvTIQELMPv+4+oEskMbDAJWandjGSQPLRRuepAABf/v/5YC5QOaABcAIgAjACQAJQAAJSYmNTQ2NjMyFhYVFAcGBCEiNTU0MzI3EyIGBhUUFhYXJiYDExUBYG5qToBEWJdcSH7+7f72ExPBlh0qSS1atZsgl016qhl6bGO7b4rqhkaKOzETdhMNAd81Vys9XDgOs+MBEvwqLgAABP/v/5YBzwKfABQAFQAWABcAADEiNTU0MzI2NyYnJjU0NxYVFAYHBhMDFRERWcpKEB8WfygmItaBVBF6ERYSPk41FFpI1EkecUFOAp/9JS4AAAEABP9CAZgB4AADAAABASMBAZj+4XUBAgHg/WICngD//wCL/5YI2QcjACYD0QAAACYD0g5qAAcAJwdsAAD////v/ekBzAUjAiYBcQAAAAYCB0M+////7/3cA0wDOQImAXIAAAAHAgcBH/5UAAT/3gOWATAGcwAlADIAMwA0AAABFhYVFAYjIicGBiMiJjU0NxcGFRQzMjY1JzcWFjMyNjcmJyc0NgMWFhUUByc0JyY1NDYTAwEPEg87KCoXDjIbJC8XGwYrFRwDKwckIQsWAgMZAx6JEwgtCx4GJD5YBMElRhAvRB8jJS4sKCwFFB0yHho/Gz4sDggTOBARIgGFZWU7Vz8DkX0WESM1/WAC3QD//wBVAuYBcgTTAgcAawAAA6z//wBi/FUFogFAAiYB9wAAAAcAUgHB+Mn////v/mQBzANiAiYCCAAAAAcAUgCB+tj////v/mQCeQI2AiYCCwAAAAcAUgDY+tj//wCJ/5YGQwZAAiYBYQAAAAcDaATwADH////v/5YDLQZAAiYB6AAAAAcDaAIiADH////v/5YDzwZAAiYB6QAAAAcDaAJmADH//wCJ/e8GQwU8AiYBYQAAAAcBfQIY//j////v/e8DLQU8AiYB6AAAAAYBfeD4////7/3vA88FPAImAekAAAAGAX3l+P//AGL9hgWiAvoCJgH3AAAABwIZAZv+Pv///+/+XQKFBRwCJgIKAAAAJgIZdmAABgF73P7////v/l0DBQPxAiYCDAAAACcCGQCm/zUABgF7+P7//wBi/YYFogKXAiYB9wAAAAcBegD3/qj////s/l0CMAS5AiYCCAAAACcBev9kAMoABwF7/3n//v///+/+XAMFA40CJgIMAAAAJgF6A54ABgF7+P3//wBi/YYFogLxAiYB9wAAAAcBfADt/u/////t/l0CIwUTACYCCAAAACcBfP9aAREABwF7/3r//v///+/+XQMFA+cCJgIMAAAAJgF8+eUABgF79/7//wCF/VMFdwNEAiYBvwAAAAcDawGx++v////v/d0E0AMcAiYBwAAAAAcDawIs+0n////v/d0FdgMcAiYBwQAAAAcDawIs+0n//wCL/egIRAU5AiYByQAAAAcDawSuABD////v/5YE2wU5AiYBygAAAAcDawGYABD////v/5YFcAU5AiYBywAAAAcDawGuABD///+6/foDQgWzAiYBxwAAAAcDawBzAIr//wCF/VMFdwUdACYBvwAAAAcCEwJaAJf////v/5YE0AT1AiYBwAAAAAcCEwIyAG/////v/5YFdgT1AiYBwQAAAAcCEwI0AG////+b/5YCKQXAAiYCBgAAAAcDY/9H/6b///+Z/5YCKQXAAiYCBgAAAAcDZP9s/6X//wBi/YYFogKQAiYB9wAAAAcDYwIM/Hb////Z/l0CIgSRACYCCAAAACcBe/95//4ABwNj/4X+d////+/+XQMFA+ICJgIMAAAAJgF7+f4ABwNjABr9yP//AGL9hgWiApICJgH3AAAABwNkAjP8d////9j+XQIiBJIAJgIIAAAAJwF7/3n//gAHA2T/q/53////7/5dAwUD5AImAgwAAAAmAXv5/gAHA2QAQP3J//8AYvsMBaIBQAImAfcAAAAHA2wBRveX////7/1KAcwDYgAmAggAAAAHA2wACPnV////7/1KAwUCNgImAgwAAAAHA2wAhvnV//////38A+IERwImAfYAAAAHA2P/q/4t//////38A+IESAImAfYAAAAHA2T/0v4t////2f+WAcwEkQAmAggAAAAHA2P/hf53////7/+WAwUD4gImAgwAAAAHA2MAGv3I//8AR/36BK4C/AAmAXbeAAAHA2MAE/zi////2P+WAcwEkgAmAggAAAAHA2T/q/53////7/+WAwUD5AImAgwAAAAHA2QAQP3J//8AR/36BK4C/AAmAXbeAAAHA2QAOvzh//8Ahf1TBXcDRAImAb8AAAAHA2wBrfrz////7/3JBNADHAImAcAAAAAHA2wCcvpU////7/0cBXYDHAImAcEAAAAHA2wBj/mn//8Ai/3oCEQFHgImAckAAAAHA2wExP8v////7/+WBNsFHgImAcoAAAAHA2wBrv8v////7/+WBXAFHgImAcsAAAAHA2wBxP8v//8Ai/3oCEQEXgImAckAAAAHAhkEuf+i////7/+WBNsEXgImAcoAAAAHAhkBo/+i////7/+WBXAEXgImAcsAAAAHAhkBuf+i//8Ai/+WBgcFXgImAecAAAAHAhYBJgCU////7/+WAy0GQAImAegAAAAHA2gCIgAx////7/+WA88GQAImAekAAAAHA2gCZgAx//8Ahf1TBXcDRAImAb8AAAAHAhMCRvxI////7/4dBNADHAImAcAAAAAHAhMB8fuO////7/4dBXYDHAImAcEAAAAHAhMB7/uO//8BPAEeAocEiwAHAGAAoAAA//8BDQAAAlsEiwAGAGFwAAACAIkAAANCBIsAGQAaAAATNDY3FhcXFjMyExcQISInFhUUBgcnAgInJiWJPDM7KgFPd7IaUv7kTzc3ChJOBGlmEQFLA/UpURxpbQQzAQsQ/lkZ3IhgnIsTAVkBicUfsv//AE0AAANOBIsABgBjsAAAAgCr//wDbATEACUAJgAAEzQ+AjcWFQ4CBwYHFhcXBgYVFBYzMjc3Fw4DIyA1NDcmJhOrM02QdwcBFyN7PTdT4jlwopJlbVgwFR85PkYr/qiXaJFhAuU1m2lrOxYaIT8tWy0zWyp6Q78/Kj8cDSQaPDMjz4DZKXIBzP//ALAAegL+BIsABgBlUAAAAgA4//0DTgShABgAGQAABSYCNTQ2NwYjIiYnNxYWMzI3FwYGFRQSFwEC1UxIFQ1WmlmyMC8xnD+zlhkWDU9N/koDvQFErDewOgwfFq0UHhQhV2U37v6ZmgQLAP//ACMAAAN7BIsABgBnEAD//wAmAAADgASLAAYAaBUAAAMAif/9AzsErwASAB0AHgAABSYCJwYjIiY1NDY2MzIWFRQSFwEiBhUUFjMyNzcCJQLDSj8GT0h4nFeFRHV7UFL+OzVgiW0lMgEX/q4DwAEPjhyee0unZs/gpP7IpQN9WTM5TQoBAQePAP//AGsAAANSBJwABgD0zgD//wBh//wDPAS2AAYCKLoA//8AYAAPA0IErgAGAPUAAP//AHoAAANPBIkABgD2AAAAAgBgAAADYQSpAB0AHgAAJRQGBwYjIiYnJiY1NBIANzY3FhUUBwACFRYWMzI2AQNhOzBj4VLKJQsGeAEvbTMzKTH+sdMntGxJ2f5/yU5YCxgUCy03LnYBAAGHfDpFKzs/O/5x/tQ3ExgRA84AAwBUA4wBoQYaABcAGAAZAAATNDcWFxcWMzI3FxQjIicWFRQHJyYmJyY3E1Q3HhUDGihZDSmOERMbDicEMjQIu5IFhiwfNTYJEoUI0whiTFVuCbO6Zw+i/tsAAwAtA4wBrgYbACsALAAtAAATNDcWFxYzMjUnNxYVFRYzMjU1JxcXFAYjIicGBiMiJyMVFhUUBycmJyYnJjcTLTgbGRcjOgMfDg8OLQEpBTMmFRwRIBYREwEaDCcCGBg3Cc6BBYcrHzFDEk0vCjMnBgZIDg4ENjtEDhoVCAFdUHBTCatZYHAQov7aAP///+/+2gLNBCgAJgILAAAAJwIHAYr/QwAHA2cCZgAA////7/+WAr8FIgAmAggAAAAHAgcBjAA9AAP/7/7aAGcDngALAAwADQAAMSI1NTQzMzIVFRQjExEREVESEhYRehERehEDnvs8AAP/UwToALYGDwAGAA0ADgAAEwYHJic2NwcGByYnNjc3tjEkQR4aQ1ksKUIcLi44BaRBITQkF0qxPSU0JCo2bwAEAAAFVQFtBuUABgANABYAFwAAAQYHJic2NwcGByYnNjc3BgcnJic2NxYnAW0xJEEeGkNjJy5CHC4uhy0kHS4QMiQaGgYKQSE0JBdKqjgqNCQqNmQ2GhUnFCwqIkAABAAABJoBawX4AAYADQAVABYAAAEGByYnNzcHBgcmJzY3NwYHJic2NxYnAWsGIEI6GhRWBiBFNgokox4MMkEhCiYmBXksUBEaQTuPL0wOGhdnblkRBh9NJBQyAAAGADcClAHeBSkAGQAgACcAMAAxADIAABMmNTQ2NxYXBxUXFTY2MzIWFRQGIyInNxYXBQYHJic2NwcGByYnNjc3MjY3JiMiBxYTA7gsJyUKCxAEMi8SJldrTn9iCx81AUgxJEEeGkOBLClCHC4ubCo9JzItN00qWisEDZ8PDyANKBUMGkwRKxlMGzxMPC0HCMhBITQkF0prPSU0JCo2fQ8QJ0IEAUz9awADAEMDdQGxBe8AIAAhACIAAAEmJiMiBhUUFxYWFQcmJyY1NDYzMhYXNjY3FxQGBwYGBwMDAQ0PQyMREzo0IicLLGM4Ox1AGBM4OAMQDyEgFjIMBNJJXxMOJ3drfj8KUFC2RDZ4RzwuQSkmGTQOHTAz/pACegAAAwBtAyMBVQRVAAcACAAJAAABBgcmJzY3FicTAVUlSVQmKFAXFwIDtDlERC0kVxlL/s4A////7/7aAcEFIgImAEAAAAAGAEs8AP///+/+2gHBBJsCJgBAAAAABgBOMgD////v/toBwQULAiYAQAAAAAYAT1oA////7/6fAcEDngImAEAAAAAHAFAAMv9+////7/7aAcEEvwImAEAAAAAGAFFGAP///+/+2gHBBMQCJgBAAAAABgN0WgAABAAgA5gA8QTEAAsAGAAZABoAABMiJjU0NjMyFhUUBjc0JiYjIgYVFBYzMjYHEYUtOD8oKUFDGhUhFhAjIh0YKEADrEIyOU1NOjBDcwkgFRoYGR0ceQEsAAP/7/+WA1wDYgAaABsAHAAAMSI1NTQzMzIkNyYnJjU0NjceAxUUBwYGBAEDEREe2AG3TRU1J0ZBCRoYEUc28P6ZAgjWEXoRJyRSj2ofLFwlPHZyai9HiSExHwNi/DQAAAP/7/+WBAoCNgAhACIAIwAAATIXBgcXFhYzMhUVFCMiJicHBgQjIjU1NDMyJDc2Njc3NicDAtIbFi80HDCUeRERksZCIhD+V4QREboBKh0VLykkEjs4AdIQcWkRHh0RehE7PS0TOBF6ERsUDkdPQiFk/WD//wCP/hUFyANEAiYAbgAAAAcF7QIFAGr//wCP/hUGrwJwAiYCCQAAAAcF7QKqAGr////x/hUCWQNiACYCCgIAAAYF7Wtq////7/4VAwUCNgImAgwAAAAHBe0AhABq//8AgP1QBPMExwImAC0AAAAnAXoBBADYAAcBeQGGAQH//wCF/VMFdwSbACYBvwAAACcBegEEAKwABwF5ATMA5P///+/+UgTQBHMCJgHAAAAAJwF6ANwAhAAHAXkBGv/z////7/5SBXYEcwImAcEAAAAnAXoA3gCEAAcBeQEY//P//wBX/5YFvwVeAiYANwAAAAcBegKHAOP//wBX/4IGVwVeAiYB1QAAAAcBegKGAOP////v/5YE4AVeAiYB1gAAAAcBegGnAPz////v/5YFKwVeAiYB1wAAAAcBegGqAPv//wCL/lIGYQXuAiYCAwAAACcBeQO6//MABwF8Av8B7P//AIv+UgatBTYCJgIOAAAAJwF8AzMBNAAHAXkDbf/z////7/5SAuUFSwImAw4AAAAnAXz/ugFJAAcBeQCC//P////v/lIDOwUTAiYCDQAAACcBfP/XAREABgF5GfP//wBE/EAExQRzAiYAbwAAACcBegFuAIQABwF5AOD94f//AET8QAVFBJgCJgIEAAAAJwF6AUUAqQAHAXkA4P3h////7/5SAvQFcQImAg8AAAAnAXr/2gGCAAYBeVzz////7/5SAzsEuQImAg0AAAAnAXr/4QDKAAYBeRnz//8ARP2EBMoFwgImAEQAAAAHA9ACaAAA//8ARP2EBN4FwgImAeoAAAAHA9ACaAAA////7P+WAgcFwgImAesAAAAGA84AAP///+//lgIYBcICJgHsAAAABgPOAAD//wCL/Y8DmgTgAiYARQAAAAcBfAAFAN7//wCL/Y8EYQTNACYB7QAAAAcBfABzAMv////v/4IDRQTNAiYB7gAAAAcBfAA4AMv////v/4IDcQTNAiYB7wAAAAcBfP/NAMv//wBE/EsErAK4AiYASQAAACcBewCl/ewABwIHAOD9t///AGL8TgWiAwECJgH3AAAAJwF7ALj97wAHAgcB9P4c////7/5dAoYFIwImAgoAAAAmAXvd/gAHAgcAzwA+////7/5dAwUD9wImAgwAAAAmAXv5/gAHAgcBAP8S//8ARPxLBKwDTQImAEkAAAAnAXsApf3sAAcBeAAJ/2v//wBi/E0FogKhAiYB9wAAACcBewC5/e4ABwF4ART+v////+/+XQKGBMMCJgIKAAAAJgF73f4ABwF4/+4A4f//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BxYWMzI+AjcuAyMiBgcmNTQ+AjMyFhc2NjcuAycuAzU0NjceAxcWFjMyNjcmJicmJichIiYnByIuAjU0NjcGBgceAxcWFhcWFjMyNjcmJjU0PgIzMhYXHgMzMzI+BDcmJicuAyMiDgIHJiY1ND4CMzIeAhcWFjMHJiYjIg4CBw4DIyMiJicHIiYnBgYjIiYnFhUUDgIjIi4CNTQ+AjcXBgYVFB4CMzI+AjcuAycuAzU0PgI3PgUzMhYXHgMzIS4DJzY2NxQeBBcVMzU0LgQ1JiY1ND4CNx4DFwcUHgQXMzI+Ajc+AzMyFhcGBgcWFjMyNjc2Njc+AzMyFwYGBxYWMzI2NzY2Nz4DMzIWFwYGBxYWMzI+AjcuAzU0PgI3FhYXFhYVFAYHBgYHIiYnBgYHDgMjIiYnBgYjIi4CJwYGIyMUFhUcAgYHBy4DJyMXAS4DJyYmNTQ+Ajc+AzcnNjY3HgMXFhYVFhYzMjY3LgMnNjY3HgMXFjMzMjY3JgInNjY3HgMXFAYHBiMiJicOAyMjIi4CJycAFhcUBw4DIyInBiMiJw4DIyIuAic3HgMzMj4CNy4DJy4DNTQ2Nx4DFxYWFx4DFzYzMjY3JgInNjY3FhYXARQeAhUUDgIHBy4DJyYmJzQmNTQ+AjceAxcAFhUUDgIHBzQuAicuAzU0NjceAxcHFhYXJBcuAycOAwcWFhcCFhcuAycOAwcWFhcAFhcuAycOAwcWFxMWFhcmJwYGBxYWARYWFRQOAiMiJicGBiMiJjU0NjcXBgYVFBYzMjY1NCY1Nx4DMzI2NyYnJjU0NgE2NjcWFhcGBgcmJickFhcGBgcmJic2NjcBHgMVFAYHJzQuAjU0NgIWFwYGByYmJzY2NxYWFwYGByYmJzY2NwoTChoOBSIvOBwOKy0oCggtIxEiEzJzRSwRFgcZIC4sNCUvTlFcPTdYJwsuPUklHzQWDipoWj0JCxsvFgcREBEHFCMWAwwLCQcMDgcCIRoTPURCGBIRFyQkKR4gWzYLFAkHDBAVDwsQBgwaEBxFLWSDXkgqJzkyMR4pOB0QFiUyHRkwFy4+EggNDA0IBhMUDiUfBhscFwMbQjA2VB0FDQgCBQL6NRo0EQ8qZ1o+CgsZMRYEDQ8SCgQKBRUnFhMkDgUEKD9MJRQfDQgaIisaa0VoTjw1NB8SIg4RJCcrFxkmHRcLCAoY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ACcB0QMfAAAABgHHAAD///+6/foJewSgACcBeATDAL4AJwHRAx8AAAAGAccAAP//AJz/lgNkBcICJgGxAAAABwBLAgYAAP///+/9gQSuBSMAJwIIAuIAAAAnAgcDQwA+ACYCDAAAAAcBhACV/7f////v/5YEIwUjACcCCAJXAAAAJwIHArgAPgAGAgsAAP///+/+UgcfBSMAJwIIBVMAAAAnAgcFtAA+ACYBwQAAAAcBeQEY//P////v/5YHHwUjACcCCAVTAAAAJwIHBbQAPgAGAcEAAP///+//lgcfBSMAJwIIBVMAAAAnAgcFtAA+ACYBwQAAAAcBeAD7AJv////v/4IFGgUjACcCCANOAAAAJwIHA68APgAGAe8AAP///+/9+gTYBSMAJwIIAwwAAAAnAgcDbQA+AAYB9QAA////7/5SBx8DYgAnAggFUwAAACcBeQTj//MAJgHBAAAABwF5ARj/8////+/+UgcfA2IAJwIIBVMAAAAnAXkE4//zAAYBwQAA////7/5SBx8EfQAnAggFUwAAACcBeQTj//MAJgHBAAAABwF4APsAm////+/+UgUaA2IAJwIIA04AAAAnAXkC3v/zAAYB7wAA////7/36BNgDxgAnAggDDAAAACcBeQKc//MABgH1AAD////v/lIHgwS5ACcBegS3AMoAJwIIBVMAAAAmAcEAAAAHAXkBGP/z////7/+WB4MEuQAnAXoEtwDKACcCCAVTAAAABgHBAAD////v/5YHgwS5ACcBegS3AMoAJwIIBVMAAAAmAcEAAAAHAXgA+wCb////7/+CBX4EuQAnAXoCsgDKACcCCANOAAAABgHvAAD////v/foFPAS5ACcBegJwAMoAJwIIAwwAAAAGAfUAAP///+//ggVvBRMAJwIIA04AAAAnAXwCqAERAAYB7wAA////7/5SCiMDHAAnAcAFUwAAACcBeQZt//MABgHBAAD////v/lIIHgMcACcBwANOAAAAJwF5BGj/8wAGAe8AAP///+/+UgojAxwAJwHABVMAAAAmAcEAAAAHAXkBGP/z////7/+CCB4DHAAnAcADTgAAAAYB7wAA////7/5SCiMEfQAnAcAFUwAAACcBeAZMAJsAJgHBAAAABwF5ARj/8////+//gggeBH0AJwHAA04AAAAnAXgERwCbAAYB7wAA////7/5SCi4DHAAnAcoFUwAAACYBwQAAAAcBeQEY//P////v/5YKLgMcACcBygVTAAAABgHBAAD////v/5YKLgR9ACcBygVTAAAAJgHBAAAABwF4APsAm////+//gggpAxwAJwHKA04AAAAGAe8AAP///+//lgsSAz8AJwHQBVMAAAAGAcEAAP///+//lgsSBH0AJwHQBVMAAAAmAcEAAAAHAXgA+wCb////7/+CCQ0DPwAnAdADTgAAAAYB7wAA////7/5SCxIEoAAnAdAFUwAAACcBeAb4AL4AJgHBAAAABwF5ARj/8////+//lgsSBKAAJwHQBVMAAAAnAXgG+AC+AAYBwQAA////7/+WCxIEoAAnAdAFUwAAACcBeAb4AL4AJgHBAAAABwF4APsAm////+//ggkNBKAAJwHQA04AAAAnAXgE8gC+AAYB7wAA////7/+WCjMFXgAnAdYFUwAAAAYBwQAA////7/+CCC4FXgAnAdYDTgAAACcBeAUSARMABgHvAAD////v/lIJKQNiACcB3AVTAAAAJgHBAAAABwF5ARj/8////+//ggckA2IAJwHcA04AAAAGAe8AAP///+/+UgkpBMMAJwHcBVMAAAAnAXgFbwDhACYBwQAAAAcBeQEY//P////v/4IHJATDACcB3ANOAAAAJwF4A2oA4QAGAe8AAP///+/+UghHBXsAJwIPBVMAAAAnAXgFSgGZACYBwQAAAAcBeQEY//P////v/5YIRwV7ACcCDwVTAAAAJwF4BUoBmQAGAcEAAP///+//lghHBXsAJwIPBVMAAAAnAXgFSgGZACYBwQAAAAcBeAD7AJv////v/4IGQgV7ACcCDwNOAAAAJwF4A0UBmQAGAe8AAP///+//lghHBXEAJwIPBVMAAAAnAXoFLQGCAAYBwQAA////7/+CBkIFcQAnAg8DTgAAACcBegMoAYIABgHvAAD////v/lIIgAU8ACcB6AVTAAAAJgHBAAAABwF5ARj/8////+//lgiABTwAJwHoBVMAAAAGAcEAAP///+//lgiABTwAJwHoBVMAAAAmAcEAAAAHAXgA+wCb////7/+WBSIFwgAnAegB9QAAAAYB7AAA////7/+CBnsFPAAnAegDTgAAAAYB7wAA////7/5SBo0FwgAnAesFUwAAACYBwQAAAAcBeQEY//P////v/5YGjQXCACcB6wVTAAAABgHBAAD////v/5YGjQXCACcB6wVTAAAAJgHBAAAABwF4APsAm////+//ggSIBcIAJwHrA04AAAAGAe8AAP///+/9+gRGBcIAJwHrAwwAAAAGAfUAAP///+/+UgiYAxwAJwHuBVMAAAAmAcEAAAAHAXkBGP/z////7/+CCJgDHAAnAe4FUwAAAAYBwQAA////7/+CCJgEfQAnAe4FUwAAACYBwQAAAAcBeAD7AJv////v/4IGkwMcACcB7gNOAAAABgHvAAD////v/lIHHwTDACcCCAVTAAAAJwF4BNQA4QAmAcEAAAAHAXkBGP/z////7/+WBx8EwwAnAggFUwAAACcBeATUAOEABgHBAAD////v/5YHHwTDACcCCAVTAAAAJwF4BNQA4QAmAcEAAAAHAXgA+wCb////7/+CBRoEwwAnAggDTgAAACcBeALPAOEABgHvAAD////v/foE2ATDACcCCAMMAAAAJwF4Ao0A4QAGAfUAAP///+/+Ugj6A9sAJwH0BVMAAAAmAcEAAAAHAXkBGP/z////7/9uBvUD2wAnAfQDTgAAAAYB7wAA////7/9uBFwFWgImAfQAAAAHAHAEEAAA////7/5SB9kDYgAnAgoFUwAAACcBewUw//4AJgHBAAAABwF5ARj/8////+/+XQfZA2IAJwIKBVMAAAAnAXsFMP/+AAYBwQAA////7/5dB9kEfQAnAgoFUwAAACcBewUw//4AJgHBAAAABwF4APsAm////+/+XQXUA2IAJwIKA04AAAAnAXsDK//+AAYB7wAA////7/36BZIDxgAnAgoDDAAAACcBewLp//4ABgH1AAD////v/lIKLgRVACcBygVTAAAAJwF8BkgAUwAmAcEAAAAHAXkBGP/z////7/+WCi4EVQAnAcoFUwAAACcBfAZIAFMABgHBAAD////v/5YKLgR9ACcBygVTAAAAJwF8BkgAUwAmAcEAAAAHAXgA+wCb////7/+CCCkEVQAnAcoDTgAAACcBfARDAFMABgHvAAD////v/foH5wPGACcBygMMAAAABgH1AAD////v/foH5wRVACcBygMMAAAAJwF8BAEAUwAGAfUAAP///+//ggguBV4AJwHWA04AAAAGAe8AAP//AJz/lgPSBcIAJwIIAgYAAAAnAgcCZwA+AAYBsQAA//8Ai/+W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AAD//wBi/E0KTwMcACcBwAV/AAAAJgH3AAAABwF7ALn97v//AGL9hgpPAxwAJwHABX8AAAAnAXkGmf/zAAYB9wAA//8AYvxNCk8DHAAnAcAFfwAAACcBeQaZ//MAJgH3AAAABwF7ALn97v//AGL9hgpPBH0AJwHABX8AAAAnAXgGeACbAAYB9wAA//8AYvxNCk8EfQAnAcAFfwAAACcBeAZ4AJsAJgH3AAAABwF7ALn97v//AGL9hgs+Az8AJwHQBX8AAAAGAfcAAP//AGL8TQs+Az8AJwHQBX8AAAAmAfcAAAAHAXsAuf3u//8AYv2GCz4EoAAnAdAFfwAAACcBeAcjAL4ABgH3AAD//wBi/E0LPgSgACcB0AV/AAAAJwF4ByMAvgAmAfcAAAAHAXsAuf3u//8Ahf1TCioEWAAnAcoFTwAAACcBfAZFAFYAJgG/AAAABwF5ATMA5P//AIX9UwouBFgAJwHKBVMAAAAnAXwGSQBWAAYBvwAA//8Ahf1TCioEpQAnAcoFTwAAACcBfAZFAFYAJgG/AAAABwF4ASEAw///AIv9jwkUBFgAJwHKBDkAAAAnAXwFLwBWAAYB7QAA////uv36B/oEVQAnAcoDHwAAACcBfAQVAFMABgHHAAD///+6/foH+gMeACcBygMfAAAABgHHAAD///+6/foI3gM/ACcB0AMfAAAABgHHAAD///+6/foI3gSgACcB0AMfAAAAJwF4BMMAvgAGAccAAP//AJ3/lgNFBcICJgAnAAAABwBLAecAAP///+//ggXHA/cAJwILA04AAAAnAgcDwv8SAAYB7wAA////7/36BYUD9wAnAgsDDAAAACcCBwOA/xIABgH1AAD////v/lIFxwMcACcCCwNOAAAAJwF5AzX/8wAGAe8AAP///+/9+gWFA8YAJwILAwwAAAAnAXkC8//zAAYB9QAA////7/+CBlMDjQAnAgwDTgAAACcBegNR/54ABgHvAAD////v/foGEQPGACcCDAMMAAAAJwF6Aw//ngAGAfUAAP///+//ggZTA+cAJwIMA04AAAAnAXwDR//lAAYB7wAA////7/36BhED5wAnAgwDDAAAACcBfAMF/+UABgH1AAD////v/4IIvgMcACcBywNOAAAABgHvAAD////v/foIfAPGACcBywMMAAAABgH1AAD////v/4IIvgRR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ACcBywrSAAAAJwHBBX8AAAAnAXgGegCbACYB9wAAAAcBewC5/e7//wBi/E0NSwOXACcCCwrSAAAAJwF4Cmb/tQAnAcEFfwAAACcBeQaX//MAJgH3AAAABwF7ALn97v///+/+UgrRBLkAJwF6CAUAygAnAggIoQAAACcBwQNOAAAAJwF5BGb/8wAGAe8AAP///+/+UgzWBLkAJwF6CgoAygAnAggKpgAAACcBwQVTAAAAJgHBAAAABwF5ARj/8////+//ggrRBLkAJwF6CAUAygAnAggIoQAAACcBwQNOAAAABgHvAAD////v/4IK0QS5ACcBeggFAMoAJwIICKEAAAAnAcEDTgAAACcBeARJAJsABgHvAAD////v/lIK0QS5ACcBeggFAMoAJwIICKEAAAAnAe8FUwAAACYBwQAAAAcBeQEY//P////v/4IK0QS5ACcBeggFAMoAJwIICKEAAAAnAe8FUwAAAAYBwQAA////7/+CCtEEuQAnAXoIBQDKACcCCAihAAAAJwHvBVMAAAAmAcEAAAAHAXgA+wCb////7/5SDXEDHAAnAcAIoQAAACcBeQm7//MAJwHvBVMAAAAGAcEAAP///+/+Ug+BAxwAJwHKCqYAAAAnAcEFUwAAACYBwQAAAAcBeQEY//P////v/lIPgQMcACcBygqmAAAAJwHBBVMAAAAnAXkGa//zAAYBwQAA////7/+CDXwDHAAnAcoIoQAAACcB7wVTAAAABgHBAAD////v/lINfAMcACcBygihAAAAJwHvBVMAAAAmAcEAAAAHAXkBGP/z////7/+CC3cDHAAnAcoGnAAAACcB7wNOAAAABgHvAAD////v/5YQZQM/ACcB0AqmAAAAJwHBBVMAAAAGAcEAAP///+//gg18BFQAJwHKCKEAAAAnAXwJlgBSACcBwQNOAAAABgHvAAD////v/4INfAR9ACcBygihAAAAJwF8CZYAUwAnAe8FUwAAACYBwQAAAAcBeAD7AJv////v/4ILdwRZACcBygacAAAAJwF8B5IAVwAnAe8DTgAAAAYB7wAA////7/+CDmAEoAAnAdAIoQAAACcBeApFAL4AJwHBA04AAAAnAXgESQCbAAYB7wAA////7/+CDYEFXgAnAdYIoQAAACcB7wVTAAAABgHBAAD////v/4ILfAVeACcB1gacAAAAJwHvA04AAAAGAe8AAP///+//ggpyA2IAJwHcBpwAAAAnAe8DTgAAAAYB7wAA////7/+CC5UFewAnAg8IoQAAACcBeAiYAZkAJwHBA04AAAAnAXgESQCbAAYB7wAA////7/5SC+AFwgAnAesKpgAAACcBwQVTAAAAJwF5Bmv/8wAmAcEAAAAHAXkBGP/z////7/+CCdsFwgAnAesIoQAAACcBwQNOAAAAJwF4BEkAmwAGAe8AAP///+//ggnbBcIAJwHrCKEAAAAnAe8FUwAAAAYBwQAA////7/5SDesDHAAnAe4KpgAAACcBwQVTAAAAJgHBAAAABwF5ARj/8////+//ggvmAxwAJwHuCKEAAAAnAcEDTgAAAAYB7wAA////7/5SDesDHAAnAe4KpgAAACcBwQVTAAAAJwF5Bmv/8wAGAcEAAP///+/+UgvmAxwAJwHuCKEAAAAnAcEDTgAAACcBeQRm//MABgHvAAD////v/lIN6wR9ACcB7gqmAAAAJwHBBVMAAAAnAXgGTgCbACYBwQAAAAcBeQEY//P////v/4IL5gR9ACcB7gihAAAAJwHBA04AAAAnAXgESQCbAAYB7wAA////7/5SDesEfQAnAe4KpgAAACcBwQVTAAAAJwF5Bmv/8wAmAcEAAAAHAXgA+wCb////7/5SDEgD2wAnAfQIoQAAACcB7wVTAAAAJgHBAAAABwF5ARj/8////+//bgpDA9sAJwH0BpwAAAAnAe8DTgAAAAYB7wAA////7/+CCm0EwwAnAggIoQAAACcBeAgiAOEAJwHBA04AAAAGAe8AAP///+/+UgptBMMAJwIICKEAAAAnAXgIIgDhACcBwQNOAAAAJwF5BGb/8wAGAe8AAP///+/+XQkiA2IAJwIKBpwAAAAnAXsGef/+ACcB7wNOAAAABgHvAAD////v/4ILlQVxACcCDwihAAAAJwF6CHsBggAnAe8FUwAAAAYBwQAA////7/+CCdsFwgAnAesIoQAAACcBwQNOAAAABgHvAAD////v/lIMcgTDACcCCAqmAAAAJwF4CicA4QAnAcEFUwAAACcBeQZr//MABgHBAAD////v/lIJ2wXCACcB6wihAAAAJwHBA04AAAAnAXkEZv/zAAYB7wAA////7/+CCckFPAAnAegGnAAAACcB7wNOAAAABgHvAAD////v/lIMdwNiACcB3AihAAAAJwHBA04AAAAnAXkEZv/zAAYB7wAA////7/+CDFsDPwAnAdAGnAAAACcB7wNOAAAABgHvAAD////v/toBwQWFAiYAQAAAAAYCJWIU////7/7aAcEGIgImAEAAAAAGAiZlC////+/+2gHBBYICJgBAAAAABwInAEYAvgACAGT/7AQvBc0ACwAXAAABEAIjIgIREBIzMhIBEBIzMhIREAIjIgIEL/H27vbt9+75/OqRnqCRkaCgjwLd/oP+jAF/AXIBfgFy/oD+kP7C/uYBIQE3ATQBIv7kAAEAtgAAAtcFtgALAAAhIxE0NwYHBgcnATMC17AIHCBmeV4BjJUD/oh0HhpVY3kBMwAAAQBiAAAEKQXLABoAACEhNQE+AjU0JiMiBgcnNjMyFhUUBgYHARUhBCn8OQF/rXA3inhaoWVgzfPM70aMpf7PAuOWAYOvloxRdII8T3ms0bRgs7mh/tMIAAEAXP/sBB8FywAnAAABFAYHFRYWFRQEISImJzUWFjMgERAhIzUzMjY1NCYjIgYHJzY2MzIWA/Kdkq+t/t7+8XTDW13UYwFy/meOkKzCjX1hpWtaWuuE1u8EYIy0HggWtJDR4yItqC4yASEBApmTgml2NUZ7R1HDAAIAKwAABGoFvgAKABMAAAEjESMRITUBMxEzIRE0NyMGBgcBBGrUr/1EArC71P59CwkLNxb+SgFM/rQBTJkD2fwwAcyJuxpoHv2QAAABAIH/7AQfBbYAGgAAATIEFRQAISInNRYWMzI2NRAhIgcnEyEVIQM2AjPlAQf+3v7/9YZK0GOsvP6SdoRaNwLd/b0jcwOB5sjk/v1Pqiw0pJgBKB45ArKk/lgXAAIAcf/sBDMFywAWACQAABMQITIXFSYjIgIDMzYzMhYVFAIjIiYCATI2NTQmIyIGBhUUFhZxAp10QUxl6fcNDG7sxuL615bhegHvi5aSiVeRV1COAnEDWhOZGP7k/sys8Mzj/viYASX+2rKikp1IgERkr2QAAQBaAAAELwW2AAYAACEBITUhFQEBFwJY/OsD1f2uBRKki/rVAAADAGT/7AQtBcsAFgAiAC8AAAEyFhUUBgcWFhUUBCMiJDU0JSYmNTQ2AxQWMzI2NTQmJwYGASIGFRQWFhc2NjU0JgJIyO6FkrGV/v7d6v8AAS+IeO9upZGPpJy4kYQBMnaMNmZwiXOOBcu6pG6uS1a7erbZzL36jU60cZ+9+6h0hId3YJZDPpgDXXBjP2BMLzmIWWRvAAACAGb/7AQpBcsAFwAlAAABECEiJzUWMzI2NjcjBiMiJjU0EjMyFhIBIgYVFBYzMjY2NTQmJgQp/WB0RE1no9RvCA1w7MHj/tWW4Xn+EIiYj4lalFRPjgNG/KYUmhuD+9Cq68/iAQyZ/tsBJrKikptJfEVkrmUAAwAc/uwB5wKhAAsAFQAWAAATFBYzMjY1NCYjIgYFECMiJjUQMzIWA4c5QEE7O0FAOQFg53Fz5HN05wE1g4KBhoSBgYT+kr2xAWq5/QQAAgA3/uwBYgKUAAoACwAAEzMRIxE0NwYGBycT9mxpBhYiXTPCApT9QwHENVwWHktQ/O8AAAIAI/7sAcUCowAYABkAAAUhNTc2NjU0JiMiBgcnNjMyFhUUDgIHIQMBw/5gqlwzNi0tSCY0YHFfaxImO68BINApWLhiWzc0NScgS1tpWSU/QUm3/rAAAgAZ/uwB2QKjACEAIgAAARQHFhUUBiMiJzUWMzI1NCMjNTMyNjU0JiMiByc2NjMyFgMBxm2AhHttVGZdk6JUVEpFOC9LWTU1aDpicdEB7nktJIRlci9nOH1wWz40LzU+SywlYfyqAAADAA7+7AH3ApgACgARABIAACUjFSM1ITUBMxEzIzU0NwYHBxMB91pv/uABI2xayQUGQXacdJ2dVQHP/j6ZVVAOcMD+FgAAAgAs/usB2AKUAB4AHwAAEzIWFRQGIyImJzUWFjMyNjU0JiMiBgcmJxMhFSEHNhPwaX98eTVlHShlJ0JPTkcnNhcUGRgBZv7vDS8tAZF2Y3J+GBNtGx5BRz9EDgYTDgFVWrMK/VoAAwAe/uwB6gKhABYAIgAjAAATECEyFxUmIyIGBzM2NjMyFhUUBiMiJhcyNjU0JiMiBhUUFhMeAT41Iyc3ZWoIBRVQPVhseWZvfuo4Rj47OVFMPAEEAZ0MYRB4gyMvdmVyhalLSUw+RkQwSF3+xQACACn+7AHdApQABgAHAAAXEyE1IRUDF3X6/roBtPweKQJaY1D9k+sABAAl/uwB4AKhABUAIgAtAC4AAAEyFhUUBxYVFAYjIiY1NDY3JiY1NDYDFBYzMjY1NCYnJwYGEyIGFRQXNjY1NCYDAQNbbWuAemNrczU8MytzIjo9PzpBORMxMnkwNGcrNzYuAqFeU2g9O31bb2lcN1wkI0s4UmT97S86Oi8wPhUIGUMBii8sSC0SNywsL/ylAAADABn+7AHlAqMAFQAhACIAAAEUBiMiJzUWMzI3IwYjIiY1NDYzMhYnIgYVFBYzMjY1NCYDAeWgmjkkIEPFEAg0Zl5tfGNuf+04Qzs9PE5JOwFs18wMYxH+UXZobIWkRk1BP0lFLU1X/KcAAwFl/akB+P/4AA0ADgAPAAAFFhYVFAYHJzQnJjU0NhMTAc8YESAsES0JPAsjJmd/Rk5vNAXBoR4XLUT93wJPAAIAk//jAZEFtgADAA8AAAEjAzMDNDYzMhYVFAYjIiYBTnUz2+5BPj5BQzw9QgGcBBr6uUJHSUBATEoAAAEAk//jAZEA+AALAAA3NDYzMhYVFAYjIiaTQTw9REQ9O0JvQkdHQkFLSgAAAQBU/vgBiQDuAAYAACUXBgMjNjcBew43eYVBJe4X1v73+vwAAgB4ALoDFANGAAoAFQAAJQYjIicDExcDFxYFBiMiJwMTFwMXFgMULTYpGLX0QrRiOP75LTYpGLTzQrRjR+40HQEMAWNA/ut4R0Q0HQEMAWNA/ut4WQACADwApALYAzEACwAWAAATNjMWHwIDJxMnJjc2MxYXEwMnEycmPC41KhdFb/NCtDFa9y41Kxe080O1YzgC/TQBHWSn/pxBARU8cFc0AR3+9f6cQQEVeUYAAgCBALoDEwNGAA4AHQAAJQYGIyImNTQ2NxcGFRQWBQYGIyImNTQ2NxcGFRQWAdAPNxpijYVlQqxwAaIPNxpijYVlQqxw7hcdrnJeyEZAgI9TjycXHa5yXshGQICPU48AAgA8AKUCzgMxAA4AHQAAATY2MzIWFRQGByc2NTQmJTY2MzIWFRQGByc2NTQmAX8PNxpijYBqQqxw/l4PNxpijYBqQqxwAv0XHa5yXMVLQICPU48nFx2uclzFS0CAj1OPAAADADz9qwGn/ywAFQAWABcAAAUWFhUUDgIHBgcmJic3NzIWFhc2NgMDAXsRGw8bJhYmPiRKMyAfHy07Gws+TBvyAh0bDR00U0MXCk6URQgFKGdBOpf+twGBAAADADz9qwGn/y0AFQAWABcAABMmJjU0PgI3NjcWFwYGIyInJicGBhcDaBEbDxsmFyk7VUsOIBAoGTExCTxyNf2/Ah0cDB00VEIZCb1qAwofOHo4kjcBggAAAQCMAAAC5gI+ABgAACEiJDU0NjczDgMVFB4CMzMyFhUVFCMCgPH+/RQISQIDAQEhYLCQKgsGEa6vVHEcCB0eGwdCdFUyCgd6EQABAFIAAAJCAKAAAwAAMzUhFVIB8KCgAAABAFIAAAJCAKAAAwAAMzUhFVIB8KCgAAABAJz++AHRAO4ACQAAJRYWFxcjJiYnNwFqDScWHYU+WBoO7lTNWnuJ7mgXAAIAmP74AeUEZgAJABUAACUWFhcXIyYCJzcSJjU0NjMyFhUUBiMBfQ4hHRyHMWIdDidLSzY1SEg17luneXtuAQRtFwJiQUpMPz9MSkEA//8Aaf36DAoFwgAnAewEVgAAACcB0AZLAAAABgF2AAD//wBp/foJPwXCACcB7ARWAAAAJgF2AAAAJwIPBksAAAAHAXoGJQGC////uv36CdMFwgAnACcIZgAAACcB6AV4AAAAJgHHAAAAJwILAzQAAAAHAXkDG//z//8AKP+CD3UFuAAnAe4MMAAAACcB7wOsAAAAJgHF4gAAJwHBBxIAAAAnAE8MRAAXACcAUQSHADkAJwBOB9MAaQAHAE4ETwEd//8Abf2PDzQFwgAnAewHgAAAACcB0Al1AAAAJwHdBCQAAAAGAe3iAP//AET9hA7WBcIAJwAxDEQAAAAnAcoH+AAAACcB9gRMAAAABgBEAAD//wCL/l0MWgXCACcB3AiEAAAAJwHsBpAAAAAnAgwDogAAACcBewOa//4ABgHzAAD//wCL/Y8OFQXCACcBygZKAAAAJwBICr4AAAAnAewETAAAAAYB7QAA//8AYv2GDQQFwgAnAewFUAAAACcB0AdFAAAABgH3AAAAAAAAAA8AugADAAEECQAAAF4AAAADAAEECQABACIAXgADAAEECQACAA4AgAADAAEECQADAEgAjgADAAEECQAEACIAXgADAAEECQAFAB4A1gADAAEECQAGAB4A9AADAAEECQAHAEQBEgADAAEECQAIACoBVgADAAEECQAJACgBgAADAAEECQAKAGABqAADAAEECQALAD4CCAADAAEECQAMADwCRgADAAEECQANApYCggADAAEECQAOADQFGABDAG8AcAB5AHIAaQBnAGgAdAAgADIAMAAxADQAIABHAG8AbwBnAGwAZQAgAEkAbgBjAC4AIABBAGwAbAAgAFIAaQBnAGgAdABzACAAUgBlAHMAZQByAHYAZQBkAC4ATgBvAHQAbwAgAE4AYQBzAGsAaAAgAEEAcgBhAGIAaQBjAFIAZQBnAHUAbABhAHIATQBvAG4AbwB0AHkAcABlACAASQBtAGEAZwBpAG4AZwAgAC0AIABOAG8AdABvACAATgBhAHMAawBoACAAQQByAGEAYgBpAGMAVgBlAHIAcwBpAG8AbgAgADEALgAwADgAIAB1AGgATgBvAHQAbwBOAGEAcwBrAGgAQQByAGEAYgBpAGMATgBvAHQAbwAgAGkAcwAgAGEAIAB0AHIAYQBkAGUAbQBhAHIAawAgAG8AZgAgAEcAbwBvAGcAbABlACAASQBuAGMALgBNAG8AbgBvAHQAeQBwAGUAIABJAG0AYQBnAGkAbgBnACAASQBuAGMALgBNAG8AbgBvAHQAeQBwAGUAIABEAGUAcwBpAGcAbgAgAFQAZQBhAG0ARABhAHQAYQAgAHUAbgBoAGkAbgB0AGUAZAAuACAARABlAHMAaQBnAG4AZQBkACAAYgB5ACAATQBvAG4AbwB0AHkAcABlACAAZABlAHMAaQBnAG4AIAB0AGUAYQBtAC4AaAB0AHQAcAA6AC8ALwB3AHcAdwAuAGcAbwBvAGcAbABlAC4AYwBvAG0ALwBnAGUAdAAvAG4AbwB0AG8ALwBoAHQAdABwADoALwAvAHcAdwB3AC4AbQBvAG4AbwB0AHkAcABlAC4AYwBvAG0ALwBzAHQAdQBkAGkAbwBUAGgAaQBzACAARgBvAG4AdAAgAFMAbwBmAHQAdwBhAHIAZQAgAGkAcwAgAGwAaQBjAGUAbgBzAGUAZAAgAHUAbgBkAGUAcgAgAHQAaABlACAAUwBJAEwAIABPAHAAZQBuACAARgBvAG4AdAAgAEwAaQBjAGUAbgBzAGUALAAgAFYAZQByAHMAaQBvAG4AIAAxAC4AMQAuACAAVABoAGkAcwAgAEYAbwBuAHQAIABTAG8AZgB0AHcAYQByAGUAIABpAHMAIABkAGkAcwB0AHIAaQBiAHUAdABlAGQAIABvAG4AIABhAG4AIAAiAEEAUwAgAEkAUwAiACAAQgBBAFMASQBTACwAIABXAEkAVABIAE8AVQBUACAAVwBBAFIAUgBBAE4AVABJAEUAUwAgAE8AUgAgAEMATwBOAEQASQBUAEkATwBOAFMAIABPAEYAIABBAE4AWQAgAEsASQBOAEQALAAgAGUAaQB0AGgAZQByACAAZQB4AHAAcgBlAHMAcwAgAG8AcgAgAGkAbQBwAGwAaQBlAGQALgAgAFMAZQBlACAAdABoAGUAIABTAEkATAAgAE8AcABlAG4AIABGAG8AbgB0ACAATABpAGMAZQBuAHMAZQAgAGYAbwByACAAdABoAGUAIABzAHAAZQBjAGkAZgBpAGMAIABsAGEAbgBnAHUAYQBnAGUALAAgAHAAZQByAG0AaQBzAHMAaQBvAG4AcwAgAGEAbgBkACAAbABpAG0AaQB0AGEAdABpAG8AbgBzACAAZwBvAHYAZQByAG4AaQBuAGcAIAB5AG8AdQByACAAdQBzAGUAIABvAGYAIAB0AGgAaQBzACAARgBvAG4AdAAgAFMAbwBmAHQAdwBhAHIAZQAuAGgAdAB0AHAAOgAvAC8AcwBjAHIAaQBwAHQAcwAuAHMAaQBsAC4AbwByAGcALwBPAEYATAAAAAMAAAAAAAD/ZgBmAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAgAAv//AAMAAQAAAAwBhBbsGFIAAgA+AAcABwABAA0ADQABABAAEQABABIAHAADACAASgABAEsAUQADAFMAXwADAG4AbwABAHAAcAADAHEAcwABAHUA0wABANUA1QABANYA3AADAN0A3QABAN8A5AADAOUA5gABAOcA6AADAOoA7QADAO4A7wABAPoA/AABAP8BLwABATUBdwABAYgBmAABAaoB+gABAfsCAgACAgQCBAABAggCCQABAgsCCwABAg0CDwABAhECEgACAhQCFQABAhsCJwADAioCnQABAp4CqwACAqwDCQABAwoDCwACAxIDEwABAxQDFAADAxYDUwABA2UDZgABA3QDdAADA3cDnwABA6ADugADA74DzAADA9ED0QACA9UD1QABA9YD1wACA9gD2QABA9oD3AACA90D3QABA94D3wACA+AD4QABA+ID4wACA+QD5QABA+YD6AACA+kD6gABA+sD7AACA+0EBwABBAkECQABBc0FzQABBdsF5AADBe8F7wABBuQDcAfkB+oLgAtuE8gTjAfwCegTyBRECHQJ6Ah0B/YMvgf8CAINtAgICA4InggUCYgRDhTSCq4KrgyOCXAIVgo2CBoIIAgmCCwIMgxSDGQKrgg4Ck4IPg/oCEQTSgoACEoU3ghQEzIT4AhWCdAJjgy4CbgIaAhcDYoTvBU+E7wIYghoE/gT+AiGE6oIbgh0CHoJ3AiAE6oKNg7+CcQPQAiGCIwIkgiYCJ4NYA1gDLgLVhEOCKQIqgiwCLYOAgtQC8IS5AquCq4LmAquCq4Jdgi8CMIIyAjOCNQJfAjaCOAI5hA2COwI8gj4CPgLAgj+Cw4JBAkKCRAJFgkcEhgLmA7+CSIVAgkoCS4JNBOGEh4KTg9ACk4JOglACUYJWAlMCVgJUglSCVgJZAleCWQRFAlqCXAJdgsICXwNYAqKCYIJ0AmCCYgJjgmUDcYJmgmgCaYQ5BAGDLgVFAmsCbIJuAm+CcQJygnQCdYUVgrGE8gO/gncC6oKxgniCegJ6A1UCe4VPgn0FEQJ+hO8E7wKAAuACgYKDAoSEywMjhGmCh4KGAoeCiQOkhLMDeoS5AquCioKMAo2CjwS5AukEuQKQgpICk4KTg20ClQKWgpgCmYKbBMyCwIKcgp4Cq4Krgp+CoQKigqQCpYTSgqcCqINYA1gFNIKqAquCrQKugrACsYKzArSCtgK3grkCuoK8Ar2CvwSQgvmCwIL8gsICw4N5AsUCxoLUAsgE0QLmAsmCywLMhKoCzgLPhKoCzgLPhKoC0QLShKoEmYSbAzWC/ISzAtQFNILVhGUEpwSog7IDs4OvA7CDsgOzhKcC1wLYgtoDRALbgt0DLgLeguAC4YLjBKcEqILkguYC54LpAuqC7AMygzQDNYNCg0WDMQM0AzWC7YLvAvCC8gNkBLAEroNigvOC9QL2gvgC+YL7AvyC/gSThLMEqgL/gwEEqgMCg0EDBAMFg6SDBwMIhU+FMwMKAwuDDQMOgxADEYMTAxSDFgMXgxkDGoMcBM4DHAMdg7UDHYMfA0oD0ATegyIE4YMggyIDI4QSBCEEuQMlBKcEqITOBM+E/gMuAyaDMQMoAymDKwMsgy4DL4TyAzEDMoM0AzWDNwM5g+GD5AM8Az6EWIRbA0EDQoNEA0WDRwNIg0oDS4NOA1CDUgNYA1mDU4NVA1aDWANZg1sDXINcg14E9QTyA1+DYQNihJIEkgNkA2WDZwNog2oDvIN3g2uDbQNuhLqEEIQSA3ADcYOmA3MDdIN2A3eDeQN6g3wDfYN/A38EQ4OAg4IDg4OFA4aDiAOJg4sDjIOOA4+DkQOSg5QEhgOVg5cDuYOXA5iDmgSHg5uDnQOeg6AD1gOhhAqEBIOjA6SDpgOnhM4DqQRlBKcEqIOqhKcEqIOsBGgFPYOtg7ODrwOwg7IDs4O5g7sDvIO1A7aDuAO5g7sDvIO+A7+DwQPCg8QDxYPHA8iDygPLhH6DzQPOhPID0APRg9MD1IPWBMOE3oPXg9oD3IPfA+GD5APrg+4D5oPpA+uD7gPwg/MD9YP3A/iD+gP7hASD/QP+hAAEAYQDBASEBgQHhAkEEgQKhGsE4AThhLSEtgS3hAwEDYQPBLqEEIQSBKoEE4U9hJsEt4QVBBaEGAQZhB+EIQU3hBsEHIQeBB+EIQU3hCKEJAQlhCcEKIQqBGUEpwSohGUEpwSohCuELQTbhC6EMAQxhDMENIQ2BDeE4AQ5BDqEPAQ9hD8EQIRCBM4Ez4T+BEOERQRGhEgESYRLBEyETgRPhFEEUoRUBFWEVwRYhFsEXYRfBTAEYIRiBGOEZQSnBKiEZoRoBT2EaYRrBGyEbgRvhHEE1YRyhHQEqgR1hHcEeIR6BHuEfQR+hIAEgYSDBISE1YSGBIeEiQSKhIwEjYSPBJCEkgSSBJOEswS3hJUEloSYBKoEmYSbBJyEngSfhKEEooSkBKWEpwSohKoEq4StBK6EsASxhLMEtIS2BLeEuQS6hLwEyAS9hMCEvwTAhUIEwgTDhMUExoTIBMmEywTMhM4Ez4T+BNEE0oTUBNWE1wTYhNoE24TdBN6E4AThhOME5ITmBOeE6QTqhPmE6oTthOwE7YTvBPCE8gTvBPCE8gTzhPUE9oT4BPmE+wT8hREFAQT+BQEE/4T/hQEFT4UChQOFBIUFhVYFBoVRBQuFC4UHhQiFCYUKhQuFDIUNhVUFEQUShRSFFYUXBRkFG4UchR4FIAUhBSKFJIUlhScFKQUrhSyFLgVPhTAFRQUxhTSFMwU0hU+FNgU3hTkFOoU8BT2FPwVCBUCFQgVDhUUFTIVGhUgFSYVLBUyFTgVPhVEFUgVTBVkFVAVVBVYFVwVYBVkAAIAKgANAA0AAAARABwAAQAgAFEADQBTAF8APwBuAHMATAB1ANMAUgDVANwAsQDfAOgAuQDqAO8AwwD6APwAyQD/AS8AzAE1AWUA/QFnAWgBLgFqAWsBMAFtAXcBMgGIAZgBPQGqAgIBTgIEAgQBpwIIAgkBqAILAgsBqgINAg8BqwIRAhIBrgIUAhUBsAIbAicBsgIqAngBvwJ6AnsCDgJ9An4CEAKAAwsCEgMSAxQCngMWA1MCoQNlA2YC3wN0A3QC4QN3A7oC4gO+A8wDJgPRA9EDNQPVA9cDNgPZA98DOQPhA+MDQAPlA+gDQwPqBAcDRwQJBAkDZQXbBeQDZgACADMAQgACAEMARQACABgAGQACAC4AUQACABIAJAACABIALwACABEALwACADAATgACACEALgACABsAJQACAEQARgACAEYAXwACADUANwACADcAQQACAC8AOAACACsASAACADAAQgACACwANwACACAASwACAB4AKAACADAAMQACACYAJwACABAAEQACAA8AEAACAAkACgACABcAGAACAAAADQACAA0ADgACABIANQACABIAPgACABEAQAACABEAEgACACEANgACAEQAVwACACMAPQACACEAPQACABwAPwACABwAKQACACkATgACAB4AMAACABwAMQACAB4AOAACAB4APwACABsAPwACABoAPAACABoAJgACABoAMgACABsANAACAFAAWwACAEQAYAACAF8AeQACADUASgACADcAUAACAC0AOAACACwARgACAC0ARwACACwATgACACAAVQACACAAZAACAEsAZQACAC4AXgACAD0AUAACAC4APQACACYAMAACACYAPwACACgAMwACABwAHgACAB4AQgACAB4ANwACACIAQAACACIANAACACoAKwACADgAOQACACsAUAACACsAOwACACsAQwACADAASAACACsANgACAC4AQwACAC4ASgACACEAIwACACMAQQACACAAIgACAEcASAACABYAFwACAAAAFQACAB8AIAACABMAFAACAB0AHgACACAAIQACAAwADQACAB4ANQACABsAMgACAF8AagACAC4ASAACACEAPgACAD4AUAACAEIAVwACABwANQACABoAGwACAEYAZwACAC0AQAACAC0ASAACACsALgACACUALwACACQAMAACACgAOwACAB4ATAACAB4AQAACABsAOAACAEYAWAACAEYAeAACABsATQACAC8AUwACABEAKgACABEAPgACADAAXQACAC4AUgACACMAUAACACwALwACAEYAaQACAEYAXQACACAAWgACAAAAAQACABMANgACACcAOwACABgALQACAB4AMwACACcAQgACABkANQACAB8AOwACACcASgACABkAPQACABsALQACACgASQACABsAPAACACgATAACABoAPgACADUATgACADUAVgACACUARgACAC8AUAACACkAPgACADQASQACACkARQACADQAUAACACEARQACACMARwACACcASwACACUAQwACABYAGAACACkAKgACAGcAaQACAGQAZgACAB4AHwACAB8APQACACUAaQACAC8AVAACAC8ASAACAC8APwACAC8ASQACADwAPQACAC8ARwACABMAJQACABMAMAACAC8ATQACABIAMAACACcAMwACABgAJQACAB4AKwACACUANwACACgAOgACABoALAACACEAMwACACgAQQACACkANgACADQAQQACACkAKwACADkAQwACACsANQACAB8AIQACACEAKwACAE8AUQACAD4AQAACAEoATAACAFEAagACAEAAWQACAEwAZQACAEAAQgACACsALQACADYAOAACAEIATAACAC0ANwACADgAQgACADoAPAACADwARgACAD0APwACADUAPwACACkAMwACAC8AOQACACUAUAACACIAJAACACcAMQACABoAJAACACAAKgACACMAJQACAC4AMAACAD4APwACACoALAACACoAPwACABkALgACAB8ANAAEADUANwA4AEoABAAuADAAMQBDAAQANQA2ADcAVQAEAC4ALwAwAE4AAgA0ADYAAgAYABoAAgAnACgAAgAeACAAAgAtAC8AAgAzADUAAgAnACkABAA1ADcAOABbAAQALgAwADEAVAACABgAKgACABgANgACAEkASgACADkAOgACADIAMwACACsALAACACMAJAACAFcAWAACADUANgACAC0ALgACABMAPwACABIAQQACABIAEwACACwASgACADoAXAACADsATgACADMAVQACACgAQgACADkAVwACACsASQACADYAVAACADkAUgACACsARAACAB8AQgACAB8ALAACACwAUQACACEAOwACACEAQgACACMAOwACACIARAACACIALgACACIAOgACACMARAACAFsAZgACAEoAVQACAFYAYQACAE8AawACAD4AWgACAEoAZgACAGoAhAACAFkAcwACAGUAfwACAEAAVQACACsAQAACADYASwACAEIAWwACADgAUQACADwAVQACAD8AWAACACkAQgACADMAQAACACcANAACAC0AOgACAD8ASgACADkARAACAC0ASQACADYAQAACADYATwACADwAPgACADcAOQACACUAWgACAFAAagACAD0AbwACAE4AYQACADYASQACAD0ATgACACcANgACADEAOwACABYAIAACABsAJgACADEASgACABYALwACABsANQACAC8ASwACACwALQACABwANgACADIAPQACACQALwACACoANQACADEAUgACACQARQACAEEASwACACcAQAACADUATwACAEAAWgACADIANAACADcAQgACAEMATgACAE0AWAACADMAPgAEADUANwA4AGQABAAuADAAMQBdAAQANQA2ADcAZgAEAC4ALwAwAF8ABAA1ADcAOABVAAQALgAwADEATgAEADYANwA4AEIABAAvADAAMQA7AAQANgA3ADgAUQAEAC8AMAAxAEoABAA1ADYAOABSAAQALgAvADEASwACACEAOAACACMAOgACAGkAgAACADAARwACAGYAfQACABsANwACACIAPgACACUAPwACACsARQACADMATQACACcAQwACABkANgACAB8APAACAEMAVQACADMATwACACgAQAACABsAMwACACEAOQACACsAPQACADYASAACACkARgACACgAKQACAFEAcgACAEAAYQACAEwAbQACAD8AWQACACkAQwACADQATgACAD8AUQACACkAOwACADMASAACACcAPAACAC0AQgACADMAUAACACcARAACAC0ASgACADsAWAACACUAQgACADAAOgACACQALgACACwANgACAC4AOwACACIALwACACoANwACADoARAACACsAPgACACcAVQACABcARQACACAATgACACcASQACABcAOQACACAAQgACACMANQACACMAQAACAFEAYwACAEAAUgACAEwAXgACAC8AQgACAC8AOgACAC4ARgACADkATAACACwARAACACoARgACAFkAZAACAGUAcAACAGoAdQAEADUANgA3ADgABAAuAC8AMAAxAAIAJwBGAAIAKgBIAAIAKgBNAAIAGAA7AAIAHgBBAAIAOwA9AAIAOwBXAAIAJQBBAAIALABDAAIAMgBFAAIAOABLAAIALAA+AAIALABAAAIAMwBHAAIAMwBGAAIAOgBNAAIAKQBeAAIANABpAAIAUQCDAAIAQAByAAIATAB+AAIAIwBVAAIAOQBdAAIAKwBPAAIANgBaAAIAEwAsAAIAEwBAAAIALQBGAAIANABNAAIALABZAAIALQBaAAIANABhAAIAKgBOAAIAGAA8AAIAHwBDAAIALwAwAAIAGgAzAAIAGgBHAAIAIQBOAAIAHwBMAAIAKQBNAAIANABYAAIAUQB0AAIAQABjAAIATABvAAIAUQBoAAIAQABXAAIATABjAAIAJQBfAAIAJQAnAAIANAA3AAIANgA5AAIAKQBRAAIANABcAAIAIAA+AAIAGgA4AAIAGQAaAAIAIQA6AAIAJwA/AAIAGQAyAAIAHwA4AAIALwBBAAIAOQBLAAIAPQBJAAIALQA/AAIAMQBDAAIAPABOAAIATgBZAAIAPgBJAAIASABTAAIARgBSAAIASABUAAIAOwBGAAIAQQBMAAIAIwAmAAIALwAxAAIAFAAWAAIAJQA+AAIAMABJAAIAJAA9AAIALABFAAIAQwBhAAIAPwBdAAIALgBMAAIANABSAAIAQwBNAAIAPwBJAAIALgA4AAIANAA+AAIAOwA8AAIAQQBCAAIAPQA+AAIAPwBAAAIASgBeAAIAJQAmAAIAOgB1AAIAJgBMAAIACAAJAAIADgAPAAIALgAvAAIACwAWAAIASgBLAAIACQAVAAIAJAAlAAIAOgA7AAIACQAWAAIACAAXAAIAGwAcAAIAHAA8AAIAGwAeAAEACgABABEAAQAsAAEAQQABABsAAQArAAEAPAABADUAAQAxAAEAIQABAB0ABgA+AD8AQABBAEIAQwACABwAHQADAB4AHwAgAAEASAACAEsATAADAEgASQBKAAQASwBMAE0ATgABADgAAgA2ADcAAwA4ADkAOgABAEoAAgBMAE0AAwBKAEsATgABAH4AAgB9AH8AAwB8AH4AgAAEAHsAfQB/AIEAAQEEAAIBBwEIAAMBBAEFAQYAAgAzADQAAgAVABYAAgAjAC0AAgAjADwAAgAiAD0AAgA0AEYAAgA0AGAAAgAzAGIAAgA0AFcAAgA0AFEAAgAzAFEAAgA4AEMAAgA4AFIAAgA3AFMAAgA3ADgAAgAWAEIAAgAVAEQAAgAWADkAAgAWADMAAgAWACgAAgAVADMAAgAiACMAAQAWAAEACwABABkAAQASAAEAHwABACMAAQAHAAEALgABACIAVgApAKQArACkAKwApACsAKQArACkAKwApACsAKQArACkAKwApACsAKQArACkAKwAnACsAKQArAC0AMIAygDYANwA6gD+AQYBFAEcASoBLgE8AVABWAACAAsB+wICAAACEQISAAgCngKrAAoDCgMLABgD0QPRABoD1gPXABsD2gPcAB0D3gPfACAD4gPjACID5gPoACQD6wPsACcAAQAEAAECFQABAAQAAQISAAEABAABAnAAAgAGAAoAAQUUAAECigABAAQAAQSZAAIABgAKAAEDEQABBiIAAQAeAAIABgAKAAEEcgABCOQAAwAIAAwAEAABA1UAAQarAAEKAAABAAQAAQTiAAIABgAKAAEDQQABBoMAAQAEAAEEbQACAAYACgABAvMAAQXnAAEAHgACAAYACgABBTsAAQp2AAMACAAMABAAAQPsAAEH2AABC8QAAQAEAAEE3QACAAYACgABAz4AAQZ8AAIAKgASABsAAQAcABwAAgBLAEwAAQBNAE0AAgBOAE8AAQBQAFAAAgBRAFEAAQBTAFQAAQBVAFYAAgBXAFsAAQBcAFwAAgBdAF4AAQBfAF8AAgBwAHAAAQDWANwAAQDfAOIAAQDjAOMAAgDkAOQAAQDnAOgAAQDqAOoAAgDrAOwAAQDtAO0AAgIbAh8AAQIgAiEAAgIiAicAAQMUAxQAAQN0A3QAAQOgA6EAAQOiA6IAAgOjA6QAAQOlA6UAAgOmA6gAAQOpA6sAAgOsA60AAQOuA64AAgOvA7EAAQOyA7IAAgOzA7QAAQO1A7YAAgO3A7oAAQO+A8wAAwXbBeQAAwAAAAEAAAAKACAARgABYXJhYgAIAAQAAAAA//8AAgAAAAEAAm1hcmsADm1rbWsAHgAAAAYAAAABAAIAAwAEAAUAAAACAAYABwAIABIUMiSAJLImKieOKo4xOgAEAAAAAQAIAAEqiBQsAAErHAAMAtEFpAWsCYQFtAW8BcQFzAZsBdQGbBIsBdwF5AXsCaQJpAX0CMwF/AjUBgQHDAh8BxQIhAYMBhQGHAYkCQQJBAYsBjQGPAZEBkwSrAd0EswJFAkcCFQH7AmECYQSLAZUBlwGZAZsBmwJjAmMCYQGdAZ8EiwGhAaMEiwGlBIsBpwGpAmkCaQGrAmkCaQIxAjMCMwGtAa8CMwGxAbMBtQG3AbkCNQI1AjUCNQG7Ab0BvwHBAcMCHwHFAccByQHLAj8CPwHNAc8CPwHRAdMB1QJBAdcCQQHZAdsB3QHhAd8B4wHhAeEB4wHlAecB6QSzAkcB6wHtAkcB7wHxAfMB9QIVAfcB+QH7Af0B/wIBAgMCBQIHAgkCYQILAg0CDwJhAmECEQITAhUCFwIZAhsCHQIfAiECIwIlBIsCJwSLAikCKwSLAi0CLwJpAjECMwI1AjcCOQI7Aj0CPwI/AkECQQJBAkMCRQJHAkkCSwSzAk0CTwJRAmkCaQJTAlUCVwJZAlsCXQJfAmECYwJjAmUCZwJpAmsCbQJvAnECcwSNBF8EKQSNA8EEkQSNA8EEkQJ1AncCeQJ7An0CfwKBAoMChQSlBKcEqQKHAokCiwSBBIMEhQSBBIMEhQSBBIMEhQSBBIMEhQPLAo0CjwKRApMClQQrBH0EfwKXA20DbwKZA20DbwNrA20DbwKbAp0CnwKhAqMCpQKnAvUCqQKrAq0CrwR9BH8CsQKzArUCtwK5ArsEXQPBBJEEXwQpBF0DwQSRAr0CvwLBAwECwwLFAscDAQSNBF8EKQLJAwUENQQ3AssEOwQ9BIEEgwSFBIEEgwSFAs0DkwLPA8sC0QMpAtMDNQM3AzkEIwLVAtcDOwM9Az8C2QObAtsC3QLfAuEC4wLlAucC6QLrAu0DpQOhA6MDUwNVA1cC7wSvBLEDZQR9BH8EtQS3BLkD8wP1A/cDiQLxA4cC8wL1AvcDlwRdBF0DwQSRAvkEXwSNBCkD6wPnA+kC+wL9Av8DAQMBBGEEYQMDAwUDBwQ3AwkDCwMNAw8DEQMTAxUDFwMZAxsDHQMfA8sDywMhAyMDJQMnAykDKQMpAykDKwMtAy8DMQMzAzUDNwM5BCMEHwQhAzsDPQM/A0EDQwNFA0cDSQNLA00DTwNRA+cD6QPrA1MDVQNXA+cD6QPrA1kDWwNdA18DYQQrBH0EfwNjBH0EfwNlBH0EfwNnA2kDbwNrA2kDbwNrA20DbwNxA3MDdQN3A3kDewN9A38DgQS1A4MEuQOFA4sDhwOJA4sDjQOPA5EDkwOVA5cDmQObA50DnwOhA6MDpQOnA6kDqwOtA68EjQOxA7MDtQO3A7kEjQPBBJEDuwO9BDcDvwP7BNEEjQPBBJEDwwPFBBsElQSXA8cEgQSDBIUDyQPLA80DzwPRA9MD1QPXA9kD2wPdA98D4QPjA+UD5wPpA+sD5wPpA+sEKwR9BH8EKwR9BH8EKwR9BH8D7QPvA/ED8wP1A/cD+QP7A/0D/wQBBAMEBQQHBAkEtQS3BLkECwQNBA8EEQQTBBUEFwQZBBsEHQRdBB8EIQQjBCUEJwRdBF8EKQQrBH0EfwQrBH0EfwQtBC8EMQQzBDUENwQ5BDsEPQSBBIMEhQQ/BEEEQwRFBEcESQRLBE0ETwRRBFMEVQRXBFkEWwRdBF8EkQRhBGEEYwRlBGcEaQRrBG0EgQSDBIUEbwRxBHMEdQR3BHkEewR9BH8EgQSDBIUEhwSJBIsEjQSPBJEEkwSVBJcEmQSbBJ0EnwShBKMEpQSnBKkEqwStBK8EsQSzBLUEtwS5BLsEvQS/BMEEwwTFBMcEyQTLBM0EzwTRBNME1QTXBNkE2wUBBOsE8wT/BN0E3wThBQEFAQTjBOUE6wTnBOkE6wTtBO8E8QTzBPME9QT3BP8E+QT7BP0E/wUBAACAcAFewAzAAIB0wSmAEMAAgGlApsAPwACAPsGhgAkAAIA5gdHAC8AAgH5BKEASQACAYMDrgBOAAIBbgT/ADQAAgLiBIcANQACAuwE4AA8AAICuATRADkAAgG8BOEAKAACAXAEfwAlAAIEPwN7ACsAAgQ7BNwANwACAcsEGwAsAAIBywV8ADgAAgGHA6cARwACAZoDWABCAAIBowOeAEkAAgDLA54ADAACBL0FngA3AAIDJgMcADIAAgEXBu4ANQACAQYHXgA+AAIA+gXCABEAAgMnBScARwACAtEFYwA1AAIC4gSHAFcAAgLiBPYAPQACAukE7ABEAAICmgUwAE0AAgKgBaIAQQACArsFIQBIAAICAQVtAE4AAgG2BOsAMAACAb8FRQA3AAIBtgVaADgAAgG9BVAAPwACAbAE9wA/AAIBXQTVADMAAgFqBHUALQACAXMEzwA0AAIBcgTbADwAAgWBBAUAUAACBYUCpABEAAIFwQM/ADUAAgXABPAAUAACBD4FLABGAAIBygXMAEgAAgS9BZ4AQwACBMAF7gBGAAIEvgX5AE4AAgMiBGgAPgACAyUEuQBNAAIDGQR2ADIAAgHVBLgAVQACAdgFCQBkAAIB2QNYAEsAAgO+BM0AXgACAp4FLAA9AAICmgUsAD0AAgMXB1cAPwACAy0HIwAwAAIDMQdzAD8AAgIaAc8AHAACAlUDlABCAAICGQOAADcAAgIkA9sAKwACArgE0QBTAAIBOQVqAEAAAgE5BWkAQAACAW8E/gA0AAICDQMcACoAAgINAxwAOAACAfYE0wBEAAIB6wSuAFAAAgIJBTAAOwACAfAE1gBDAAICAwRzAD4AAgIMBM0ARQACAvUCgwA3AAIBjQOkAEgAAgIJBH0ANgACAfAC4wAhAAIBzwSkAEEAAgFaA6gAIAACAM8DhQAjAAIBYgOFAB4AAgGjBU4ANQACAVcE2AAyAAIFhARVAF8AAgW9BKAAQQACAccFfAA5AAICBwWWAEMAAgLrBOEASAACAuIEfQBQAAIC6QSQAEAAAgLVBOcAOwACArIExgBBAAICAgVtAEIAAgHAA5QAHAACAXQDHgAaAAIFggRgAGcAAgHBBXIAQQACAcIF4QBJAAIBrwZNAEEAAgTBBD0ALQACAtgEmgArAAIBwwSQAC8AAgHHAy8AJAACAhYDMAAoAAICUQUJAEwAAgH/BOcAQAACAVgFUAAtAAIBYASjADgAAgVpBNYAWAACBbIFOQB4AAIBoAWzAE0AAgL6BUkAUwACAGcFuQAqAAIAeAW6AD4AAgHjA7cASQACAfcDvABdAAIBpAHtAC4AAgICBJYALAACAWYElgA8AAIBeQSXAFAAAgK8A3AALAACBZYEygBpAAIFaAReAF0AAgHJBEMAWgACAmoDngAwAAIBBgbuADYAAgMgBKEAOgACAW4FlAAtAAIBnwRoADMAAgM5BCwASQACAYcFHgA8AAIBuAPyAEIAAgN3BEkATAACAVkFOwA+AAIB9gQPAEUAAgTyBUEAVgACAXkFVgBGAAIBlgUeAFAAAgHEBOsAMwACAc0FRQA6AAICCQVtAEUAAgGRBM8APAACAc0E9wBHAAICoAUgAEgAAgKoBSAASAACAh0BnQAlAAICWAN2AEsAAgG5BZAAQwACAdYB5AAWAAIA/gNiACgAAgHaAXgAKQACAkID+QBnAAIBSAP5AGQAAgHdAQAAHgACAZ0CwQA9AAIC3QUJAGkAAgHNBL8AVAACAdgE5ABIAAIB6wVBAD8AAgHuBN4ASQACAe8DLQA8AAIB0QTnAEcAAgDpBoYAJQACANQHRwAwAAIB2wSyAE0AAgHDAvcASgACAPsFIwA4AAIBDgP3AD4AAgHvBSYANwACAzsEIQBBAAICuASlAEMAAgKSBH0AQAACAcoE9QArAAIBjgR/AC0AAgK3BFgAWQACAtIEUQBlAAIF0QSgAEwAAgM7BKEAQgACBD4DewA6AAIDXwOTAC8AAgNiA5MAOgACBDsE3ABGAAIDWwT0ADsAAgNeBPQARgACAfoDYgA9AAIBtwNiACcAAgGxA2IAMgACAvMEhABIAAIBGQTDACQAAgHaA88AIwACAXAD2wAuAAIB1gPGAD4AAgL9Ay0ANAACAcwDOwAqAAIBtQOlADYAAgD0B14APwACAOgFwgASAAIDkgMBAEoAAgMyA8cAOgACARIEuQBOAAIDMgQ2AEIAAgGABSgANQACAbED/AA7AAICmgUFAFcAAgJyBN0ASQACAnQE3QBUAAICoAV2AEsAAgJ4BU4APQACAnsFTQBIAAICuwT1AFIAAgKTBM0ARAACApUEzQBPAAICCQVtAFEAAgHEBVoAOwACAcsFUABCAAIBewTVADsAAgGSAx4AIgACAYgEdQA1AAIBjwTaAEQAAgXJBAUAWwACArMEBQBKAAICyQQFAFYAAgXNAqQATwACArcCpAA+AAICzQKkAEoAAgXVAz8AQAACAz8DPwArAAIDPwM/ADYAAgXUBPAAWwACAz4E8ABGAAIDPgTxAFEAAgQ9BSwAVQACA14FRABKAAIDYQVEAFUAAgH5BRMAWAACAbYFEwBCAAIBsAUTAE0AAgTxBOYAPwACAY4FewAzAAIBlQTDADkAAgL5BI4AQAACAvwE3gBPAAIDHASKADwAAgITBIoALwACAh0EigA3AAIC2QS5AFoAAgLdA1gAUAACA38EkABpAAIANAUsADYAAgKVBSAASAACADAFLAA2AAIAIgUgAEMAAgMgB1cASgACAIcHVwAvAAIAhwdXADUAAgM4ByMAOwACAJ4HIwAgAAIAnwcjACYAAgM7B3MASgACAKEHcwAvAAIAoQd0ADUAAgGcBcIALAACAhkC/gA9AAIBKwOXACoAAgIZAv4AMQACARgEwwAkAAIBLwI2AEsAAgIcA04AQAACArkEpQBdAAICkAR9ADUAAgKSBHwAQAACAe8DLQAuAAIDxAE9ADIAAgM8BKAANwACAzsEoABOAAIF0QSgAFgAAgGzBMMAMwACAa0EwwA+AAIB9gTDAEkAAgGxBU4AOAACAXUE2AA6AAICJQWzAIAAAgFTBZUARwACASsFswB9AAICkANiABsAAgJpAjYAIgACARsFEwA/AAIBLgPnAEUAAgM7BCEATQACAzIDxwBVAAIBgAS5AEgAAgM4A9EAMgACAYoDYgAZAAIDJQQnAEAAAgFzBRkAMwACAosEcwBIAAICCQVtAFgAAgHOA5QAHwACAYMDHgAoAAIFygRgAHIAAgK0BGAAYQACAsoEYABtAAIB8AS5AFEAAgGtBLkAOwACAacEuQBGAAIB8AUoAFkAAgGtBSgAQwACAbgFKABOAAIB3gWUAFEAAgGbBZQAOwACAaYFlABGAAIE9QOFADMAAgGSBBoAJwACAZkDYgAtAAICMQR9ADoAAgH2BH0ALgACAYoEfQA2AAICNQMcAC4AAgH6AxwAIgACAY8DHAAqAAICGQL+AEQAAgGGBMMAOAACAbcDlwArAAICVATYAFUAAgFpBdkARQACAVkFcABOAAICAwSjAEkAAgEXBbcAOQACARQFTgBCAAIBdgVQADUAAgF+BKMAQAACBbEE1gBjAAICmwTWAFIAAgKxBNYAXgACAeUEhABCAAIB6wSOADoAAgFzBRkARgACAaQD7gA5AAICmAL3AEQAAgK2BFUAWQACAswEVQBlAAIFzARVAGoAAgDdBSMARgACAbkDOQBIAAIBLwI2AB4AAgLvBJsANQACApIC+gBDAAIBbQUcADIAAgGdA/EAOAACAqUClwA+AAIBEgS5ACwAAgGxA40AMwACAq4C8QBFAAIBGwUTADMAAgG6A+cAOgACBfgFOQCDAAIC4gU5AHIAAgL4BTkAfgACAb0FswBVAAIC9wUdAF0AAgLPBPUATwACAtEE9QBaAAIAVgXAACwAAgBnBcAAQAACAxsCkABFAAIAlASRAEYAAgEpA+IATQACAy4CkgBZAAIApgSSAFoAAgE7A+QAYQACAq8BQAAqAAIBHANiABgAAgIDBEIAMAACAJQEkQAzAAIBKQPiADoAAgEiAvwAOAACAKYEkgBHAAIBOwPkAE4AAgE1AvwATAACBcEFHgB0AAICqwUeAGMAAgLBBR4AbwACBbAEXgBoAAICmgReAFcAAgKwBF4AYwACAs0EQwBfAAIAZAScACUAAgBmBIoALwACArwDRAA2AAIClAMcACkAAgKWAxwANAACAiQEKAA+AAICJgUiADgAAgLsAzAAIQACAzwCcAAnAAIBjANiABkAAgG7AjYAHwACArIExwBBAAICsgSbAEsAAgKKBHMAPQACAowEcwBIAAIENQTSAD8AAgQ0BNIATgACA1UE6wBDAAIDWATqAE4AAgTABe4AUgACBPQFNgBOAAIBewVLAD4AAgGYBRMASAACAxwEcwBGAAIC8wSYAEgAAgGIBXEAOwACAY8EuQBBAAIDMgXCACMAAgM8BcIALwACAKIFwgAUAAIAogXCABwAAgHGBOAAPgACAjQEzQBJAAIB+QTNAD0AAgGOBM0ARQACAXoCnABhAAICjgMBAF0AAgFpBSMATAACAZoD9wBSAAIBoANNAE0AAgKrAqEASQACAYUEwwA4AAIBtwOXAD4AAgIZAx4AOwACAhkDHgBBAAICAwMcAD0AAgIDAy0APwACAw0DhQBKAAIC5Qd6ADwAAgL8B0YALQACAv8HlgA8AAIAhAWAAEYAAgCPBlgAYAACAKEF6ABXAAIAbwZCAFEAAgCDBLwAMwACA4UHVwBSAAIDnAcjAEMAAgOfB3MAUgACA6AFwgA3AAIAuAVoACgAAgDDBkAAQgACANUF0AA5AAIAowYpADMAAgCJBiwAKAACALcEpAAVAAIDAAXlACIABAAAAAEACAABHRQADAABEiYAsgACABsADQANAAAAEQARAAEAIABKAAIAbgBvAC0AcQBzAC8AdQDTADIA1QDVAJEA5QDmAJIA7gDvAJQA+gD8AJYA/wEvAJkBNQF3AMoBiAGYAQ0BqgH6AR4CBAIEAW8CCAIJAXACCwILAXICDQIPAXMCFAIVAXYCKgKdAXgCrAMJAewDEgMTAkoDFgNTAkwDZQNmAooDdwOfAowD7QQHArUECQQJAtAC0QWkBawFtAW8BewF7AfcBcQHzAXsB0QG1AdkB2QONA40DjQHHAccB7wHvAfsB+wGdAZ0DlQOVAd8B3wHlAXMB8wHzAfMBdQGjAaUB/QOtA7UB7QHBAfcB8wF3AdkBpQF7AXsBeQF7AfcB9wHzAdkB2QF9AX8B2QGBAdkBgwONA40DjQONA40DjQONAYUBhwGJAYkBxwGLAccBxwHHAe8B7wGNAY8BkQGTAe8B7wHvAZUBlwGZAZsBnQOVAd8BowGfAZ8BowGhAaMBpQGlAeUBpwHlAf0B/QGpAeUB5QHlAasBrQHlA60DrQOtAa8BsQHtAe0BswHtAc0DjQHBAcEBwQG1AfcBtwH3AfcB9wH3AfcB9wHzAbkB8wH3AbsBvQG/Ab8BwQHDAcUBxwHvAckBywHfAc0BzwHRAdMB0wHVAdcB2QONA40B2wHdAe8B+wHfAd8B3wHhAeMB5QHlAecDtQHpAesB7QHtA60B7wHvAfsDjQONAfsB7wONAfEB8QHzAfMB9QH3AfcB+QH5A40B+wH7Af0B/wNbAgECAwIFAgcCCQILAg0CDwIRAvEC8wNpAvEC8wNpAvECEwNpAk0CFQJLAk0CFQJLA48CFwIZA48CGwIdA48CHwIhA48CIwIlAicCywLLAssDVQNVAz0DeQN7Az0DeQKnAikCKwItAz0DeQKnAyUDJQJFAlEDMwM1As0CzwLRAi8CMQN3A3kDewNnA2cDZwNnAjMDZwI1AjcCOQODA4EDXQI7AukDWwNbA2cCPQNdA4MDgQNbAt0C2QLbAj8C8QODA2kC8QODA2kDjwJBAkMDjwNXA1kDjwNXA1kCywLLA1UDVQNxA3MDdQNxA3MDdQJ/AoECgwJ/AoECgwOXA5kDmwOXA5kDmwMBAwMC/wMBAwMC/wJNAk8CSwKXAk8CSwN3A3kDewOvA7EDswO3A7kDuwMlA4MDgQJFAs8CRwNnA10CSQPDAukClwODAvEDgQJLAk0CTwJRAlEDWwJTA1sDZwNnA10CVQJXAlkC8QLzA2kDjwNXA1kDjwNXA1kDjwNXA1kCWwJdAl0CywLLA1UCXwJhAmMCZQNVA1UCZwJpAmsCbQJvAnECcwJ1AncCeQJ7An0CfwKBAoMDlwOZA5sDAQMDAv8ChQKHAokCiwKNAo8CkQKTApUClwKXApkCmwKdAz0DeQN7A3cDeQN7Ap8DQQNDAz0DeQKnAqECowKlAz0DeQKnA68DsQOzA68DsQOzA68DsQOzAqkCqwKtAq8CsQKzArUCtwK5AyUDjwK7Ar0DZwK/AsECwwLFAscCyQMBAssDVQLNAs8C0QLTAtUC1wLZAtsC3QLhAuMC3wLhAuMC5QLnA8MC6QLrAu0C7wLxAvMDaQOPA1cDWQOPAvUC9wL5AvsC/QNxA3MDdQMBAwMC/wMBAwMDBQMBAwMDBQMHAwkDCwMNAw8DEQM9A3kDewM9A3kDewMTAxUDFwO3A7kDuwMZAxsDHQMfA8MDIQMlAycDIwMlAycDgQOvA7EDswNVA1U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AIcALAACAAD/qAA5AAIAAP5uAAgAAgAA/zQAHgACAK0AXAArAAIArQBcACMAAgAG/lEAJQAC/7r/EQBMAAIABf8gAAkAAv/5/wMADgAC//7+6gAuAAIA3//0ABUAAv/c/10ACAACAGv97gAbAAIAAP3xAB4AFQAsADQAPABEAEwAVABcAGQAbAB0AHwAhACMAJQAnACkAKwAtAC8AMQAzAACAA/+fgAKAAIA0P7uABMAAgCw/yEACQACAND+7AAcAAIAFv3nAA0AAgAA/T4ADQACAMj/AAAtAAIAmf3wADoAAv/9/TAACQACAB79YgAfAAIAvP4LACwAAgC5/mgAJAACAGD9bQAmAAIAfv1MACYAAgAI/gQACAACAAn+GAAPAAL/+P2/AC8AAgCw/jQACQACABX9ugAXAAL/zv90ABwAAgAA/5oAGwABAAAACgCWASoAAmFyYWIADmxhdG4AgAAcAARGQVIgADBLU0ggAFxTTkQgAEZVUkQgAFwAAP//AAcAAAABAAIAAwAIAAkACgAA//8ACAAAAAEAAgADAAgACQAFAAoAAP//AAgAAAABAAIAAwAIAAkABgAKAAD//wAIAAAAAQACAAMACAAJAAQACgAEAAAAAP//AAEABwALY2NtcABEZmluYQBUaW5pdABabGlnYQBgbG9jbABobG9jbABubG9jbAB0bG9jbAB6bWVkaQCAcmxpZwCGdG51bQCOAAAABgAAAAEAAgAPABMAFAAAAAEAAwAAAAEABAAAAAIACgAWAAAAAQALAAAAAQANAAAAAQAMAAAAAQAVAAAAAQAFAAAAAgAGAAcAAAABAA4AFwAwAFYBigGsA9oFBgbqCBQI8gk8CYYJrAnKCeQKBgpWCxALOgukDHoNEg3MDeIAAgAAAAEACAABAAoAAgASABgAAQACACMAJQACACcAVAACACcAVQAEAAAAAQAIAAEBEgALABwALgBAAFIAZAB2AIgAwgDsAP4BCAACAAYADAIkAAIAUQIbAAIAVAACAAYADAIiAAIAUQIdAAIAVAACAAYADAIjAAIAUQIgAAIAVQACAAYADAIlAAIAUQIcAAIAVAACAAYADAImAAIAUQIeAAIAVAACAAYADAInAAIAUQIhAAIAVQAHABAAFgAcACIAKAAuADQCJAACAEsCIgACAEwCIwACAE0CJQACAE4CJgACAE8CJwACAFADFAACAHAABQAMABIAGAAeACQCGwACAEsCHQACAEwCHAACAE4CHgACAE8CHwACA3QAAgAGAAwCIAACAE0CIQACAFAAAQAEAxQAAgBRAAEABAIfAAIAVAABAAsASwBMAE0ATgBPAFAAUQBUAFUAcAN0AAQAAAABAAgAAQgUAAEACAACAAYADAAjAAIAVAAlAAIAVQABAAAAAQAIAAIBpADPAxYBqgGrAawBrQGuAbEBsgG1AbYBuQG8Ab8BwgHFAcYBxwHIAckBzAHPAdIB1QHYAdsB3gMZAxwDHwMiAyUB4QHkAecB6gHtAfAB8wH2AfcB+AIJAgQBNgIqAisCLAItAi4CLwFGAUABNwIwAjMBOgFDAT0CNgI5AVIBTwI8AVUBWAFeAj8CQAJBAVwBWwFdAkICQwFgAkQCRQJGAkcCSAJJAV8CSgJLAk4CUQJUAlcCWgJdAg4CYAJjAUkCZgFMAmkCagFhAmsCbgJxAYgCdAFkAncBagFnAnoCfQKAAoMChgKJAowBbQFuAo8CkgFzApMBbwFwAhUCFAKWAY8BjAGLAY0BkAMBAY4BlgKXAwUDAgGRAwYBdgF3AfMCrAKtAwkCmgKdAq4CsQK2ArcCugK9AsACwwLGAskCzALNAs4CzwLSAtUC2ALbAt4C4QLkAucC6gLtAvAC8wL2AvkC/AL9Av4DUQMoAysDLgMvAzIDMwM0AzcDOgM9Az4DQQNEA0UDSANLA04DeAN8A4ADhAOIA4wDkAOUA5gDnAOeAAIAFQAgACAAAAAiAD8AAQBBAEoAHwBuAG8AKQBxAHMAKwB1ANMALgDVANUAjQDuAO8AjgD6APwAkAD/AS8AkwN3A3cAxAN7A3sAxQN/A38AxgODA4MAxwOHA4cAyAOLA4sAyQOPA48AygOTA5MAywOXA5cAzAObA5sAzQOdA50AzgABAAAAAQAIAAICUACPAxcBrwGzAbcBugG9AcABwwHKAc0B0AHTAdYB2QHcAd8DGgMdAyADIwMmAeIB5QHoAesB7gHxAfQBlAH5AggCDwNmAUcBQQE4AjECNAE7AUQBPgI3AjoBUwFQAj0BVgFZAkwCTwJSAlUCWAJbAl4CDwJhAmQBSgJnAU0B4gFKAWICbAJvAnIBiQJ1AWUCeAFrAWgCewJ+AoEChAKHAooCjQGUAUcCkAE7AXQClAFxAxIBlwMDAZIBOwMHApgCmwKvArICtAK4ArsCvgLBAsQCxwLKAtAC0wLWAtkC3ALfAuIC5QLoAusC7gLxAvQC9wL6Av8DUgMpAywDMAM1AzgDOwM/A0IDRgNJA0wDTwN5A30DgQOFA4kDjQORA5UDmQABAAAAAQAIAAIBJACPAxgBsAG0AbgBuwG+AcEBxAHLAc4B0QHUAdcB2gHdAeADGwMeAyEDJAMnAeMB5gHpAewB7wHyAfUBlQH6AgsCDQNlAUgBQgE5AjICNQE8AUUBPwI4AjsBVAFRAj4BVwFaAk0CUAJTAlYCWQJcAl8CDQJiAmUBSwJoAU4B4wFLAWMCbQJwAnMBigJ2AWYCeQFsAWkCfAJ/AoIChQKIAosCjgGVAUgCkQE8AXUClQFyAxMBmAMEAZMBPAMIApkCnAKwArMCtQK5ArwCvwLCAsUCyALLAtEC1ALXAtoC3QLgAuMC5gLpAuwC7wLyAvUC+AL7AwADUwMqAy0DMQM2AzkDPANAA0MDRwNKA00DUAN6A34DggOGA4oDjgOSA5YDmgACAB4AIAAgAAAAJgAmAAEAKAAoAAIAKgAuAAMAMwA/AAgAQQBHABUASQBKABwAbgBvAB4AeACHACAAmgC/ADAAwQDCAFYAzADMAFgAzgDOAFkA0ADRAFoA+gD8AFwA/wEIAF8BDAEaAGkBHQEgAHgBIgEiAHwBJQEnAH0BKgEvAIADdwN3AIYDewN7AIcDfwN/AIgDgwODAIkDhwOHAIoDiwOLAIsDjwOPAIwDkwOTAI0DlwOXAI4ABAAIAAEACAABAQYADAAeAGAAogCsALYAwADKANQA3gDoAPIA/AAIABIAGAAeACQAKgAwADYAPAIRAAIBNgH7AAIBqgH9AAIBqwH/AAIBrQIBAAIBsQKeAAICKgKgAAICKwKiAAICLAAIABIAGAAeACQAKgAwADYAPAISAAIBNgH8AAIBqgH+AAIBqwIAAAIBrQICAAIBsQKfAAICKgKhAAICKwKjAAICLAABAAQCpAACAbEAAQAEAqUAAgGxAAEABAKmAAIBsQABAAQCpwACAbEAAQAEAqgAAgGxAAEABAKpAAIBsQABAAQCqgACAbEAAQAEAqsAAgGxAAEABAMKAAIBsQABAAQDCwACAbEAAQAMAesB7AKBAoIChAKFAocCiAKKAosC+gL7AAUACAABAAgAAgAOADAAAwAAALIAxAABAA8B6wHsAoECggKEAoUChwKIAooCiwL6AvsDjQOOBGcAAgAVATYBNgADAaoBqwADAa0BrQADAbEBsQADAesB6wABAewB7AACAioCKwADAoECgQABAoICggACAoQChAABAoUChQACAocChwABAogCiAACAooCigABAosCiwACAvoC+gABAvsC+wACA40DjQABA44DjgACBGcEZwACBTsFOwADAAEABAACAAIAAwAAAAgAAQAIAAEABAACAAIAAwAAAAkAAQAJAAEAAAABAAgAAgAiAA4D+QP2A/oD+wPuA+0D9wP4A/ED8gPzA/UD9AQJAAEADgE2AaoBqwGtAbEB6wIqAisCgQKEAocCigL6A40AAQAAAAEACAACACIADgQEBAEEBQQHA/AD7wQCBAMD/AP9A/4D/wQABAYAAQAOATYBqgGrAa0BsQHsAioCKwKCAoUCiAKLAvsFOwAEAAAAAQAIAAEAGAABAAgAAQAEAxEABQHrAewDFAHzAAEAAQAnAAEAAAABAAgAAgAMAAMCKABmAikAAQADAPQA9gD3AAEAAAABAAgAAgAKAAIAZgIpAAEAAgD2APcAAQAAAAEACAACAA4ABAMQAxUF6wXsAAEABABrAGwF6QXqAAEAAAABAAgAAgAyABYDVANVA1YDVwNYA1kDWgNbA1wDXQNUA1UDVgNXA14DYANhA1sDXANdA18DYgACAAMAYABpAAAA8AD5AAoCKAIpABQABQAAAAEACAACAMwADAACAAAATAACAAoABwAHAAEAYABpAAIA3QDdAAEA8AD5AAICKAIpAAID2APYAAED4APgAAED5APkAAED6QPpAAEF0QXaAAIABAAKACoARABYAAUABQACAAIAAgACAAAAEAABABEAAgARAAMAEQAEABEABAAEAAIAAgACAAAAEAABABEAAgARAAMAEQADAAMAAgACAAAAEAABABEAAgARAAIAAgACAAAAEAABABEAAQAAAAEACAACABIABgPZA+oD1QPdA+ED5QABAAYABwDdA9gD4APkA+kAAQAAAAEACAACAEYAIAO+A78DwAPBA8IDwwPEA8UDxgPHA74DvwPAA8EDyAPJA8oDxQPGA8cDywPMBdsF3AXdBd4F3wXgBeEF4gXjBeQAAgAEAGAAaQAAAPAA+QAKAigCKQAUBdEF2gAWAAIAAAABAAgAAQDmABkAOAA+AEQASgBQAFYAXABiAGgAbgB0AHoAgACGAIwAkgCYAJ4ApACqALAAtgC8AMIAyAACBc0DvgACBc0DvwACBc0DwAACBc0DwQACBc0DwgACBc0DwwACBc0DxAACBc0DxQACBc0DxgACBc0DxwACBc0DyAACBc0DyQACBc0DygACBc0DywACBc0DzAACBc0F2wACBc0F3AACBc0F3QACBc0F3gACBc0F3wACBc0F4AACBc0F4QACBc0F4gACBc0F4wACBc0F5AAGAAAAAQAIAAIAEAAgAFoAAAACAAAAagACAAIDvgPMAAAF2wXkAA8AAgAJA74DzAACA9UD1QABA9kD2QABA90D3QABA+ED4QABA+UD5QABA+oD6gABBc0FzQADBdsF5AACAAIAAgO+A8wAAQXbBeQAAQACAAYAFgACAAIAAQABAAAAAQAAABIAAgACAAMAAQAAAAEAAAASAAQACAABAAgAAQCiAAYAEgAmAEYAWgBuAI4AAgAGAA4D1wADBc0FzQPWAAIFzQADAAgAEgAaA9wABAXNBc0FzQPbAAMFzQXNA9oAAgXNAAIABgAOA98AAwXNBc0D3gACBc0AAgAGAA4D4wADBc0FzQPiAAIFzQADAAgAEgAaA+gABAXNBc0FzQPnAAMFzQXNA+YAAgXNAAIABgAOA+wAAwXNBc0D6wACBc0AAQAGA9UD2QPdA+ED5QPqAAEAAAABAAgAAQAGBeIAAQACAAQABQAEAAgAAQAIAAEAFAABAAgAAQAEA9EAAwHsAfMAAQABAesAAA==";

function base64VersOctets(b64) {
  const binaire = atob(b64);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
  return octets;
}

// Bibliotheque PDF chargee a la demande (motif identique au lecteur Excel)
let pdfChargement = null;
function chargerBibliothequePDF() {
  if (window.PDFLib && window.fontkit) return Promise.resolve(true);
  if (pdfChargement) return pdfChargement;
  const charger = function (src) {
    return new Promise(function (resoudre, rejeter) {
      const sc = document.createElement('script');
      sc.src = src;
      sc.onload = function () { resoudre(true); };
      sc.onerror = function () { rejeter(new Error('script indisponible')); };
      document.head.appendChild(sc);
    });
  };
  pdfChargement = charger('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js')
    .then(function () { return charger('https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js'); })
    .then(function () {
      if (!window.PDFLib || !window.fontkit) throw new Error('bibliotheque PDF incomplete');
      return true;
    })
    .catch(function (e) { pdfChargement = null; throw e; });
  return pdfChargement;
}
async function pdfPret() {
  try { await chargerBibliothequePDF(); return true; }
  catch (e) { afficherToast('Generateur de PDF indisponible (connexion internet requise)', 'error'); return false; }
}

// Un identifiant est a generer si l'email manque/est hors convention, ou si le mot de passe est inutilisable
function identifiantAGenerer(compte) {
  const mdp = motsDePasse[compte.email] || compte.password;
  return !emailIdentifiantConforme(compte.email) || !motDePasseAcceptable(mdp);
}

// Popup de controle avant d'agir
function demanderIdentifiants() {
  // EN MODE ECOLE : la liste vient de la BASE, les mots de passe de l'APPLICATION.
  if (typeof estModeEcole === 'function' && estModeEcole()) { telechargerIdentifiantsEcole(); return; }
  const surveillants = comptes.filter(c => c.role === 'surveillant');
  const enseignants = comptes.filter(c => c.role === 'enseignant');
  const personnel = surveillants.concat(enseignants);
  if (!personnel.length) { afficherToast('Aucun compte a pourvoir', 'error'); return; }
  const aGenerer = personnel.filter(identifiantAGenerer).length;
  const detail = surveillants.length + ' surveillant(s), ' + enseignants.length + ' enseignant(s)';
  const message = aGenerer > 0
    ? aGenerer + ' identifiant(s) a generer (' + detail + '). Le fichier PDF va etre telecharge.'
    : 'Les ' + personnel.length + ' identifiants existent deja (' + detail + ') : le PDF sera telecharge a nouveau avec les memes mots de passe.';
  demanderConfirmation(message, telechargerIdentifiants);
}

// Generation + enregistrement + PDF (un seul fichier, deux sous-titres)
async function telechargerIdentifiants() {
  const surveillants = comptes.filter(c => c.role === 'surveillant');
  const enseignants = comptes.filter(c => c.role === 'enseignant');
  if (!surveillants.length && !enseignants.length) return;
  if (!(await pdfPret())) return;
  try {
    const emailsPris = comptes.map(c => c.email).filter(Boolean);
    const sourceDe = function (liste, prefixe, separateur) {
      return liste.map(function (c) {
        return { nom: c.nom, matiere: c.matiere, abreviation: prefixe, separateur: separateur,
                 email: c.email, password: motsDePasse[c.email] || c.password };
      });
    };
    const lignesSurv = genererIdentifiants(sourceDe(surveillants, 'surv', ''), emailsPris);
    const lignesEns = genererIdentifiants(sourceDe(enseignants, null, '-prof'),
                                          emailsPris.concat(lignesSurv.map(function (l) { return l.email; })));

    // enregistrement : re-telecharger le PDF redonne toujours les memes identifiants
    const enregistrer = function (liste, lignes) {
      lignes.forEach(function (l, i) {
        const c = liste[i];
        if (!c) return;
        c.email = l.email;
        if (l.password) { c.password = l.password; motsDePasse[l.email] = l.password; }
      });
    };
    enregistrer(surveillants, lignesSurv);
    enregistrer(enseignants, lignesEns);
    sauvegarderMotsDePasse();
    const listeSurv = listeSurveillantsRH();
    listeSurv.forEach(function (s, i) { if (surveillants[i]) s.email = surveillants[i].email || ''; });
    sauvegarderSurveillantsRH(listeSurv);

    const lib = window.PDFLib;
    const sections = [
      { titre: 'Surveillants', lignes: lignesSurv },
      { titre: 'Enseignants', lignes: lignesEns }
    ];
    const doc = await construirePdfIdentifiants(lib, lib.PDFDocument, window.fontkit,
      base64VersOctets(POLICE_ARABE_B64), sections, {
        etablissement: (etablissement && etablissement.nom) || '',
        annee: (anneeScolaire && anneeScolaire.libelle) || '',
        date: dateAffichage(jourCourant())
      });
    const octets = await doc.save();
    telechargerFichier(octets, 'identifiants.pdf');
    afficherListeProfs();
    afficherToast((lignesSurv.length + lignesEns.length) + ' identifiants enregistres et telecharges', 'success');
  } catch (e) {
    afficherToast('Generation du PDF impossible : ' + (e && e.message ? e.message : e), 'error');
  }
}

// Identifiants d'une ECOLE reliee a la base : on lit les fiches du serveur et on
// imprime les mots de passe fabriques par l'application (+ un mot de passe NEUF pour
// chaque fiche sans compte).
async function telechargerIdentifiantsEcole() {
  if (!(await pdfPret())) return;
  try {
    const fiches = await atFichesPersonnel();
    if (!fiches.length) { afficherToast('Aucun membre du personnel dans la base', 'error'); return; }
    let nouveaux = 0;
    const aLigne = function (f) {
      const avant = String((f && f.email) || '').trim().toLowerCase();
      const mdp = motDePassePourFiche(f);
      if (mdp && mdp !== 'deja remis' && !motsDePasseEcole()[avant]) nouveaux++;
      return { nom: f.nom, matiere: f.matiere || '', email: avant, password: mdp,
               abreviation: f.role === 'surveillant' ? 'surv' : null,
               separateur: f.role === 'surveillant' ? '' : '-prof' };
    };
    const lignesSurv = fiches.filter(f => f.role === 'surveillant').map(aLigne);
    const lignesEns = fiches.filter(f => f.role === 'enseignant').map(aLigne);
    const lib = window.PDFLib;
    const sections = [
      { titre: 'Surveillants', lignes: lignesSurv },
      { titre: 'Enseignants', lignes: lignesEns }
    ];
    const doc = await construirePdfIdentifiants(lib, lib.PDFDocument, window.fontkit,
      base64VersOctets(POLICE_ARABE_B64), sections, {
        etablissement: (etablissement && etablissement.nom) || '',
        annee: (anneeScolaire && anneeScolaire.libelle) || '',
        date: dateAffichage(jourCourant())
      });
    const octets = await doc.save();
    telechargerFichier(octets, 'identifiants.pdf');
    afficherToast((lignesSurv.length + lignesEns.length) + ' identifiant(s) telecharge(s)', 'success');
  } catch (e) {
    afficherToast('Generation du PDF impossible : ' + (e && e.message ? e.message : e), 'error');
  }
}

// Telechargement du fichier produit
function telechargerFichier(octets, nom) {
  const blob = new Blob([octets], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  document.body.appendChild(lien);
  lien.click();
  setTimeout(function () { URL.revokeObjectURL(url); if (lien.parentNode) lien.parentNode.removeChild(lien); }, 2000);
}
function ouvrirRenommageProf(code) {
  const c = comptes.find(x => x.code === code || x.email === code);
  if (!c) return;
  creationProfil = false;
  profARenommer = c.code || c.email;
  libelleActionMdp();          // « Réinitialiser » (on modifie une personne existante)
  // on repart d'un affichage vierge : pas de mot de passe réinitialisé de la fois d'avant
  dernierReset = null;
  const blocReset = document.getElementById('renommer-reset');
  if (blocReset) blocReset.classList.add('hidden');
  const btnSup = document.getElementById('renommer-supprimer');
  if (btnSup) btnSup.classList.toggle('hidden', c.role !== 'surveillant');
  const titre = document.getElementById('renommer-titre');
  if (titre) titre.textContent = c.role === 'surveillant' ? 'Nom du surveillant' : "Nom de l'enseignant";
  const champ = document.getElementById('renommer-nom');
  if (champ) champ.value = c.nom || '';
  const info = document.getElementById('renommer-info');
  if (info) info.textContent = (c.matiere ? c.matiere + ' · ' : '') + (c.role === 'surveillant' ? 'Surveillant' : c.code || '');
  const mail = document.getElementById('renommer-email');
  if (mail) mail.textContent = 'Email de connexion : ' + (c.email || '');
  const mdp = document.getElementById('renommer-mdp');
  if (mdp) mdp.value = '';
  const suc = document.getElementById('renommer-success');
  if (suc) suc.classList.add('hidden');
  document.getElementById('modal-renommer').classList.remove('hidden');
}
function fermerRenommageProf() {
  profARenommer = null;
  document.getElementById('modal-renommer').classList.add('hidden');
}
function confirmerRenommageProf() {
  const champ = document.getElementById('renommer-nom');
  const nouveau = champ ? String(champ.value || '').replace(/\s+/g, ' ').trim() : '';
  if (nouveau.length < 3) { afficherToast('Nom trop court (3 caractères minimum)', 'error'); return; }

  // --- AJOUT d'un surveillant ---
  if (creationProfil) {
    const liste = listeSurveillantsRH();
    const cle = 'surv-' + Date.now();
    liste.push({ cle: cle, code: cle, nom: nouveau, email: '' });
    creationProfil = false;
    nomsProfs[cle] = nouveau; sauvegarderNomsProfs();
    sauvegarderSurveillantsRH(liste);
    fermerRenommageProf();
    afficherListeProfs();
    afficherToast('Surveillant ajoute · ses identifiants seront generes avec le PDF', 'success');
    return;
  }

  const code = profARenommer;
  if (!code) return;
  const prof = comptes.find(c => c.code === code || c.email === code);
  const ancien = prof ? prof.nom : '';
  nomsProfs[prof ? (prof.code || prof.email) : code] = nouveau;
  sauvegarderNomsProfs();
  if (prof) prof.nom = nouveau;
  // Mot de passe de connexion (genere ou saisi) : valide puis persiste
  const champMdp = document.getElementById('renommer-mdp');
  const mdp = champMdp ? String(champMdp.value || '').trim() : '';
  if (mdp) {
    const souci = validerMotDePasse(mdp);
    if (souci) { afficherToast(souci, 'error'); return; }
    if (prof) { prof.password = mdp; motsDePasse[prof.email] = mdp; sauvegarderMotsDePasse(); }
  }
  let maj = 0;
  const codeProf = prof ? prof.code : code;
  absences.forEach(a => {
    if ((codeProf && a.profCode === codeProf) || (ancien && a.enseignant === ancien)) { a.enseignant = nouveau; maj++; }
  });
  if (maj > 0) Depot.ecrireJSON('absences', absences);
  // un surveillant ne vient pas d'un import : son nom doit etre conserve dans sa liste
  if (prof && prof.role === 'surveillant') majSurveillantRH(prof.code || prof.email, { nom: nouveau });
  afficherListeProfs();
  if (mdp && prof) {
    // On laisse la modale ouverte pour que le directeur note les identifiants
    const suc = document.getElementById('renommer-success');
    if (suc) {
      suc.textContent = 'Connexion : ' + prof.email + ' / ' + mdp;
      suc.classList.remove('hidden');
    }
    afficherToast('Mot de passe défini', 'modif');
    return;
  }
  fermerRenommageProf();
  const quoi = (prof && prof.role === 'surveillant') ? 'Surveillant modifie' : 'Enseignant renomme';
  afficherToast(quoi + (maj > 0 ? ' · ' + maj + ' signalement(s) mis à jour' : ''), 'modif');
}

// ========== VARIABLES GLOBALES ==========
let absences = Depot.lireJSON('absences', []) || [];
let utilisateurConnecte = null;
let elevesCoches = new Map(); // id eleve -> type (absence / retard)
let classeSelectionnee = null;

// Seuil d'alerte : absences non justifiees dans le mois
const SEUIL_ALERTE_MOIS = 4;

let classeDetailCourante = null;
let decochesManuellement = new Set(); // Élèves décochés manuellement après sauvegarde

// Date locale (evite le decalage UTC: toISOString renvoie la veille a 00h-01h au Maroc)
function fmtDateISO(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const j = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + j;
}

// ========== LECTEUR EXCEL (charge a la demande : l'ouverture de l'appli ne l'attend plus) ==========
let xlsxChargement = null;
function chargerXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (xlsxChargement) return xlsxChargement;
  xlsxChargement = new Promise(function (resoudre, rejeter) {
    const sc = document.createElement('script');
    sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    sc.onload = function () { resoudre(window.XLSX); };
    sc.onerror = function () { xlsxChargement = null; rejeter(new Error('xlsx indisponible')); };
    document.head.appendChild(sc);
  });
  return xlsxChargement;
}
async function xlsxPret() {
  try { await chargerXLSX(); return true; }
  catch (e) { afficherToast('Lecteur Excel indisponible (connexion internet requise)', 'error'); return false; }
}

// Les formulaires sont construits tout de suite (avant l'habillage maison des <select>)
construireFormulaires();

// ========== LIBELLES ==========
function libelleType(t) {
  if (t === 'retard') return 'Retard';
  if (t === 'exclusion') return 'Exclusion de cours';
  return 'Absence';
}

// ========== RETARD NON APPROUVE DANS LES 30 MIN -> ABSENCE ==========
// Un retard doit etre approuve dans les 30 min qui suivent le signalement ;
// passe ce delai il se transforme en absence (type effectif = 'absence').
const DELAI_RETARD_MIN = 30;

function datetimeSignalement(a) {
  if (!a) return null;
  const d = new Date(String(a.dateISO || '') + 'T' + String(a.heure || '00:00') + ':00');
  return isNaN(d.getTime()) ? null : d;
}

// Vrai si le retard est reste au-dela des 30 min (approbation trop tardive ou absente)
function retardHorsDelai(a) {
  if (!a || a.type !== 'retard') return false;
  const sig = datetimeSignalement(a);
  if (!sig) return false;
  let ref = new Date();
  if (a.justifieLe) {
    const p = String(a.justifieLe).replace(' ', 'T');
    const d = new Date(p.length === 16 ? p + ':00' : p);
    if (!isNaN(d.getTime())) ref = d;
  }
  return (ref.getTime() - sig.getTime()) > DELAI_RETARD_MIN * 60000;
}

// Type effectif : un retard hors delai compte comme une absence
function typeEffectif(a) {
  if (!a) return 'absence';
  if (a.type === 'retard' && retardHorsDelai(a)) return 'absence';
  return a.type || 'absence';
}

// Libelle du type dans le detail du signalement : 'Retard' -> 'Retard -> Absence'
function libelleTypeAffiche(a) {
  if (a && a.type === 'retard' && retardHorsDelai(a)) return 'Retard \u2192 Absence';
  return libelleType(a && a.type);
}

function libelleStatut(s) {
  if (s === 'justifie_s') return 'Justifiée S';
  if (s === 'justifie_d') return 'Justifiée D';
  return 'Non justifiée';
}

// Qui a approuve la justification : S1 / S2 (surveillant) ou D (directeur)
function codeApprobation(a) {
  if (!a) return '';
  const par = String(a.justifiePar || '');
  if (/directeur/i.test(par)) return 'D';
  const num = par.match(/\d+/);
  if (num) return 'S' + num[0];
  if (/surveillant/i.test(par)) return 'S';
  if (a.statut === 'justifie_d') return 'D';
  if (a.statut === 'justifie_s') return 'S';
  return '';
}

// Datetime d'approbation lisible : 'yyyy-mm-dd HH:MM' -> 'dd/mm/yyyy · HH:MM'
function dateHeureApprobation(valeur) {
  const t = String(valeur || '').trim();
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return t;
  return m[3] + '/' + m[2] + '/' + m[1] + ' · ' + m[4] + ':' + m[5];
}

function libelleStatutAbs(a) {
  const code = codeApprobation(a);
  if (a.statut === 'justifie_s') return 'Justifiée ' + (code || 'S');
  if (a.statut === 'justifie_d') return 'Justifiée D';
  return libelleStatut(a.statut);
}

function libelleSeance(s) {
  return s === 'apres-midi' ? 'Après-midi' : 'Matin';
}

function abrevMatiere(m) {
  if (!m) return '-';
  const t = String(m).trim();
  const s = t.toLowerCase();
  if (s.indexOf('math') >= 0) return 'MATH';
  if (s.indexOf('physique') >= 0 || s === 'pc') return 'PC';
  if (s.indexOf('fran') >= 0) return 'FR';
  if (s.indexOf('arabe') >= 0 || s === 'ar') return 'AR';
  if (s.indexOf('svt') >= 0 || s.indexOf('science') >= 0) return 'SVT';
  if (s.indexOf('anglais') >= 0) return 'ANG';
  if (s.indexOf('histoire') >= 0 || s.indexOf('géo') >= 0) return 'HG';
  if (s.indexOf('philo') >= 0) return 'PHILO';
  if (s.indexOf('islam') >= 0 || s.indexOf('ducation') >= 0) return 'EI';
  if (s.indexOf('eps') >= 0 || s.indexOf('sport') >= 0) return 'EPS';
  if (s.indexOf('info') >= 0) return 'INFO';
  return t.toUpperCase();
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


// ========== DATE & SEANCE (automatiques) ==========
function jourCourant() {
  return fmtDateISO(new Date());
}

function seanceCourante() {
  // Si l'enseignant a un tableau de service et qu'un creneau est en cours, c'est sa seance.
  if (utilisateurConnecte && utilisateurConnecte.role === 'enseignant') {
    const enCours = creneauxEnCours(emailUtilisateur());
    if (enCours.length > 0) return hhmmEnMinutes(enCours[0].debut) < 12 * 60 ? 'matin' : 'apres-midi';
  }
  // Sinon : 00-12 = Matin, 13-23 = Apres-midi (production : 08-12 / 14-18)
  return new Date().getHours() <= 12 ? 'matin' : 'apres-midi';
}

// ========== THEME SOMBRE ==========
function appliquerTheme() {
  const sombre = Depot.lire('prefTheme', null) === 'sombre';
  document.body.classList.toggle('theme-sombre', sombre);
  // l'interrupteur suit l'etat reel (et change de libelle pour l'accessibilite)
  document.querySelectorAll('.sw-theme').forEach(function (sw) {
    const coche = sw.querySelector('input');
    if (coche) coche.checked = sombre;
    sw.title = sombre ? 'Passer en mode clair' : 'Passer en mode sombre';
  });
  document.querySelectorAll('.icone-theme').forEach(function (ic) {
    ic.className = 'icone-theme fas text-xl ' + (sombre ? 'fa-sun' : 'fa-moon');
  });
}

function basculerTheme() {
  Depot.ecrire('prefTheme', Depot.lire('prefTheme', null) === 'sombre' ? 'clair' : 'sombre');
  appliquerTheme();
  // Les lignes eleves utilisent des couleurs en style inline : on les redessine
  if (typeof classeSelectionnee !== 'undefined' && classeSelectionnee) afficherListeEleves();
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
  // Ecole reliee a la base : le compte est verifie par le SERVEUR (et non par le telephone).
  if (typeof estModeEcole === 'function' && estModeEcole()) { connexionParLaBase(); return; }
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

  // 1) Les comptes du TELEPHONE (l'application fonctionne sans internet)
  const compte = comptes.find(c => c.email === email && c.password === password);
  if (!compte) {
    // 2) Le SERVEUR : cette personne a peut-etre un compte dans une ecole installee
    //    (meme adresse, mot de passe venu de la base) -> l'application se relie a son ecole.
    //    (Le repli n'a lieu que si l'application peut joindre un serveur : dans les bancs
    //     d'essai hors ligne, le comportement du telephone reste inchange.)
    if (typeof connexionParLaBase === 'function' && typeof fetch === 'function') {
      errorText.textContent = 'Connexion en cours...';
      errorDiv.classList.remove('hidden');
      connexionParLaBase(true);
      return;
    }
    errorText.textContent = email.endsWith('@taalim.ma') ? 'Email ou mot de passe incorrect'
                                                        : "L'email doit contenir @taalim.ma";
    errorDiv.classList.remove('hidden');
    return;
  }

  utilisateurConnecte = compte;
  Depot.ecrireJSON('utilisateur', compte);
  appliquerRoleTheme();

  if (compte.role === 'enseignant') {
    afficherEcran('enseignant');
    remplirListeClasses();
    choisirClasse('');
    afficherInfosProf();
    appliquerTableauService();
  } else if (compte.role === 'surveillant') {
    afficherEcran('surveillant');
    mettreAJourDashboardSurv();
    afficherSeancesAnnulees();
  } else if (compte.role === 'directeur') {
    afficherEcran('directeur');
    mettreAJourDashboardDir();
    afficherSeancesAnnulees();
  }
}

function deconnexion() {
  if (typeof atSeDeconnecter === 'function') atSeDeconnecter();   // ferme aussi la session du serveur
  utilisateurConnecte = null;
  appliquerRoleTheme();
  elevesCoches.clear();
  decochesManuellement.clear();
  classeSelectionnee = null;
  choisirClasse('');
  afficherInfosProf();
  Depot.effacer('utilisateur');
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
  ajusterHauteurAppbar();
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
  if (page === 'enseignant') { afficherListeEleves(); appliquerTableauService(); }
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
  if (page === 'surv-classes') afficherHistoriqueRegles('surv-classes-list');
  if (page === 'surv-stats') { placerStatsCommun('surv-stats-conteneur'); afficherStatistiquesDir(); }
}

// Statistiques : la MEME page pour le directeur et le surveillant. Un seul bloc
// (#stats-commun) est deplace dans la page affichee, donc un seul jeu d'identifiants
// et un seul rendu : les deux ecrans ne peuvent pas diverger.
function placerStatsCommun(idConteneur) {
  const bloc = document.getElementById('stats-commun');
  const cible = document.getElementById(idConteneur);
  if (bloc && cible && bloc.parentNode !== cible) cible.appendChild(bloc);
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
  if (page === 'directeur') { mettreAJourDashboardDir(); afficherSeancesAnnulees(); }
  if (page === 'dir-stats') { placerStatsCommun('dir-stats-conteneur'); afficherStatistiquesDir(); }
  if (page === 'dir-gestion') afficherGestionDir();
  if (page === 'dir-historique') afficherHistoriqueRegles('dir-historique-list');
}

// ========== TOAST ==========
// Nature de l'action -> ton de la notification (couleur + icone)
const TONS_TOAST = {
  success: { ton: 'ton-succes', icone: 'fa-check-circle' },        // ajout, import, envoi reussi
  modif: { ton: 'ton-modif', icone: 'fa-edit' },                   // modification, enregistrement
  suppression: { ton: 'ton-suppr', icone: 'fa-trash' },            // suppression, retrait
  warning: { ton: 'ton-avert', icone: 'fa-exclamation-triangle' }, // avertissement, partiel
  info: { ton: 'ton-info', icone: 'fa-info-circle' },              // information neutre
  error: { ton: 'ton-erreur', icone: 'fa-times-circle' }           // erreur, refus
};
let toastMinuterie = null, toastMinuterieSortie = null;
// Duree d'affichage d'une notification avant qu'elle ne disparaisse.
// 3,2 s = 1 s de plus qu'avant (demande de l'utilisateur : laisser le temps de lire).
const DUREE_NOTIFICATION = 3200;

function afficherToast(message, type) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  const t = TONS_TOAST[type] || TONS_TOAST.info;
  toast.className = 'toast ' + t.ton;
  toast.innerHTML = '';
  const ic = document.createElement('span');
  ic.className = 'toast-ic';
  ic.innerHTML = '<i class="fas ' + t.icone + '"></i>';
  const tx = document.createElement('span');
  tx.className = 'toast-txt';
  tx.textContent = message;
  toast.appendChild(ic);
  toast.appendChild(tx);
  // une nouvelle notification remplace la precedente : sa minuterie ne doit pas la couper
  if (toastMinuterie) clearTimeout(toastMinuterie);
  if (toastMinuterieSortie) clearTimeout(toastMinuterieSortie);
  void toast.offsetWidth;                       // force le navigateur a jouer la transition
  toast.classList.add('show');
  toastMinuterie = setTimeout(function () {
    toast.classList.remove('show');
    toastMinuterieSortie = setTimeout(function () { toast.className = 'toast hidden'; }, 600);
  }, DUREE_NOTIFICATION);
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
  const moi = utilisateurConnecte ? utilisateurConnecte.nom : '';
  return absences.filter(a => {
    const d = String(a.dateISO || '');
    if (d < b.debut || d > b.fin) return false;
    if (statsType !== 'tous' && (a.type || 'absence') !== statsType) return false;
    if (absenceEnSeanceAnnulee(a)) return false;   // seance annulee : ne compte pas
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

// ========== LECTURE DES FICHIERS FET (emploi du temps XML) ==========
function normaliserTexte(t) {
  return String(t || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
const JOURS_FET = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
function numeroJourFET(nom, position) {
  const i = JOURS_FET.indexOf(normaliserTexte(nom));
  if (i > 0) return i;                       // 1 = lundi ... 6 = samedi
  return (position >= 0 ? position + 1 : 0); // repli : ordre du fichier
}
function heureFET(txt) {
  const m = String(txt || '').match(/(\d{1,2})\s*[:hH]\s*(\d{2})?/);
  if (!m) return '';
  return String(parseInt(m[1], 10)).padStart(2, '0') + ':' + String(parseInt(m[2] || '0', 10)).padStart(2, '0');
}
function parserFET(texte) {
  let xml;
  try { xml = new DOMParser().parseFromString(String(texte || ''), 'text/xml'); } catch (e) { return null; }
  if (!xml || xml.querySelector('parsererror') || !xml.querySelector('FET')) return null;
  const txt = el => (el && el.textContent ? el.textContent.trim() : '');
  const jours = Array.from(xml.querySelectorAll('Days_List > Day')).map(txt);
  const heures = Array.from(xml.querySelectorAll('Hours_List > Hour')).map(txt);
  const profs = Array.from(xml.querySelectorAll('Teachers_List > Teacher > Name')).map(txt).filter(Boolean);
  const listeClasses = Array.from(xml.querySelectorAll('Students_List > Students > Name')).map(txt).filter(Boolean);
  const seances = [];
  Array.from(xml.querySelectorAll('Activities_List > Activity')).forEach(act => {
    const prof = txt(act.querySelector('Teacher'));
    const classe = txt(act.querySelector('Students'));
    const matiere = txt(act.querySelector('Subject'));
    const h = parseFloat(txt(act.querySelector('Duration'))) || 0;
    const demi = parseFloat(txt(act.querySelector('Duration_Half_Hours'))) || 0;
    const duree = h || (demi / 2) || 1;
    Array.from(act.querySelectorAll('Activity_Group')).forEach(g => {
      const jourEl = g.querySelector('Day');
      const heureEl = g.querySelector('Hour');
      if (!jourEl || !heureEl) return;
      const nomJour = txt(jourEl);
      const jour = numeroJourFET(nomJour, jours.indexOf(nomJour));
      const debut = heureFET(txt(heureEl));
      if (!jour || !debut) return;
      const finMin = hhmmEnMinutes(debut) + Math.round(duree * 60);
      const fin = String(Math.floor(finMin / 60)).padStart(2, '0') + ':' + String(finMin % 60).padStart(2, '0');
      seances.push({ jour: jour, debut: debut, fin: fin, classe: classe, matiere: matiere, prof: prof, salle: txt(g.querySelector('Room')) });
    });
  });
  return { institution: txt(xml.querySelector('Institution_Name')), jours: jours, heures: heures, profs: profs, classes: listeClasses, seances: seances };
}
function compteDuNomFET(nom) {
  const cible = normaliserTexte(nom);
  if (!cible) return null;
  return comptes.find(c => normaliserTexte(c.nom) === cible) || null;
}
function lireTexteFichier(file) {
  return new Promise(function (resoudre, rejeter) {
    const lecteur = new FileReader();
    lecteur.onload = function () { resoudre(String(lecteur.result || '')); };
    lecteur.onerror = function () { rejeter(new Error('lecture impossible')); };
    lecteur.readAsText(file);
  });
}
function estFichierFET(file) { return /\.fet$/i.test(String(file && file.name || '')); }

// Tableaux de service depuis un (ou plusieurs) fichier FET
async function importerServicesFET(fichiers) {
  let seances = 0;
  const profsVus = [];
  const inconnus = [];
  const classesCreees = [];
  for (const fichier of fichiers) {
    let parse = null;
    try { parse = parserFET(await lireTexteFichier(fichier)); } catch (e) { parse = null; }
    if (!parse) { afficherToast('Fichier FET illisible : ' + fichier.name, 'error'); continue; }
    const parProf = {};
    parse.seances.forEach(sn => {
      const compte = compteDuNomFET(sn.prof);
      if (!compte || !compte.email) {
        if (sn.prof && inconnus.indexOf(sn.prof) < 0) inconnus.push(sn.prof);
        return;
      }
      parProf[compte.email] = parProf[compte.email] || [];
      if (!parProf[compte.email].some(x => x.jour === sn.jour && x.debut === sn.debut && x.classe === sn.classe)) {
        parProf[compte.email].push({
          jour: sn.jour, debut: sn.debut, fin: sn.fin, classe: sn.classe,
          matiere: sn.matiere || compte.matiere || '', prof: compte.code || '', salle: sn.salle || ''
        });
      }
    });
    Object.keys(parProf).forEach(cle => {
      tableauxService[cle] = parProf[cle];
      if (profsVus.indexOf(cle) < 0) profsVus.push(cle);
      seances += parProf[cle].length;
    });
    parse.classes.forEach(nom => {
      if (!classes.some(c => c.nom === nom)) {
        classes.push({ id: nextClasseId++, nom: nom, eleves: [] });
        classesCreees.push(nom);
      }
    });
  }
  sauvegarderTableauxService();
  if (classesCreees.length) sauvegarderClasses();
  const apercu = document.getElementById('service-preview');
  if (apercu) {
    apercu.classList.remove('hidden');
    apercu.innerHTML = '<div class="bg-green-50 border border-green-200 rounded-xl p-4">' +
      '<p class="font-bold text-green-800">Fichier FET importé</p>' +
      '<p class="text-sm text-green-700">' + seances + ' séance(s) · ' + profsVus.length + ' professeur(s)' +
      (classesCreees.length ? ' · ' + classesCreees.length + ' classe(s) créée(s)' : '') + '</p>' +
      (inconnus.length ? '<p class="text-xs text-orange-700 mt-2">Professeurs non reconnus (créez leur compte) : ' + inconnus.join(', ') + '</p>' : '') +
      '</div>';
  }
  afficherToast('Tableaux de service importés (FET)', 'success');
}
// Classes depuis un fichier FET (les codes MASSAR ne sont pas dans un FET)
async function importerElevesFET(fichiers) {
  const creees = [];
  for (const fichier of fichiers) {
    let parse = null;
    try { parse = parserFET(await lireTexteFichier(fichier)); } catch (e) { parse = null; }
    if (!parse) { afficherToast('Fichier FET illisible : ' + fichier.name, 'error'); continue; }
    parse.classes.forEach(nom => {
      if (!classes.some(c => c.nom === nom)) {
        classes.push({ id: nextClasseId++, nom: nom, eleves: [] });
        creees.push(nom);
      }
    });
  }
  if (creees.length) sauvegarderClasses();
  const apercu = document.getElementById('eleves-preview');
  if (apercu) {
    apercu.classList.remove('hidden');
    apercu.innerHTML = '<div class="bg-green-50 border border-green-200 rounded-xl p-4">' +
      '<p class="font-bold text-green-800">Fichier FET importé</p>' +
      '<p class="text-sm text-green-700">' + creees.length + ' classe(s) créée(s)' + (creees.length ? ' : ' + creees.join(', ') : '') + '</p>' +
      '<p class="text-xs text-orange-700 mt-2">Un fichier FET ne contient pas les codes MASSAR ni les élèves : importez le fichier Excel MASSAR pour les noms et les codes.</p>' +
      '</div>';
  }
  afficherToast('Classes importées (FET)', 'success');
}

// ========== IMPORT DES TABLEAUX XLSX (page Gestion) ==========
const JOURS_TABLEAU = {
  'الإثنين': 1, 'الاثنين': 1, 'lundi': 1,
  'الثلاثاء': 2, 'mardi': 2,
  'الأربعاء': 3, 'الاربعاء': 3, 'mercredi': 3,
  'الخميس': 4, 'jeudi': 4,
  'الجمعة': 5, 'vendredi': 5,
  'السبت': 6, 'samedi': 6
};

function numeroJour(txt) {
  const t = String(txt || '').trim();
  for (const cle in JOURS_TABLEAU) { if (t.indexOf(cle) >= 0) return JOURS_TABLEAU[cle]; }
  return 0;
}
function hhmmDepuisTexte(txt) {
  const m = String(txt || '').match(/(\d{1,2})\s*[:hH]\s*(\d{2})?/);
  if (!m) return -1;
  return (parseInt(m[1], 10) || 0) * 60 + (parseInt(m[2] || '0', 10) || 0);
}
function texteCellule(v) {
  return String(v === null || v === undefined ? '' : v).replace(/\r/g, '').trim();
}
function premiereLigne(v) {
  return texteCellule(v).split('\n')[0].trim();
}
// feuille -> { entetes: [minutes...], lignes: [[...]], fusions: [...] }
function aoaFeuille(ws) {
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: true, raw: false });
  const fusions = (ws['!merges'] || []).map(m => ({ r1: m.s.r, c1: m.s.c, r2: m.e.r, c2: m.e.c }));
  return { aoa: aoa, fusions: fusions };
}
// Detecte la ligne d'en-tete horaire : >= 3 cellules du type 08:30-09:30
function ligneEntetesHoraires(aoa) {
  for (let r = 0; r < Math.min(aoa.length, 25); r++) {
    const ligne = aoa[r] || [];
    let nb = 0;
    ligne.forEach(c => { if (/\d{1,2}\s*[:hH]?\s*\d{0,2}\s*[–\-—]\s*\d{1,2}\s*[:hH]/.test(texteCellule(c))) nb++; });
    if (nb >= 3) return r;
  }
  return -1;
}
// feuille -> { classe, creneaux:[{jour,debut,fin,matiere,salle}], profs:{matiere:nom}, erreurs:[] }
function analyserTableauServiceFeuille(ws, nomFeuille) {
  const res = { classe: '', creneaux: [], profs: {}, erreurs: [] };
  if (!ws || typeof XLSX === 'undefined') { res.erreurs.push('lecteur xlsx indisponible'); return res; }
  const { aoa, fusions } = aoaFeuille(ws);

  // classe : cellule contenant 'القسم' ou 'classe'
  for (let r = 0; r < Math.min(aoa.length, 12) && !res.classe; r++) {
    const ligne = aoa[r] || [];
    for (let c = 0; c < ligne.length; c++) {
      const t = texteCellule(ligne[c]);
      if (/القسم|classe\s*:/i.test(t)) {
        const suite = t.split(/[:\u061A]/)[1];
        if (suite && suite.trim()) { res.classe = suite.replace(/^[\s\-–]+/, '').trim(); break; }
        const voisin = texteCellule(ligne[c + 1]) || texteCellule(ligne[c - 1]);
        if (voisin) { res.classe = voisin; break; }
      }
    }
  }
  if (!res.classe && /^[A-Z0-9\-]{3,}$/i.test(String(nomFeuille || '').trim())) res.classe = String(nomFeuille).trim();

  // grille
  const ligneEntete = ligneEntetesHoraires(aoa);
  if (ligneEntete < 0) { res.erreurs.push('grille horaire introuvable (aucune ligne 08:30-09:30)'); return res; }
  const entetes = aoa[ligneEntete] || [];
  const bornes = {};   // index de colonne -> {debut, fin}
  entetes.forEach((c, i) => {
    const t = texteCellule(c);
    const m = t.match(/(\d{1,2}\s*[:hH]?\s*\d{0,2})\s*[–\-—]\s*(\d{1,2}\s*[:hH]\s*\d{2})/);
    if (!m) return;
    const debut = hhmmDepuisTexte(m[1]);
    const fin = hhmmDepuisTexte(m[2]);
    if (debut >= 0 && fin > debut) bornes[i] = { debut: debut, fin: fin };
  });

  const colonnesHeure = Object.keys(bornes).map(k => parseInt(k, 10)).sort((a, b) => a - b);
  const dureeSuite = (r, c, cMax) => {   // seances de 2 h : detectees par les cellules fusionnees
    let fin = c;
    fusions.forEach(f => { if (f.r1 <= r && f.r2 >= r && f.c1 === c && f.c2 > fin) fin = f.c2; });
    return fin;
  };
  for (let r = ligneEntete + 1; r < aoa.length; r++) {
    const laLigne = aoa[r] || [];
    let jour = 0, colJour = -1;
    for (let c = 0; c < laLigne.length && !jour; c++) { jour = numeroJour(laLigne[c]); if (jour) colJour = c; }
    if (!jour) {
      // fin de la grille ? on continue, le bloc profs est analyse plus bas
      continue;
    }
    colonnesHeure.forEach(c => {
      if (c === colJour) return;
      const brut = texteCellule(laLigne[c]);
      if (!brut) return;
      if (estFusionne(r, c, fusions) && fusionNonDebut(r, c, fusions)) return;
      const finCol = dureeSuite(r, c, Math.max.apply(null, colonnesHeure));
      const debut = (bornes[c] || {}).debut;
      const finMin = (bornes[finCol] || bornes[c] || {}).fin;
      if (debut === undefined || finMin === undefined) return;
      const lignes = brut.split('\n');
      res.creneaux.push({
        jour: jour,
        debut: minutesVersHHMM(debut),
        fin: minutesVersHHMM(finMin),
        matiere: premiereLigne(lignes[0]),
        salle: lignes.length > 1 ? texteCellule(lignes.slice(1).join(' ')) : ''
      });
    });
  }

  // bloc « liste des professeurs » : après une ligne contenant الأساتذة ou (المادة + الأستاذ)
  let debutProfs = -1;
  for (let r = 0; r < aoa.length; r++) {
    const t = (aoa[r] || []).map(texteCellule).join(' | ');
    if (t.indexOf('الأساتذة') >= 0 || (t.indexOf('المادة') >= 0 && t.indexOf('الأستاذ') >= 0)) { debutProfs = r + 1; break; }
  }
  if (debutProfs > 0) {
    for (let r = debutProfs; r < aoa.length; r++) {
      const laLigne = (aoa[r] || []).map(texteCellule);
      for (let c = 0; c + 1 < laLigne.length; c++) {
        const mat = laLigne[c], prof = laLigne[c + 1];
        if (mat && prof && mat.length > 1 && prof.length > 1 && !numeroJour(mat)) res.profs[mat] = prof;
      }
    }
  }
  if (!res.creneaux.length) res.erreurs.push('aucune seance lue dans la grille');
  if (!Object.keys(res.profs).length) res.erreurs.push('liste des professeurs introuvable (matiere -> professeur)');
  return res;
}
function estFusionne(r, c, fusions) {
  return fusions.some(f => r >= f.r1 && r <= f.r2 && c >= f.c1 && c <= f.c2);
}
function fusionNonDebut(r, c, fusions) {
  return fusions.some(f => r >= f.r1 && r <= f.r2 && c > f.c1 && c <= f.c2);
}
function minutesVersHHMM(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
}
// Tables [{classe, creneaux, profs}] -> { cle: [creneaux...] } (cle = email du compte ou nom du prof)
function repartirParProfesseur(tables) {
  const sortie = {};
  tables.forEach(t => {
    t.creneaux.forEach(c => {
      const nomProf = t.profs[c.matiere] || '';
      const cle = (emailPourMatiere(c.matiere)) || nomProf || ('matiere:' + c.matiere);
      if (!sortie[cle]) sortie[cle] = [];
      sortie[cle].push({ jour: c.jour, debut: c.debut, fin: c.fin, classe: t.classe, salle: c.salle || '', matiere: c.matiere });
    });
  });
  return sortie;
}
function heuresCreneaux(liste) {
  return liste.reduce((som, c) => som + (hhmmEnMinutes(c.fin) - hhmmEnMinutes(c.debut)), 0);
}

// ---- import des tableaux de service (multi-fichiers) ----
async function importerTableauxService(input) {
  const fichiersChoisis = Array.from(input.files || []);
  const fichiersFET = fichiersChoisis.filter(estFichierFET);
  if (fichiersFET.length) {
    await importerServicesFET(fichiersFET);
    if (fichiersFET.length === fichiersChoisis.length) { input.value = ''; return; }
  }
  if (!(await xlsxPret())) return;
  const fichiers = Array.prototype.slice.call(input.files || []);
  input.value = '';
  if (!fichiers.length) return;
  importerXLSX(fichiers).then(feuilles => {
    const tables = [];
    const erreurs = [];
    feuilles.forEach(f => {
      if (f.erreur) { erreurs.push(f.fichier + ' : ' + f.erreur); return; }
      const t = analyserTableauServiceFeuille(f.ws, f.feuille);
      t.fichier = f.fichier;
      if (t.erreurs.length) erreurs.push(f.fichier + ' / ' + f.feuille + ' : ' + t.erreurs.join(', '));
      if (t.creneaux.length) tables.push(t);
    });
    if (!tables.length) {
      afficherErreurTableaux('Aucun tableau de service lisible.' + (erreurs.length ? ' ' + erreurs.join(' · ') : ''));
      return;
    }
    importTableauxService = { tables: tables, erreurs: erreurs };
    afficherApercuTableauxService();
  });
}

function afficherApercuTableauxService() {
  const zone = document.getElementById('service-preview');
  if (!zone || !importTableauxService) return;
  const parProf = repartirParProfesseur(importTableauxService.tables);
  const lignes = Object.keys(parProf).sort().map(cle => {
    const liste = parProf[cle];
    const minutes = heuresCreneaux(liste);
    const compte = comptes.find(x => x.email === cle);
    const alerte = minutes > 20 * 60;
    const classes = Array.from(new Set(liste.map(c => c.classe))).join(', ');
    return '<div class="flex justify-between items-center px-3 py-1.5 rounded-lg mb-1 ' +
      (alerte ? 'bg-red-50' : 'bg-green-50') + '">' +
      '<span class="text-sm text-gray-700">' + (compte ? compte.nom + ' (' + compte.matiere + ')' : cle) + '</span>' +
      '<span class="text-xs text-gray-500">' + formatDureeService(minutes) + ' · ' + liste.length + ' séance(s)' + (classes ? ' · ' + classes : '') + '</span>' +
      '</div>';
  }).join('');
  const total = importTableauxService.tables.reduce((som, t) => som + t.creneaux.length, 0);
  zone.classList.remove('hidden');
  zone.innerHTML =
    '<div class="bg-blue-50 border border-blue-200 rounded-xl p-4">' +
      '<p class="font-bold text-blue-900 mb-2"><i class="fas fa-check-circle"></i> ' + importTableauxService.tables.length +
        ' tableau(x) lisible(s) · ' + total + ' séance(s) · ' + Object.keys(parProf).length + ' professeur(s)</p>' +
      lignes +
      (importTableauxService.erreurs.length ? '<p class="text-xs text-red-600 mt-2">Ignoré : ' + importTableauxService.erreurs.join(' · ') + '</p>' : '') +
      '<p class="text-xs text-gray-500 mt-2">Les professeurs reconnus par leur matière sont reliés à leur compte ; les autres sont enregistrés sous leur nom. Une séance de plus de 20 h de service est signalée en rouge.</p>' +
      '<button onclick="confirmerImportTableauxService()" class="btn-primary w-full mt-3"><i class="fas fa-download"></i> Enregistrer les tableaux de service</button>' +
    '</div>';
}

function confirmerImportTableauxService() {
  if (!importTableauxService) return;
  const parProf = repartirParProfesseur(importTableauxService.tables);
  let profs = 0, totalMinutes = 0;
  Object.keys(parProf).forEach(cle => {
    tableauxService[cle] = parProf[cle].map(c => ({ jour: c.jour, debut: c.debut, fin: c.fin, classe: c.classe, salle: c.salle }));
    profs++;
    totalMinutes += heuresCreneaux(parProf[cle]);
  });
  sauvegarderTableauxService();
  importTableauxService = null;
  const zone = document.getElementById('service-preview');
  if (zone) { zone.classList.add('hidden'); zone.innerHTML = ''; }
  appliquerTableauService();
  afficherToast(profs + ' tableau(x) de service enregistré(s) · ' + formatDureeService(totalMinutes) + ' au total', 'success');
}

// ---- import des tableaux d'eleves (multi-fichiers) ----
async function importerTableauxEleves(input) {
  const fichiersChoisis = Array.from(input.files || []);
  const fichiersFET = fichiersChoisis.filter(estFichierFET);
  if (fichiersFET.length) {
    await importerElevesFET(fichiersFET);
    if (fichiersFET.length === fichiersChoisis.length) { input.value = ''; return; }
  }
  if (!(await xlsxPret())) return;
  const fichiers = Array.prototype.slice.call(input.files || []);
  input.value = '';
  if (!fichiers.length) return;
  importerXLSX(fichiers).then(feuilles => {
    const classesLues = [];
    const erreurs = [];
    feuilles.forEach(f => {
      if (f.erreur) { erreurs.push(f.fichier + ' : ' + f.erreur); return; }
      const c = analyserTableauElevesFeuille(f.ws, f.feuille);
      if (!c) { erreurs.push(f.fichier + ' / ' + f.feuille + ' : aucun eleve reconnu'); return; }
      classesLues.push(c);
    });
    if (!classesLues.length) {
      afficherErreurTableaux('Aucun eleve reconnu.' + (erreurs.length ? ' ' + erreurs.join(' · ') : ''));
      return;
    }
    importEleves = { classes: classesLues, erreurs: erreurs };
    afficherApercuEleves();
  });
}

function analyserTableauElevesFeuille(ws, nomFeuille) {
  if (!ws || typeof XLSX === 'undefined') return null;
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false, raw: false });
  let classe = '';
  for (let r = 0; r < Math.min(aoa.length, 15) && !classe; r++) {
    (aoa[r] || []).forEach((v, c) => {
      const t = texteCellule(v);
      if (!classe && /القسم|classe/i.test(t)) {
        const suite = t.split(/[:\u061A]/)[1];
        classe = (suite && suite.trim()) || texteCellule((aoa[r] || {})[c + 1]);
      }
    });
  }
  if (!classe && /^[A-Z0-9\-]{3,}$/i.test(String(nomFeuille || '').trim())) classe = String(nomFeuille).trim();

  // ligne d'en-tete (code MASSAR / nom)
  let ligneEntete = -1;
  for (let r = 0; r < Math.min(aoa.length, 25); r++) {
    const t = (aoa[r] || []).map(texteCellule).join(' | ');
    if (/رمز|رقم التلميذ|مسار|massar|code/i.test(t) && /الاسم|اسم|نسب|nom|prénom|prenom/i.test(t)) { ligneEntete = r; break; }
  }
  const indexCol = t => (aoa[ligneEntete] || []).findIndex(v => t.test(texteCellule(v)));
  let colCode = -1, colNomAr = -1, colNomFr = -1;
  if (ligneEntete >= 0) {
    colCode = indexCol(/رمز|رقم التلميذ|مسار|massar|code/i);
    colNomFr = indexCol(/nom|prénom|prenom|latin|français|francais/i);
    colNomAr = indexCol(/الاسم|اسم|نسب|arabe/i);
  }
  const eleves = [];
  const debut = ligneEntete >= 0 ? ligneEntete + 1 : 0;
  for (let r = debut; r < aoa.length; r++) {
    const ligne = aoa[r] || [];
    const codeCell = colCode >= 0 ? texteCellule(ligne[colCode]) : '';
    const ar = colNomAr >= 0 ? texteCellule(ligne[colNomAr]) : '';
    const fr = colNomFr >= 0 ? texteCellule(ligne[colNomFr]) : '';
    const noms = ligne.map(texteCellule).filter(t => t && t.length > 2 && !/^\d+([.,]\d+)?$/.test(t) && !numeroJour(t));
    const nomAr = ar || noms[0] || '';
    const nomFr = fr || (noms[1] || '');
    const code = codeCell || (ligne.map(texteCellule).find(t => /^[A-Z]{1,3}\d{4,}$/i.test(t)) || '');
    if (!nomAr && !nomFr) continue;
    if (/رمز|الاسم|القسم|ملاحظ|مجموع|توقيع|professeur|matière|classe|total|^note/i.test(ligne.map(texteCellule).join(' '))) continue;
    eleves.push({ massar: code, nomArabe: nomAr, nomFr: nomFr, nom: nomFr || nomAr });
  }
  if (!eleves.length) return null;
  if (!classe) classe = String(nomFeuille || 'Classe');
  return { classe: classe, eleves: eleves };
}

function afficherApercuEleves() {
  const zone = document.getElementById('eleves-preview');
  if (!zone || !importEleves) return;
  let nouveaux = 0, total = 0;
  const lignes = importEleves.classes.map(c => {
    const existante = classes.find(x => x.nom === c.classe);
    const codes = existante ? existante.eleves.map(e => String(e.massar || '')) : [];
    const nb = c.eleves.filter(e => !e.massar || codes.indexOf(e.massar) < 0).length;
    nouveaux += nb; total += c.eleves.length;
    return '<div class="flex justify-between items-center px-3 py-1.5 bg-green-50 rounded-lg mb-1">' +
      '<span class="text-sm text-gray-700">' + c.classe + (existante ? ' <span class="text-xs text-gray-400">(existante)</span>' : ' <span class="text-xs text-blue-600">(nouvelle classe)</span>') + '</span>' +
      '<span class="text-xs text-gray-500">' + c.eleves.length + ' élève(s) · ' + nb + ' nouveau(x)</span></div>';
  }).join('');
  zone.classList.remove('hidden');
  zone.innerHTML =
    '<div class="bg-blue-50 border border-blue-200 rounded-xl p-4">' +
      '<p class="font-bold text-blue-900 mb-2"><i class="fas fa-check-circle"></i> ' + importEleves.classes.length + ' classe(s) · ' +
        total + ' élève(s) · ' + nouveaux + ' à ajouter</p>' + lignes +
      (importEleves.erreurs.length ? '<p class="text-xs text-red-600 mt-2">Ignoré : ' + importEleves.erreurs.join(' · ') + '</p>' : '') +
      '<button onclick="confirmerImportEleves()" class="btn-primary w-full mt-3"><i class="fas fa-download"></i> Importer les élèves</button>' +
    '</div>';
}

function confirmerImportEleves() {
  if (!importEleves) return;
  let ajoutes = 0, nouvelles = 0, ignores = 0;
  const aSortir = [];
  importEleves.classes.forEach(c => {
    let cl = classes.find(x => x.nom === c.classe);
    if (!cl) { cl = { id: nextClasseId++, nom: c.classe, eleves: [] }; classes.push(cl); nouvelles++; }
    c.eleves.forEach(e => {
      const dejaLa = e.massar && cl.eleves.some(x => String(x.massar || '') === String(e.massar));
      if (dejaLa) { ignores++; return; }
      cl.eleves.push({ id: nextEleveId++, massar: e.massar || '', nomArabe: e.nomArabe || '', nomFr: e.nomFr || '', nom: e.nom || e.nomArabe || '', prenom: '' });
      ajoutes++;
    });
    // Eleves inscrits qui NE FIGURENT PLUS dans le fichier de cette classe : ils ont
    // peut-etre quitte l'etablissement. On ne decide pas a leur place : on PROPOSE.
    // (Seules les classes presentes dans le fichier sont examinees : un import partiel
    //  ne touche donc jamais les eleves des autres classes.)
    const codesFichier = {};
    c.eleves.forEach(e => { if (e.massar) codesFichier[String(e.massar)] = true; });
    cl.eleves.forEach(e => {
      if (estSorti(e)) return;
      if (!e.massar) return;
      if (!codesFichier[String(e.massar)]) aSortir.push({ classeId: cl.id, eleveId: e.id, nom: libelleEleve(e), classe: cl.nom });
    });
  });
  sauvegarderClasses();
  importEleves = null;
  const zone = document.getElementById('eleves-preview');
  if (zone) { zone.classList.add('hidden'); zone.innerHTML = ''; }
  afficherGestionDir();
  mettreAJourDashboardDir();
  remplirListeClasses();
  const resume = ajoutes + ' élève(s) ajouté(s) · ' + nouvelles + ' classe(s) créée(s)' + (ignores ? ' · ' + ignores + ' déjà présent(s)' : '');
  if (!aSortir.length) {
    afficherToast(resume, (ajoutes || nouvelles) ? 'success' : 'info');
    return;
  }
  // jamais silencieux : le directeur voit la liste et decide
  const noms = aSortir.map(x => x.nom + ' (' + x.classe + ')').join(', ');
  demanderConfirmation(resume + ' · ' + aSortir.length + ' élève(s) ne figurent plus dans le fichier : ' + noms +
    '. Les marquer comme « sortis » ? Ils disparaîtront de l\'appel du jour mais garderont leur historique.',
    function () {
      aSortir.forEach(x => {
        const cl = classes.find(c => c.id === x.classeId);
        const el = cl ? cl.eleves.find(e => e.id === x.eleveId) : null;
        if (el) el.actif = false;
      });
      sauvegarderClasses();
      afficherGestionDir();
      mettreAJourDashboardDir();
      afficherToast(aSortir.length + ' élève(s) marqué(s) sorti(s)', 'modif');
    });
  afficherToast(resume, (ajoutes || nouvelles) ? 'success' : 'info');
}

// ---- lecture xlsx generique (un ou plusieurs fichiers) ----
function importerXLSX(fichiers) {
  return Promise.all(fichiers.map(lireFichierXLSX)).then(liste => {
    const feuilles = [];
    liste.forEach(f => {
      if (f.erreur) { feuilles.push(f); return; }
      (f.wb.SheetNames || []).forEach(nom => feuilles.push({ fichier: f.fichier, feuille: nom, ws: f.wb.Sheets[nom] }));
    });
    return feuilles;
  });
}
function lireFichierXLSX(file) {
  return new Promise(resolve => {
    if (!file.name.match(/\.xlsx?$/i)) { resolve({ fichier: file.name, erreur: 'format non supporté (xlsx attendu)' }); return; }
    const lecteur = new FileReader();
    lecteur.onload = e => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        resolve({ fichier: file.name, wb: wb });
      } catch (err) { resolve({ fichier: file.name, erreur: 'lecture impossible (' + err.message + ')' }); }
    };
    lecteur.onerror = () => resolve({ fichier: file.name, erreur: 'lecture impossible' });
    lecteur.readAsArrayBuffer(file);
  });
}
function afficherErreurTableaux(message) {
  const div = document.getElementById('tableaux-error');
  if (!div) return;
  div.textContent = message;
  div.classList.remove('hidden');
}

// ========== DIRECTEUR — IMPORT MASSAR EXCEL ==========
let importData = null;
let importTableauxService = null;
let importEleves = null;

// Drag & drop
const dropZone = document.getElementById('drop-zone');
if (dropZone) {
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('border-blue-500', 'bg-blue-50'); });
  dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('border-blue-500', 'bg-blue-50'); });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-blue-500', 'bg-blue-50');
    const fichiers = Array.prototype.slice.call(e.dataTransfer.files || []);
    if (fichiers.length) processMassarFiles(fichiers);
  });
}

async function importerMassar(input) {
  if (!(await xlsxPret())) return;
  const fichiers = Array.prototype.slice.call(input.files || []);
  input.value = '';
  processMassarFiles(fichiers);
}

// Lecture d'un fichier MASSAR -> Promise { fichier, classes, erreur }
function lireFichierMASSAR(file) {
  return new Promise(function (resolve) {
    if (!file.name.match(/\.xlsx?$/i)) {
      resolve({ fichier: file.name, classes: [], erreur: 'format non supporté (xlsx attendu)' });
      return;
    }
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const classesTrouvees = [];
        workbook.SheetNames.forEach(nomFeuille => {
          const parsed = analyserFeuilleMASSAR(workbook.Sheets[nomFeuille]);
          if (parsed) classesTrouvees.push(parsed);
        });
        resolve({ fichier: file.name, classes: classesTrouvees, erreur: classesTrouvees.length ? '' : 'aucune classe détectée' });
      } catch (err) {
        resolve({ fichier: file.name, classes: [], erreur: err.message });
      }
    };
    reader.onerror = function () { resolve({ fichier: file.name, classes: [], erreur: 'lecture impossible' }); };
    reader.readAsArrayBuffer(file);
  });
}

// Un ou plusieurs fichiers : tous sont lus puis fusionnes en une seule preview
function processMassarFiles(fichiers) {
  const errorDiv = document.getElementById('import-error');
  const previewDiv = document.getElementById('import-preview');
  errorDiv.classList.add('hidden');
  previewDiv.classList.add('hidden');
  if (!fichiers || fichiers.length === 0) return;

  Promise.all(fichiers.map(lireFichierMASSAR)).then(function (resultats) {
    const classesTrouvees = [];
    const erreurs = [];
    resultats.forEach(function (r) {
      if (r.erreur) erreurs.push(r.fichier + ' : ' + r.erreur);
      r.classes.forEach(function (c) { classesTrouvees.push(c); });
    });
    if (classesTrouvees.length === 0) {
      errorDiv.textContent = 'Aucune classe détectée. Vérifiez le format MASSAR (nom de classe en I9, élèves à partir de la ligne 18, colonnes C = code, D = nom arabe, E = nom français).' + (erreurs.length ? ' Détail : ' + erreurs.join(' · ') : '');
      errorDiv.classList.remove('hidden');
      return;
    }
    importData = { classes: classesTrouvees };
    const total = classesTrouvees.reduce(function (acc, c) { return acc + c.eleves.length; }, 0);
    document.getElementById('preview-classe-nom').textContent = classesTrouvees.length + ' classe(s) détectée(s) dans ' + fichiers.length + ' fichier(s)';
    document.getElementById('preview-eleves-count').textContent = total + ' élève(s) au total';
    document.getElementById('preview-eleves-list').innerHTML = classesTrouvees.map(function (c) {
      return '<div class="flex justify-between py-1 border-b border-green-100"><span class="font-medium">' + c.nom + '</span><span class="text-xs text-gray-400">' + resumeImportClasse(c) + '</span></div>';
    }).join('') + (erreurs.length ? '<p class="text-xs text-red-600 pt-2">Ignoré : ' + erreurs.join(' · ') + '</p>' : '');
    previewDiv.classList.remove('hidden');
  });
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

// Cle de comparaison d'un nom (insensible a la casse, aux accents et aux espaces)
function cleNomEleve(e) {
  let txt = libelleEleve(e) || e.nomFr || e.nomArabe || '';
  txt = String(txt).toLowerCase();
  if (txt.normalize) txt = txt.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return txt.replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').trim();
}

// Apercu d'un fichier MASSAR : ce que la classe va devenir (nouveaux / deja presents)
function resumeImportClasse(c) {
  const exist = classes.find(x => String(x.nom).toLowerCase() === String(c.nom).toLowerCase());
  if (!exist) return c.eleves.length + ' élèves · nouvelle classe';
  const vus = {};
  exist.eleves.forEach(e => { if (e.massar) vus['c' + String(e.massar).trim()] = true; });
  const nb = c.eleves.filter(e => !(e.massar && vus['c' + String(e.massar).trim()])).length;
  if (!nb) return c.eleves.length + ' élèves · tous déjà présents';
  return nb + ' à ajouter · ' + (c.eleves.length - nb) + ' déjà présent(s)';
}

function confirmerImport() {
  if (!importData || !importData.classes) return;
  let nouvelles = 0, ajoutes = 0, dejaLa = 0, corriges = 0, rattaches = 0;
  const aSortir = [];
  importData.classes.forEach(clImport => {
    let existante = classes.find(c => String(c.nom).toLowerCase() === String(clImport.nom).toLowerCase());
    if (!existante) {
      existante = { id: nextClasseId++, nom: clImport.nom, eleves: [] };
      classes.push(existante);
      nouvelles++;
    }
    // Identite d'un eleve = son CODE MASSAR (le nom peut etre corrige dans MASSAR : on le suit).
    // Sans code, on retombe sur le nom. C'est ce qui evite les doublons au reimport.
    const parCode = {}, parNom = {};
    existante.eleves.forEach(e => {
      if (e.massar) parCode['c' + String(e.massar).trim()] = e;
      const k = cleNomEleve(e);
      if (k && !parNom[k]) parNom[k] = e;
    });
    clImport.eleves.forEach(e => {
      const code = e.massar ? 'c' + String(e.massar).trim() : '';
      const deja = (code && parCode[code]) || (!code && parNom[cleNomEleve(e)]) || null;
      if (deja) {
        // deja inscrit : on ne le recree pas, on met seulement son nom a jour
        dejaLa++;
        if (!estSorti(deja)) {
          if (e.nom && e.nom !== deja.nom) { deja.nom = e.nom; corriges++; }
          if (e.nomFr && e.nomFr !== deja.nomFr) deja.nomFr = e.nomFr;
          if (e.nomArabe && e.nomArabe !== deja.nomArabe) deja.nomArabe = e.nomArabe;
        }
        return;
      }
      const nouveau = { id: nextEleveId++, massar: e.massar || '', nomArabe: e.nomArabe || '', nomFr: e.nomFr || '', nom: e.nom || e.nomFr || e.nomArabe || '', prenom: e.prenom || '', actif: true };
      // Signalements orphelins (eleve supprime puis remis dans le fichier) : on les
      // rattache a sa nouvelle fiche au lieu de les laisser accroches a un id disparu.
      const knNouveau = cleNomEleve(nouveau) || cleNomEleve({ nom: e.nom || '', prenom: '', nomFr: '', nomArabe: '' });
      if (knNouveau) {
        absences.forEach(a => {
          if (a.classe !== existante.nom) return;
          if (!a.eleveId || existante.eleves.some(x => x.id === a.eleveId)) return;
          if (cleNomEleve({ nom: a.nom, prenom: '', nomFr: '', nomArabe: '' }) !== knNouveau) return;
          a.eleveId = nouveau.id;
          rattaches++;
        });
      }
      existante.eleves.push(nouveau);
      if (code) parCode[code] = nouveau;
      const kn = cleNomEleve(nouveau);
      if (kn) parNom[kn] = nouveau;
      ajoutes++;
    });
    // Eleves inscrits qui NE FIGURENT PLUS dans le fichier de cette classe : ils ont
    // peut-etre quitte l'etablissement. On ne decide pas a leur place : on PROPOSE.
    // (Seules les classes presentes dans le fichier sont examinees : un import partiel
    //  ne touche donc jamais les eleves des autres classes.)
    const codesFichier = {};
    clImport.eleves.forEach(e => { if (e.massar) codesFichier['c' + String(e.massar).trim()] = true; });
    existante.eleves.forEach(e => {
      if (estSorti(e) || !e.massar) return;
      if (!codesFichier['c' + String(e.massar).trim()]) aSortir.push({ classeId: existante.id, eleveId: e.id, nom: libelleEleve(e), classe: existante.nom });
    });
  });
  sauvegarderClasses();
  if (rattaches) Depot.ecrireJSON('absences', absences);
  const total = importData.classes.reduce((s, c) => s + c.eleves.length, 0);
  importData = null;
  document.getElementById('import-preview').classList.add('hidden');
  afficherGestionDir();
  mettreAJourDashboardDir();
  remplirListeClasses();
  const resume = nouvelles + ' classe(s) importée(s) · ' + ajoutes + ' élève(s) ajouté(s)' +
    (dejaLa ? ' · ' + dejaLa + ' déjà présent(s)' : '') +
    (corriges ? ' · ' + corriges + ' nom(s) corrigé(s)' : '') +
    (rattaches ? ' · ' + rattaches + ' signalement(s) rattaché(s)' : '') + ' — ' + total + ' au total';
  if (aSortir.length) {
    // jamais silencieux : le directeur voit les noms et decide
    const noms = aSortir.map(x => x.nom + ' (' + x.classe + ')').join(', ');
    demanderConfirmation(resume + ' · ' + aSortir.length + ' élève(s) ne figurent plus dans le fichier : ' + noms +
      '. Les marquer comme « sortis » ? Ils disparaîtront de l\'appel du jour mais garderont leur historique.',
      function () {
        aSortir.forEach(x => {
          const cl = classes.find(c => c.id === x.classeId);
          const el = cl ? cl.eleves.find(e => e.id === x.eleveId) : null;
          if (el) el.actif = false;
        });
        sauvegarderClasses();
        afficherGestionDir();
        mettreAJourDashboardDir();
        afficherToast(aSortir.length + ' élève(s) marqué(s) sorti(s)', 'modif');
      });
  }
  afficherToast(resume, (ajoutes || nouvelles || corriges || rattaches) ? 'success' : 'info');
}

// ========== DOUBLONS D'ELEVES (reparation) ==========
// Un ancien import a pu empiler deux fois la meme liste. On regroupe les eleves qui
// partagent le meme code MASSAR dans une classe, puis on FUSIONNE en gardant celui
// qui porte les signalements (l'historique suit).
function aDesSignalements(el, cl) {
  return absences.some(a => a.eleveId === el.id && a.classe === cl.nom);
}

function chercherDoublonsEleves() {
  const groupes = [];
  classes.forEach(cl => {
    const parCode = {}, parNom = {};
    cl.eleves.forEach(e => {
      if (e.massar) {
        const k = 'c' + String(e.massar).trim();
        (parCode[k] = parCode[k] || []).push(e);
      } else {
        const k = cleNomEleve(e);
        if (k) (parNom[k] = parNom[k] || []).push(e);
      }
    });
    Object.keys(parCode).forEach(k => {
      if (parCode[k].length > 1) groupes.push({ classe: cl, eleves: parCode[k], sur: 'code MASSAR' });
    });
    // Sans code MASSAR, on ne fusionne que si UN SEUL exemplaire porte des signalements
    // (sinon on pourrait confondre deux homonymes : on ne touche a rien).
    Object.keys(parNom).forEach(k => {
      const liste = parNom[k];
      if (liste.length < 2) return;
      const avec = liste.filter(e => aDesSignalements(e, cl));
      if (avec.length !== 1) return;
      groupes.push({ classe: cl, eleves: liste, sur: 'nom' });
    });
  });
  return groupes;
}

function verifierDoublonsEleves() {
  const groupes = chercherDoublonsEleves();
  if (!groupes.length) {
    afficherToast('Aucun doublon d\'élève détecté', 'info');
    return;
  }
  const nb = groupes.reduce(function (acc, g) { return acc + g.eleves.length - 1; }, 0);
  const detail = groupes.map(function (g) {
    return libelleEleve(g.eleves[0]) + ' (' + g.classe.nom + ' ×' + g.eleves.length + ')';
  }).join(', ');
  demanderConfirmation(nb + ' doublon(s) détecté(s) : ' + detail +
    '. Les fusionner ? Le signalement de chaque élève est conservé (une seule fiche par élève).',
    function () { fusionnerDoublonsEleves(groupes); });
}

function fusionnerDoublonsEleves(groupes) {
  let fusionnes = 0, rattaches = 0, ecartes = 0;
  groupes.forEach(function (g) {
    const cl = g.classe;
    const nbSig = function (e) { return absences.filter(a => a.eleveId === e.id && a.classe === cl.nom).length; };
    // on garde l'exemplaire qui porte le plus de signalements (a egalite : le plus ancien)
    const tries = g.eleves.slice().sort(function (a, b) { return nbSig(b) - nbSig(a) || a.id - b.id; });
    const garde = tries[0];
    tries.slice(1).forEach(function (doublon) {
      absences = absences.filter(function (a) {
        if (a.eleveId !== doublon.id || a.classe !== cl.nom) return true;
        // meme eleve + meme jour + meme seance deja present -> le doublon exact disparait
        const dejaLa = absences.some(function (b) {
          return b !== a && b.eleveId === garde.id && b.classe === cl.nom &&
            b.dateISO === a.dateISO && (b.seance || 'matin') === (a.seance || 'matin');
        });
        if (dejaLa) { ecartes++; return false; }
        a.eleveId = garde.id;
        rattaches++;
        return true;
      });
      cl.eleves = cl.eleves.filter(function (e) { return e.id !== doublon.id; });
      fusionnes++;
    });
    // le nom garde doit rester lisible meme s'il etait vide sur l'exemplaire conserve
    if (!garde.nom) garde.nom = garde.nomFr || garde.nomArabe || '';
  });
  sauvegarderClasses();
  Depot.ecrireJSON('absences', absences);
  afficherGestionDir();
  mettreAJourDashboardDir();
  remplirListeClasses();
  afficherToast(fusionnes + ' doublon(s) fusionné(s)' +
    (rattaches ? ' · ' + rattaches + ' signalement(s) rattaché(s)' : '') +
    (ecartes ? ' · ' + ecartes + ' en double écarté(s)' : ''), 'modif');
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



// ========== RECHERCHER LES ELEVES QUI N'ONT PAS DE CODE MASSAR (lecture seule) ==========
// Sans code MASSAR, un eleve ne peut etre ni reconnu lors d'un import, ni propose
// comme « sorti » : il resterait melange aux vrais eleves. Cet outil les RETROUVE
// et les LISTE, classe par classe. Il ne modifie rien (v3.96 : avant, il inventait
// un code temporaire — l'utilisateur a demande une simple recherche).
function elevesSansCode() {
  const liste = [];
  classes.forEach(c => c.eleves.forEach(e => {
    if (!String(e.massar || '').trim()) {
      liste.push({ classe: c.nom, classeId: c.id, eleveId: e.id, eleve: libelleEleve(e) });
    }
  }));
  return liste;
}

function rechercherElevesSansCode() {
  const cont = document.getElementById('massar-manquants-liste');
  if (!cont) return;
  const liste = elevesSansCode();
  cont.classList.remove('hidden');
  cont.innerHTML = '';
  if (!liste.length) {
    // meme comportement que « Rechercher les doublons d'élèves » : une notification le dit
    afficherToast('Aucun élève sans code MASSAR détecté', 'info');
    cont.innerHTML = '<p class="text-sm text-gray-500 text-center py-2">Tous les élèves ont un code MASSAR.</p>';
    return;
  }
  const total = document.createElement('p');
  total.className = 'text-sm font-bold text-gray-700 mb-2';
  total.textContent = liste.length + ' élève(s) sans code MASSAR';
  cont.appendChild(total);
  let classeCourante = '';
  liste.forEach(r => {
    if (r.classe !== classeCourante) {
      classeCourante = r.classe;
      const entete = document.createElement('p');
      entete.className = 'text-xs font-bold text-gray-500 mt-2 mb-1';
      entete.textContent = classeCourante + ' · ' + liste.filter(x => x.classe === classeCourante).length + ' élève(s)';
      cont.appendChild(entete);
    }
    const item = document.createElement('div');
    item.className = 'flex justify-between items-center p-3 bg-gray-50 rounded-lg mb-1';
    item.style.cursor = 'pointer';
    item.onclick = () => ouvrirFicheEleve(r.eleveId, r.classeId);
    item.innerHTML = '<p class="font-medium text-gray-800">' + r.eleve + '</p>' +
      '<span class="text-xs text-gray-500">sans code</span>';
    cont.appendChild(item);
  });
}
// ========== FICHE ELEVE ==========
let ficheEleveId = null;
let ficheClasseId = null;

function ligneFiche(titre, valeur) {
  return '<div class="flex justify-between py-2 border-b border-gray-200"><span class="text-xs font-bold text-gray-500">' + titre + '</span><span class="text-sm font-semibold text-gray-800">' + valeur + '</span></div>';
}

// Cascade de la fiche eleve : les lignes de l'historique montent l'une apres l'autre, et les
// boutons restent INERTES tant qu'ils sont invisibles (un appui a l'aveugle ne doit rien faire).
let ficheAnimMinuterie = null;

function animerFicheEleve() {
  const modal = document.getElementById('modal-fiche-eleve');
  if (!modal) return;
  const cont = document.getElementById('fiche-historique');
  if (cont) {
    Array.prototype.forEach.call(cont.children, function (ligne, i) {
      ligne.classList.add('fiche-ligne');
      ligne.style.animationDelay = Math.min(0.24 + i * 0.05, 0.6).toFixed(2) + 's';
    });
  }
  const blocs = modal.querySelectorAll('.fiche-anim');
  Array.prototype.forEach.call(blocs, function (b) { b.classList.remove('pret'); });
  // relance l'animation meme si la fiche etait deja ouverte
  Array.prototype.forEach.call(blocs, function (b) { b.style.animation = 'none'; });
  void modal.offsetWidth;
  Array.prototype.forEach.call(blocs, function (b) { b.style.animation = ''; });
  if (ficheAnimMinuterie) clearTimeout(ficheAnimMinuterie);
  ficheAnimMinuterie = setTimeout(function () {
    Array.prototype.forEach.call(blocs, function (b) { b.classList.add('pret'); });
  }, 820);
}

function ouvrirFicheEleve(eleveId, classeId) {
  const cl = classes.find(c => c.id === classeId);
  if (!cl) return;
  const el = cl.eleves.find(e => e.id === eleveId);
  if (!el) return;
  ficheEleveId = eleveId;
  ficheClasseId = classeId;
  document.getElementById('fiche-titre').textContent = libelleEleve(el);
  let lignes = absences.filter(a => a.eleveId === eleveId && a.classe === cl.nom);
  // Un enseignant ne voit que les Ab/Rd qu'il a lui-meme signales
  if (utilisateurConnecte && utilisateurConnecte.role === 'enseignant') {
    lignes = lignes.filter(a => a.enseignant === utilisateurConnecte.nom);
  }
  const nbAbs = lignes.filter(a => typeEffectif(a) !== 'retard').length;
  const nbRet = lignes.filter(a => typeEffectif(a) === 'retard').length;
  document.getElementById('fiche-infos').innerHTML =
    ligneFiche('Classe', cl.nom) +
    ligneFiche('Code MASSAR', el.massar || '—') +
    ligneFiche('Nom français', el.nomFr || el.nom || '—') +
    ligneFiche('Totaux', nbAbs + ' ' + (nbAbs < 2 ? 'absence' : 'absences') + ' · ' + nbRet + ' ' + (nbRet < 2 ? 'retard' : 'retards'));

  const cont = document.getElementById('fiche-historique');
  if (lignes.length === 0) {
    cont.innerHTML = '<p class="text-gray-500 text-center py-4">Aucun incident enregistré</p>';
  } else {
    // Tri par datetime decroissant (date puis heure)
    const tri = lignes.slice().sort((a, b) => {
      const da = String(a.dateISO || '');
      const db = String(b.dateISO || '');
      if (da !== db) return db.localeCompare(da);
      return String(b.heure || '').localeCompare(String(a.heure || ''));
    });
    cont.innerHTML = tri.map(a => {
      const retard = typeEffectif(a) === 'retard';
      const code = codeApprobation(a);
      const marque = retard ? 'Rd' : 'Ab';
      const palM = couleursAbsRd();
      const styleMarque = 'color: ' + (retard ? palM.rd : palM.abs) + '; font-weight: 800;';
      const info = abrevMatiere(a.matiere) + ' · ' + (a.enseignant || '') + (a.motif ? ' · Motif : ' + a.motif : '');
      // Un Ab/Rd regle a toujours sa ligne d'approbation ; si l'enregistrement est ancien
      // (pas de justifieLe), on retombe sur la datetime de l'absence, puis sur '—'.
      const quandApprobation = a.justifieLe || (a.dateISO ? (String(a.dateISO) + (a.heure ? ' ' + a.heure : '')) : '');
      const ligneApprobation = code
        ? '<div class="flex justify-between items-center mt-1"><span class="text-xs text-gray-500">Approuvé le ' + (quandApprobation ? dateHeureApprobation(quandApprobation) : '—') + '</span><span style="' + styleMarque + '; font-size: 12px;">' + code + '</span></div>'
        : '';
      return '<div class="py-2 border-b border-gray-200"><div class="flex justify-between items-center"><span class="text-sm font-semibold text-gray-800">' + (a.date || '') + ' · ' + (a.heure || '') + '</span><span style="' + styleMarque + '">' + marque + '</span></div>' + ligneApprobation + '<p class="text-xs text-gray-500 mt-1">' + info + '</p></div>';
    }).join('');
  }
  animerFicheEleve();
  document.getElementById('modal-fiche-eleve').classList.remove('hidden');
}

function ouvrirFicheEleveParNom(nom, nomClasse) {
  const cible = String(nom || '').replace(/\s+/g, ' ').trim();
  const cl = classes.find(c => c.nom === nomClasse)
    || classes.find(c => String(c.nom || '').toLowerCase() === String(nomClasse || '').toLowerCase());
  if (!cl) { afficherToast('Élève introuvable', 'error'); return; }
  const meme = e => String(libelleEleve(e) || '').replace(/\s+/g, ' ').trim() === cible;
  const el = cl.eleves.find(meme)
    || cl.eleves.find(e => String(e.nom || '').replace(/\s+/g, ' ').trim() === cible)
    || cl.eleves.find(e => String(e.nomFr || '').replace(/\s+/g, ' ').trim() === cible)
    || cl.eleves.find(e => String(e.nomArabe || '').replace(/\s+/g, ' ').trim() === cible);
  if (!el) { afficherToast('Élève introuvable', 'error'); return; }
  ouvrirFicheEleve(el.id, cl.id);
}

function fermerFicheEleve() {
  if (ficheAnimMinuterie) clearTimeout(ficheAnimMinuterie);
  const mf = document.getElementById('modal-fiche-eleve');
  if (mf) Array.prototype.forEach.call(mf.querySelectorAll('.fiche-anim.pret'), function (b) { b.classList.remove('pret'); });
  document.getElementById('modal-fiche-eleve').classList.add('hidden');
  ficheEleveId = null;
  ficheClasseId = null;
}

async function exporterFicheEleve() {
  if (!(await xlsxPret())) return;
  if (!ficheEleveId) return;
  const cl = classes.find(c => c.id === ficheClasseId);
  const el = cl ? cl.eleves.find(e => e.id === ficheEleveId) : null;
  if (!el) return;
  const lignes = absences.filter(a => a.eleveId === ficheEleveId && a.classe === cl.nom);
  const rows = lignes.map(a => ({
    Date: a.date || '',
    Seance: libelleSeance(a.seance),
    Heure: a.heure || '',
    Type: libelleType(typeEffectif(a)),
    Duree: a.duree || '',
    Matiere: a.matiere || '',
    Enseignant: a.enseignant || '',
    Statut: libelleStatutAbs(a),
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

// ========== PROFIL & MOT DE PASSE ==========
// Page Profil : RH pour le directeur (identite compacte + bouton Profil + rubriques RH)
function afficherRH() {
  const estDir = !!utilisateurConnecte && utilisateurConnecte.role === 'directeur';
  const rh = document.getElementById('profil-rh');
  if (rh) rh.style.display = estDir ? 'block' : 'none';
  const btnP = document.getElementById('btn-profil-dir');
  if (btnP) btnP.style.display = estDir ? 'inline-flex' : 'none';
  // le formulaire de mot de passe reste sur la page pour les autres roles (il est dans le popup pour le directeur)
  const mdpPage = document.getElementById('profil-mdp-page');
  if (mdpPage) mdpPage.style.display = estDir ? 'none' : 'block';
  if (estDir) {
    bornerDatesAnnee();
    remplirProfsIndispo();
    afficherListeProfs();
    afficherIndispos();
  }
}

function switchProfil(el) {
  afficherEcran('profil');
  afficherTableauServiceProfil();
  afficherRH();
  // Cacher tous les nav profil
  ['profil-nav-ens', 'profil-nav-surv', 'profil-nav-dir'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  // Afficher le bon nav selon le rôle
  if (utilisateurConnecte) {
    let navId = 'profil-nav-ens';
    if (utilisateurConnecte.role === 'surveillant') navId = 'profil-nav-surv';
    else if (utilisateurConnecte.role === 'directeur') navId = 'profil-nav-dir';
    const nav = document.getElementById(navId);
    if (nav) nav.style.display = 'flex';
    const nomEl = document.getElementById('profil-nom');
    const roleEl = document.getElementById('profil-role');
    if (nomEl) nomEl.textContent = utilisateurConnecte.nom;
    if (roleEl) roleEl.textContent = utilisateurConnecte.role.charAt(0).toUpperCase() + utilisateurConnecte.role.slice(1) + (utilisateurConnecte.matiere ? ' · ' + utilisateurConnecte.matiere : '');
  }
  // Reset champs
  document.getElementById('profil-ancien').value = '';
  document.getElementById('profil-nouveau').value = '';
  document.getElementById('profil-confirmer').value = '';
  document.getElementById('profil-error').classList.add('hidden');
  document.getElementById('profil-success').classList.add('hidden');
}

function validerMotDePasse(mdp) {
  if (mdp.length < 6) return 'Le mot de passe doit contenir au moins 6 caractères';
  if (!/[a-zA-Z]/.test(mdp)) return 'Le mot de passe doit contenir au moins une lettre';
  if (!/[0-9]/.test(mdp)) return 'Le mot de passe doit contenir au moins un chiffre';
  if (/[^a-zA-Z0-9]/.test(mdp)) return 'Le mot de passe ne doit contenir que des lettres et des chiffres (pas de caractères spéciaux)';
  return null;
}

function motDePasseSaisi(prefixe) {
  const lire = k => { const el = document.getElementById(prefixe + '-' + k); return el ? String(el.value || '') : ''; };
  const ancien = lire('ancien');
  const nouveau = lire('nouveau');
  const confirmer = lire('confirmer');
  return { ancien: ancien, nouveau: nouveau, confirmer: confirmer, vide: (!ancien && !nouveau && !confirmer) };
}

// prefixe = 'profil' (page Profil) ou 'mdpdir' (popup Mon profil du directeur)
function changerMotDePasse(prefixe) {
  // ECOLE RELIEE A LA BASE : c'est le SERVEUR qui verifie l'ancien mot de passe et qui
  // enregistre le nouveau (le telephone ne les connait pas).
  if (typeof estModeEcole === 'function' && estModeEcole()) { changerMotDePasseServeur(prefixe); return; }
  const p = prefixe || 'profil';
  const champs = motDePasseSaisi(p);
  const ancien = champs.ancien;
  const nouveau = champs.nouveau;
  const confirmer = champs.confirmer;
  const errDiv = document.getElementById(p + '-error');
  const sucDiv = document.getElementById(p + '-success');

  errDiv.classList.add('hidden');
  sucDiv.classList.add('hidden');

  if (!ancien || !nouveau || !confirmer) {
    errDiv.textContent = 'Veuillez remplir tous les champs';
    errDiv.classList.remove('hidden');
    return;
  }
  if (ancien !== utilisateurConnecte.password) {
    errDiv.textContent = "L'ancien mot de passe est incorrect";
    errDiv.classList.remove('hidden');
    return;
  }
  const erreur = validerMotDePasse(nouveau);
  if (erreur) {
    errDiv.textContent = erreur;
    errDiv.classList.remove('hidden');
    return;
  }
  if (nouveau !== confirmer) {
    errDiv.textContent = 'Les deux mots de passe ne correspondent pas';
    errDiv.classList.remove('hidden');
    return;
  }
  if (nouveau === ancien) {
    errDiv.textContent = 'Le nouveau mot de passe doit différer de l\'ancien';
    errDiv.classList.remove('hidden');
    return;
  }
  // Mettre à jour dans comptes + persister (via Depot)
  const idx = comptes.findIndex(c => c.email === utilisateurConnecte.email);
  if (idx >= 0) {
    comptes[idx].password = nouveau;
    utilisateurConnecte.password = nouveau;
    Depot.ecrireJSON('utilisateur', utilisateurConnecte);
  }
  motsDePasse[utilisateurConnecte.email] = nouveau;
  sauvegarderMotsDePasse();
  ['ancien', 'nouveau', 'confirmer'].forEach(k => { const el = document.getElementById(p + '-' + k); if (el) el.value = ''; });
  sucDiv.textContent = 'Mot de passe modifié avec succès !';
  sucDiv.classList.remove('hidden');
  afficherToast('Mot de passe modifié', 'modif');
}

// ========== POPUP "MON PROFIL" (directeur) ==========
function ouvrirProfilDir() {
  if (!utilisateurConnecte) return;
  const nom = document.getElementById('mdpdir-nom');
  if (nom) nom.value = utilisateurConnecte.nom || '';
  const mail = document.getElementById('mdpdir-email');
  if (mail) mail.textContent = 'Connexion : ' + (utilisateurConnecte.email || '');
  ['ancien', 'nouveau', 'confirmer'].forEach(k => { const el = document.getElementById('mdpdir-' + k); if (el) el.value = ''; });
  const err = document.getElementById('mdpdir-error');
  if (err) err.classList.add('hidden');
  const suc = document.getElementById('mdpdir-success');
  if (suc) suc.classList.add('hidden');
  document.getElementById('modal-profil-dir').classList.remove('hidden');
}
function fermerProfilDir() {
  const m = document.getElementById('modal-profil-dir');
  if (m) m.classList.add('hidden');
}
function enregistrerProfilDir() {
  if (!utilisateurConnecte) return;
  const champNom = document.getElementById('mdpdir-nom');
  const nom = champNom ? String(champNom.value || '').replace(/\s+/g, ' ').trim() : '';
  if (nom && nom.length < 3) { afficherToast('Nom trop court (3 caractères minimum)', 'error'); return; }
  if (nom) {
    const cle = utilisateurConnecte.code || utilisateurConnecte.email;
    const ancien = utilisateurConnecte.nom;
    nomsProfs[cle] = nom;
    sauvegarderNomsProfs();
    comptes.forEach(c => { if (c.email === utilisateurConnecte.email) c.nom = nom; });
    utilisateurConnecte.nom = nom;
    Depot.ecrireJSON('utilisateur', utilisateurConnecte);
    if (ancien && ancien !== nom) {
      let maj = 0;
      absences.forEach(a => { if (a.enseignant === ancien) { a.enseignant = nom; maj++; } });
      if (maj > 0) Depot.ecrireJSON('absences', absences);
    }
    const elNom = document.getElementById('profil-nom');
    if (elNom) elNom.textContent = nom;
  }
  // Mot de passe : uniquement si les champs sont remplis
  if (!motDePasseSaisi('mdpdir').vide) { changerMotDePasse('mdpdir'); return; }
  const suc = document.getElementById('mdpdir-success');
  if (suc) { suc.textContent = 'Profil enregistré'; suc.classList.remove('hidden'); }
  afficherToast('Profil enregistré', 'modif');
}

// ========== LOTS DE COULEURS PAR ROLE (thème clair) ==========
// Theme clair unique (les 3 roles partagent la meme palette)
const LOT_CLAIR = {
  fond: '#F4F6FA', primaire: '#26395A', fonce: '#6E7E93', accent: '#E15F67',
  clair: '#EDF1F7', bordure: '#D7E0EA', neutre: '#6E7E93', secondaire: '#0C829F'
};
const LOTS_ROLE = { enseignant: LOT_CLAIR, surveillant: LOT_CLAIR, directeur: LOT_CLAIR };

// Absence = toujours ROUGE, Retard = toujours ORANGE (+ degradations)
const COULEUR_ABSENCE = '#ef4444';
const COULEUR_RETARD = '#f59e0b';

function appliquerRoleTheme() {
  const b = document.body.classList;
  b.remove('role-enseignant', 'role-surveillant', 'role-directeur');
  if (utilisateurConnecte && utilisateurConnecte.role) b.add('role-' + utilisateurConnecte.role);
}

function couleursAbsRd() {
  return { abs: COULEUR_ABSENCE, rd: COULEUR_RETARD };
}

function eclaircir(hex, ratio) {
  const r = parseInt(hex.slice(1, 3), 16);
  const v = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const melange = c => Math.round(c + (255 - c) * ratio);
  return '#' + [melange(r), melange(v), melange(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

function teinte(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const v = parseInt(hex.slice(3, 5), 16);
  const b2 = parseInt(hex.slice(5, 7), 16);
  return 'rgba(' + r + ',' + v + ',' + b2 + ',' + alpha + ')';
}

// ========== MOTIF DE JUSTIFICATION ==========
function choisirMotif(motif, el) {
  const champ = document.getElementById('select-motif');
  if (champ) champ.value = motif;
  document.querySelectorAll('#chips-motif .motif-chip').forEach(c => c.classList.remove('actif'));
  if (el) el.classList.add('actif');
}

// ========== HAUTEUR DE LA BARRE DU HAUT ==========
function ajusterHauteurAppbar() {
  // Les barres des pages masquees ont une hauteur de 0 : on prend la plus grande
  let h = 0;
  document.querySelectorAll('.appbar').forEach(b => { if (b.offsetHeight > h) h = b.offsetHeight; });
  if (h > 0) document.documentElement.style.setProperty('--appbar-h', h + 'px');
}
window.addEventListener('resize', ajusterHauteurAppbar);
window.addEventListener('orientationchange', ajusterHauteurAppbar);

// ========== DONNEES DE TEST (historique aleatoire, une seule fois) ==========
function genererDonneesTestHistorique() {
  if (Depot.lire('testHistoGenere_v6', null)) return;
  const motifs = ['Maladie', 'Raison familiale', 'Raison personnelle', 'Transport', 'Autre'];
  const durees = ['15 min', '30 min', '1 h'];

  // Creneaux REELS d'une classe : { jour -> [{debut, matiere, prof}] } (issus des tableaux des eleves)
  function creneauxClasse(nom) {
    const par = {};
    Object.keys(tableauxService).forEach(mail => (tableauxService[mail] || []).forEach(c => {
      if (c.classe !== nom) return;
      const j = String(c.jour);
      par[j] = par[j] || [];
      if (!par[j].some(x => x.debut === c.debut)) par[j].push({ debut: c.debut, matiere: c.matiere, prof: c.prof });
    }));
    return par;
  }
  const ficheProf = code => comptes.find(x => x.code === code) || comptes.find(x => x.email === code + '@taalim.ma') || null;
  const heurePlus = (h, min) => {
    const p = String(h).split(':');
    let t = (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0) + min;
    if (t > 23 * 60 + 59) t = 23 * 60 + 59;
    return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
  };
  const tirer = arr => arr[Math.floor(Math.random() * arr.length)];

  // 1 retard justifie sur 4 est approuve APRES les 30 min (demonstration de la transformation en absence)
  let compteurRetardsJustifies = 0;

  // Un Ab/Rd toujours cale sur un creneau reel de la classe (heure + matiere + enseignant de la seance)
  function creer(eleve, classe, creneau, dateISO, justifie, typeForce) {
    const estRetard = typeForce ? (typeForce === 'retard') : (Math.random() < 0.3);
    const p = ficheProf(creneau.prof);
    const par = justifie ? tirer(['Surveillant 1', 'Surveillant 2', 'Directeur']) : '';
    return {
      id: Date.now() + Math.random(),
      eleveId: eleve.id,
      nom: libelleEleve(eleve),
      classe: classe.nom,
      heure: creneau.debut,
      date: dateAffichage(dateISO),
      dateISO: dateISO,
      seance: creneau.debut < '13:00' ? 'matin' : 'apres-midi',
      type: estRetard ? 'retard' : 'absence',
      duree: estRetard ? tirer(durees) : '',
      statut: justifie ? (/directeur/i.test(par) ? 'justifie_d' : 'justifie_s') : 'absent',
      enseignant: p ? p.nom : '',
      matiere: creneau.matiere || (p ? p.matiere : ''),
      profCode: creneau.prof || '',
      motif: justifie ? tirer(motifs) : '',
      justifiePar: par,
      justifieLe: justifie ? dateISO + ' ' + heurePlus(creneau.debut, estRetard ? ((compteurRetardsJustifies++ % 4 === 3) ? 40 + Math.floor(Math.random() * 50) : 5 + Math.floor(Math.random() * 20)) : 30) : '',
      test: true
    };
  }

  // Purge de TOUS les Ab/Rd de test precedents (donnees de demonstration uniquement)
  absences = absences.filter(a => !a.test);

  const creneaux = {};
  classes.forEach(cl => { creneaux[cl.nom] = creneauxClasse(cl.nom); });
  const aujourdHui = new Date();

  // Non justifies : un eleve different par Ab/Rd, et jamais deux fois le meme eleve
  // (regle metier : un seul Ab/Rd non justifie par eleve)
  const dejaNonJustifie = {};
  function placerNonJustifies(nombre, dateISO, jour, matinSeulement, types) {
    const cands = [];
    classes.forEach(cl => {
      const liste = ((creneaux[cl.nom] || {})[String(jour)] || []).filter(c => !matinSeulement || c.debut < '12:00');
      if (!liste.length) return;
      cl.eleves.forEach(el => { if (!dejaNonJustifie[el.id]) cands.push({ cl: cl, el: el, cr: tirer(liste) }); });
    });
    let n = 0;
    while (n < nombre && cands.length) {
      const p = cands.splice(Math.floor(Math.random() * cands.length), 1)[0];
      dejaNonJustifie[p.el.id] = true;
      absences.push(creer(p.el, p.cl, p.cr, dateISO, false, types ? types[n] : ''));
      n++;
    }
  }

  // A) Historique : du 1er septembre a hier, tous APPROUVES (S1 / S2 / D)
  const debut = new Date(aujourdHui.getFullYear(), 8, 1);
  const hier = new Date(aujourdHui); hier.setDate(hier.getDate() - 1);
  for (let d = new Date(debut); d <= hier; d.setDate(d.getDate() + 1)) {
    const jour = d.getDay();
    if (jour === 0 || jour === 6) continue;            // pas de cours le week-end
    const dateISO = fmtDateISO(d);
    classes.forEach(cl => {
      const liste = (creneaux[cl.nom] || {})[String(jour)] || [];
      if (!liste.length || !cl.eleves.length) return;
      const nb = 1 + Math.floor(Math.random() * 3);
      const pris = [];
      for (let i = 0; i < nb; i++) {
        const cr = tirer(liste);
        const el = tirer(cl.eleves);
        const cle = el.id + '|' + cr.debut + '|' + dateISO;
        if (pris.indexOf(cle) >= 0) continue;
        pris.push(cle);
        absences.push(creer(el, cl, cr, dateISO, true));
      }
    });
  }

  // B) Hier : 2 Ab/Rd NON justifies ; C) Aujourd'hui : Ab/Rd NON justifies du MATIN uniquement
  placerNonJustifies(2, fmtDateISO(hier), hier.getDay(), false, ['absence', 'retard']);
  placerNonJustifies(4, fmtDateISO(aujourdHui), aujourdHui.getDay(), true, ['absence', 'retard', 'retard', 'absence']);

  Depot.ecrireJSON('absences', absences);
  Depot.ecrire('testHistoGenere_v6', '1');
}

// ========== INIT ==========
function init() {
  if (typeof appliquerModeEcole === 'function') appliquerModeEcole();
  // relecture de la liste des surveillants AVANT de la reinjecter dans les comptes
  // (sans cette ligne, un surveillant ajoute disparaissait au redemarrage)
  surveillantsRH = chargerSurveillantsRH();
  appliquerNomsProfs();
  appliquerMotsDePasse(); appliquerListeSurveillants();
  majEtiquetteAnnee();
  majOptionsSemestres();
  // L'historique de demonstration ne se fabrique que sur un telephone de demonstration.
  // Une ecole livree commence VIDE.
  if (modeDemonstration()) genererDonneesTestHistorique();
  const saved = Depot.lire('utilisateur', null);
  if (saved) {
    try {
      const compte = JSON.parse(saved);
      const valid = comptes.find(c => c.email === compte.email && c.role === compte.role);
      if (valid) {
        utilisateurConnecte = valid;
        appliquerRoleTheme();
        if (valid.role === 'enseignant') { afficherEcran('enseignant'); remplirListeClasses(); choisirClasse(''); afficherInfosProf(); appliquerTableauService(); }
        else if (valid.role === 'surveillant') { afficherEcran('surveillant'); mettreAJourDashboardSurv(); afficherSeancesAnnulees(); }
        else if (valid.role === 'directeur') { afficherEcran('directeur'); mettreAJourDashboardDir(); afficherSeancesAnnulees(); }
        return;
      }
    } catch(e) {}
  }
  // en mode ecole, une session deja ouverte se rouvre toute seule (on voit la page du role)
  if (typeof estModeEcole === 'function' && estModeEcole()) {
    afficherEcran('login');
    rouvrirSessionSiBesoin();
    return;
  }
  afficherEcran('login');
}

// Enter key pour login
document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && document.getElementById('page-login').classList.contains('active')) {
    connexion();
  }
});

// init() est appele par le DERNIER module (18-connexion.js) : lance ici, il tombait avant
// que les fonctions du serveur soient declarees (defaut trouve par le banc v4.03).

// ========== LISTES DEROULANTES PERSONNALISEES ==========
function sdOptionCourante(select) { return select.options[select.selectedIndex] || null; }

function sdMajLibelle(conteneur) {
  const select = conteneur.querySelector('select');
  const bouton = conteneur.querySelector('.sd-trigger');
  const span = conteneur.querySelector('.sd-trigger > span');
  if (!select || !bouton || !span) return;
  const opt = sdOptionCourante(select);
  const texte = opt ? opt.textContent : '---';
  if (span.textContent !== texte) span.textContent = texte;
  if (bouton.disabled !== !!select.disabled) bouton.disabled = !!select.disabled;
  const desactive = select.disabled ? '0.55' : '1';
  if (bouton.style.opacity !== desactive) bouton.style.opacity = desactive;
}

function sdRafraichirTout() {
  const tous = document.querySelectorAll('.sd');
  for (let i = 0; i < tous.length; i++) sdMajLibelle(tous[i]);
}

function sdFermerTout() {
  const ouverts = document.querySelectorAll('.sd.ouvert');
  for (let i = 0; i < ouverts.length; i++) ouverts[i].classList.remove('ouvert');
  sdRafraichirTout();
}

function sdConstruireOptions(conteneur) {
  const select = conteneur.querySelector('select');
  const panneau = conteneur.querySelector('.sd-panel');
  panneau.innerHTML = '';
  Array.prototype.forEach.call(select.options, function (opt, index) {
    const ligne = document.createElement('div');
    ligne.className = 'sd-option' + (index === select.selectedIndex ? ' actif' : '') + (opt.value === '' ? ' vide' : '');
    ligne.innerHTML = '<span>' + opt.textContent + '</span><i class="fas fa-check"></i>';
    ligne.addEventListener('click', function (ev) {
      ev.stopPropagation();
      select.value = opt.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      sdFermerTout();
      sdMajLibelle(conteneur);
    });
    panneau.appendChild(ligne);
  });
  const actif = panneau.querySelector('.sd-option.actif');
  if (actif && actif.scrollIntoView) { try { actif.scrollIntoView({ block: 'nearest' }); } catch (e) {} }
}

// Place la liste : en dessous s'il y a la place, sinon AU-DESSUS (jamais cachee sous les boutons).
function sdPlacer(conteneur) {
  const panneau = conteneur.querySelector('.sd-panel');
  const bouton = conteneur.querySelector('.sd-trigger');
  if (!panneau || !bouton) return;
  conteneur.classList.remove('sd-haut');
  panneau.style.maxHeight = '';
  const rb = bouton.getBoundingClientRect ? bouton.getBoundingClientRect() : null;
  if (!rb || (!rb.top && !rb.bottom)) return;          // pas de geometrie (tests jsdom) : on ne touche a rien
  const marge = 12;
  const hauteurVoulue = Math.min(panneau.scrollHeight || 264, 264);
  // limite visible : le premier ancetre qui defile (corps du formulaire), sinon la fenetre
  let bas = window.innerHeight || 800, haut = 0, zone = conteneur.parentElement;
  while (zone) {
    const st = window.getComputedStyle(zone);
    if (/(auto|scroll)/.test(st.overflowY)) {
      const rz = zone.getBoundingClientRect();
      bas = Math.min(bas, rz.bottom);
      haut = Math.max(haut, rz.top);
      break;
    }
    zone = zone.parentElement;
  }
  const placeBas = bas - rb.bottom - marge;
  const placeHaut = rb.top - haut - marge;
  if (placeBas < hauteurVoulue && placeHaut > placeBas) {
    conteneur.classList.add('sd-haut');                 // les elements de menu glissent vers le haut
    panneau.style.maxHeight = Math.max(96, Math.min(hauteurVoulue, placeHaut)) + 'px';
  } else if (placeBas < hauteurVoulue) {
    panneau.style.maxHeight = Math.max(96, placeBas) + 'px';
  }
}

function sdBasculer(conteneur) {
  const etaitOuvert = conteneur.classList.contains('ouvert');
  sdFermerTout();
  if (etaitOuvert) return;
  sdMajLibelle(conteneur);
  sdConstruireOptions(conteneur);
  conteneur.classList.add('ouvert');
  sdPlacer(conteneur);                                  // <- place la liste (haut ou bas)
}

function initialiserListesDeroulantes() {
  const selects = document.querySelectorAll('select');
  Array.prototype.forEach.call(selects, function (select) {
    if (select.closest('.sd')) return;
    const conteneur = document.createElement('div');
    conteneur.className = 'sd' + (select.classList.contains('w-full') ? ' w-full' : '');
    select.parentNode.insertBefore(conteneur, select);
    conteneur.appendChild(select);

    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'sd-trigger';
    bouton.innerHTML = '<span></span><i class="fas fa-chevron-down sd-fleche"></i>';
    conteneur.appendChild(bouton);

    const panneau = document.createElement('div');
    panneau.className = 'sd-panel';
    conteneur.appendChild(panneau);

    bouton.addEventListener('click', function (ev) { ev.stopPropagation(); sdBasculer(conteneur); });
    sdMajLibelle(conteneur);
  });
  document.addEventListener('click', sdFermerTout);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') sdFermerTout(); });
  setInterval(sdRafraichirTout, 800);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialiserListesDeroulantes);
} else {
  initialiserListesDeroulantes();
}
// ========== CONNEXION A LA BASE DE L'ECOLE (Supabase) ==========
// Principe : les donnees de travail restent sur le telephone (l'application continue
// de fonctionner sans reseau). La BASE, elle, sert a trois choses :
//   1. savoir si le code d'une ecole est deja installe  (avant toute connexion) ;
//   2. installer une ecole NEUVE : l'etablissement + la fiche de son directeur ;
//   3. identifier la personne et relier un professeur a sa fiche.
// La cle utilisee est PUBLIQUE par nature : elle ne donne acces qu'a ce que les
// regles de la base autorisent (chaque role ne voit que ce qui le concerne).
//
// Toutes les portes cote base : etat_etablissement, premier_directeur,
// rattacher_mon_compte. Aucune autre n'est necessaire.

const AT_BASE = 'https://fgrkjrttcbuflykligfw.supabase.co';
const AT_CLE = 'sb_publishable_q2lOylqVGhUCuHw9kQ7JgQ_Ske0LC9b';
const AT_DOSSIER_SESSION = 'atSession';

let atSession = null;         // { access_token, refresh_token, expire_le, email, id }

// ---------- petites briques ----------
function atEntetes(jeton, avecContenu) {
  const t = { apikey: AT_CLE, Authorization: 'Bearer ' + (jeton || AT_CLE) };
  if (avecContenu) t['Content-Type'] = 'application/json';
  return t;
}

async function atReponse(rep) {
  const texte = await rep.text();
  let donnees = null;
  try { donnees = texte ? JSON.parse(texte) : null; } catch (e) { donnees = null; }
  if (!rep.ok) {
    const msg = (donnees && (donnees.msg || donnees.message || donnees.error_description ||
                             donnees.hint || donnees.details)) || ('Erreur ' + rep.status);
    const erreur = new Error(msg);
    erreur.statut = rep.status;
    throw erreur;
  }
  return donnees;
}

function atEnregistrerSession(session) {
  atSession = session;
  try { Depot.ecrire(AT_DOSSIER_SESSION, JSON.stringify(session)); } catch (e) {}
}

function atChargerSession() {
  if (atSession) return atSession;
  try {
    const brut = Depot.lire(AT_DOSSIER_SESSION, null);
    if (brut) atSession = JSON.parse(brut);
  } catch (e) { atSession = null; }
  return atSession;
}

function atOublierSession() {
  atSession = null;
  Depot.effacer(AT_DOSSIER_SESSION);      // Depôt : lire / ecrire / ecrireJSON / effacer
}

// ---------- 1. l'ecole est-elle deja installee ? ----------
async function atEtatCode(code) {
  const rep = await fetch(AT_BASE + '/rest/v1/rpc/etat_etablissement', {
    method: 'POST', headers: atEntetes(null, true), body: JSON.stringify({ p_code: code })
  });
  return await atReponse(rep);            // 'code_vide' | 'libre' | 'installe' | 'sans_directeur'
}

// ---------- 2. creer un compte (inscription) ----------
async function atCreerCompte(email, motDePasse) {
  const rep = await fetch(AT_BASE + '/auth/v1/signup', {
    method: 'POST', headers: atEntetes(null, true),
    body: JSON.stringify({ email: email, password: motDePasse })
  });
  const d = await atReponse(rep);
  if (!d || !d.access_token) {
    throw new Error("Le serveur attend une confirmation par courriel. Ce reglage doit etre " +
                    "desactive une fois pour toutes (Authentication > Sign In / Providers > Email).");
  }
  atEnregistrerSession({
    access_token: d.access_token, refresh_token: d.refresh_token,
    expire_le: Date.now() + ((d.expires_in || 3600) * 1000),
    email: (d.user && d.user.email) || email, id: (d.user && d.user.id) || null
  });
  return atSession;
}

// ---------- 3. se connecter ----------
async function atConnecter(email, motDePasse) {
  const rep = await fetch(AT_BASE + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: atEntetes(null, true),
    body: JSON.stringify({ email: email, password: motDePasse })
  });
  const d = await atReponse(rep);
  atEnregistrerSession({
    access_token: d.access_token, refresh_token: d.refresh_token,
    expire_le: Date.now() + ((d.expires_in || 3600) * 1000),
    email: (d.user && d.user.email) || email, id: (d.user && d.user.id) || null
  });
  return atSession;
}

async function atRenouveler() {
  const s = atChargerSession();
  if (!s || !s.refresh_token) return null;
  const rep = await fetch(AT_BASE + '/auth/v1/token?grant_type=refresh_token', {
    method: 'POST', headers: atEntetes(null, true), body: JSON.stringify({ refresh_token: s.refresh_token })
  });
  const d = await atReponse(rep);
  atEnregistrerSession({
    access_token: d.access_token, refresh_token: d.refresh_token || s.refresh_token,
    expire_le: Date.now() + ((d.expires_in || 3600) * 1000), email: s.email, id: s.id
  });
  return atSession;
}

// jeton valable : on renouvelle avant qu'il n'expire (marge de 60 s)
async function atJeton() {
  const s = atChargerSession();
  if (!s) return null;
  if (s.expire_le && Date.now() > (s.expire_le - 60000)) {
    try { await atRenouveler(); } catch (e) { atOublierSession(); return null; }
  }
  return (atSession && atSession.access_token) || null;
}

// ---------- 4. installer une ecole neuve (le directeur) ----------
async function atInstallerEcole(infos) {
  const jeton = await atJeton();
  if (!jeton) throw new Error('Connectez-vous d\'abord.');
  const rep = await fetch(AT_BASE + '/rest/v1/rpc/premier_directeur', {
    method: 'POST', headers: atEntetes(jeton, true),
    body: JSON.stringify({
      p_code_etab: infos.code, p_nom_etab: infos.nom, p_nom: infos.directeur,
      p_academie: infos.academie || '', p_direction: infos.direction || '',
      p_annee: infos.annee || '', p_semestres: infos.semestres || []
    })
  });
  return await atReponse(rep);            // l'identifiant de la fiche creee
}

// ---------- 5. un membre du personnel se relie a sa fiche ----------
async function atRelierMaFiche() {
  const jeton = await atJeton();
  if (!jeton) throw new Error('Connectez-vous d\'abord.');
  const rep = await fetch(AT_BASE + '/rest/v1/rpc/rattacher_mon_compte', {
    method: 'POST', headers: atEntetes(jeton, true), body: '{}'
  });
  return await atReponse(rep);            // l'identifiant de sa fiche
}

// ---------- 6. qui suis-je ? (ma fiche + mon ecole) ----------
async function atQuiSuisJe() {
  const jeton = await atJeton();
  if (!jeton) return null;
  const s = atChargerSession();
  const rep = await fetch(AT_BASE + '/rest/v1/profils?select=id,nom,role,matiere,email,etablissement_id' +
                          '&auth_user_id=eq.' + s.id, { headers: atEntetes(jeton) });
  const fiches = await atReponse(rep);
  if (!fiches || !fiches.length) return { fiche: null, etablissement: null, compte: s };
  const fiche = fiches[0];
  const rep2 = await fetch(AT_BASE + '/rest/v1/etablissements?select=id,code,nom,academie,direction,annee_libelle,semestres' +
                           '&id=eq.' + fiche.etablissement_id, { headers: atEntetes(jeton) });
  const etabs = await atReponse(rep2);
  return { fiche: fiche, etablissement: (etabs && etabs[0]) || null, compte: s };
}

function atSeDeconnecter() { atOublierSession(); }

if (typeof window !== 'undefined') {
  window.atEtatCode = atEtatCode;
  window.atCreerCompte = atCreerCompte;
  window.atConnecter = atConnecter;
  window.atJeton = atJeton;
  window.atInstallerEcole = atInstallerEcole;
  window.atRelierMaFiche = atRelierMaFiche;
  window.atQuiSuisJe = atQuiSuisJe;
  window.atSeDeconnecter = atSeDeconnecter;
}

// ========== 7. MODE « ECOLE » : L'APPLICATION RELIEE A LA BASE ==========
// Deux façons de poser l'application dans une école :
//   - « Nouvelle école » : le directeur remplit le formulaire, la base se prepare toute seule ;
//   - « Se relier a ma fiche » : un professeur ou un surveillant dont la fiche existe deja.
// Quand l'application est en mode ecole, elle ne fabrique AUCUNE donnee de demonstration :
// une ecole neuve commence vide (c'est le but).
function estModeEcole() {
  return Depot.lire('installationServeur', null) === '1';
}

function passerEnModeEcole() {
  Depot.ecrire('installationServeur', '1');
  appliquerModeEcole();
}

// En mode ecole, les comptes du telephone (et leur mot de passe de demonstration)
// ne s'affichent pas : la connexion passe par le serveur.
function appliquerModeEcole() {
  const bloc = document.getElementById('bloc-comptes-test');
  if (bloc) bloc.classList.toggle('hidden', estModeEcole());
}

function direErreurLogin(message) {
  const texte = document.getElementById('login-error-text');
  const bloc = document.getElementById('login-error');
  if (texte) texte.textContent = message;
  if (bloc) bloc.classList.remove('hidden');
}

function traduireErreurBase(e) {
  const m = String((e && e.message) || '');
  if (/invalid login credentials/i.test(m)) return 'Adresse ou mot de passe incorrect';
  if (/Aucune fiche ne correspond/i.test(m)) return m;
  if (/deja reli/i.test(m)) return m;
  if (/Plusieurs fiches/i.test(m)) return m;
  if (/confirmation par courriel/i.test(m)) return m;
  if (/Failed to fetch|NetworkError|network|fetch/i.test(m)) return 'Pas de connexion internet : reessayez dans un moment.';
  return m || 'Connexion impossible';
}

// Ouvre l'application sur la page du role, avec la fiche et l'ecole venues de la base.
function ouvrirSessionDeLaBase(moi) {
  const f = moi.fiche;
  const e = moi.etablissement || {};
  utilisateurConnecte = {
    email: moi.compte.email, role: f.role, code: f.code || '', matiere: f.matiere || '',
    nom: f.nom, serveur: true, fiche: f.id, etablissementId: f.etablissement_id
  };
  Depot.ecrireJSON('utilisateur', utilisateurConnecte);
  if (e && e.code) {
    etablissement = { code: e.code || '', nom: e.nom || '', academie: e.academie || '', direction: e.direction || '' };
    if (typeof sauvegarderParametres === 'function') sauvegarderParametres();
    if (typeof afficherParametres === 'function') { try { afficherParametres(); } catch (err) {} }
  }
  appliquerRoleTheme();
  if (typeof majBadgeEtat === 'function') majBadgeEtat();
  if (f.role === 'enseignant') {
    afficherEcran('enseignant'); remplirListeClasses(); choisirClasse(''); afficherInfosProf(); appliquerTableauService();
  } else if (f.role === 'surveillant') {
    afficherEcran('surveillant'); mettreAJourDashboardSurv(); afficherSeancesAnnulees();
  } else {
    afficherEcran('directeur'); mettreAJourDashboardDir(); afficherSeancesAnnulees();
  }
}

// Connexion par la base : le compte est verifie par le serveur ; si la personne a une fiche
// sans compte (preparee par son directeur), elle s'y relie toute seule.
async function connexionParLaBase(basculerEnModeEcole) {
  const email = (document.getElementById('login-email').value || '').trim().toLowerCase();
  const mdp = document.getElementById('login-password').value;
  const bloc = document.getElementById('login-error');
  if (bloc) bloc.classList.add('hidden');
  if (!email || !mdp) { direErreurLogin('Veuillez remplir tous les champs'); return false; }
  try {
    try {
      await atConnecter(email, mdp);
    } catch (e) {
      // PREMIERE CONNEXION d'un membre du personnel : le compte n'existe pas encore.
      // Le directeur lui a remis un mot de passe avec sa fiche -> l'application cree
      // le compte avec CE mot de passe, puis le relie a sa fiche.
      if (!/invalid|credential/i.test(String(e && e.message))) throw e;
      await atCreerCompte(email, mdp);
    }
    let moi = await atQuiSuisJe();
    if (moi && !moi.fiche) {
      await atRelierMaFiche();
      moi = await atQuiSuisJe();
    }
    if (!moi || !moi.fiche) {
      direErreurLogin("Votre compte n'a pas encore de fiche : demandez au directeur de l'ajouter.");
      atSeDeconnecter();
      return false;
    }
    // Une personne venue de la base : l'application passe en mode ecole
    // (les comptes du telephone ne s'affichent plus, la connexion passe par le serveur).
    if (basculerEnModeEcole) passerEnModeEcole();
    ouvrirSessionDeLaBase(moi);
    return true;
  } catch (e) {
    direErreurLogin(traduireErreurBase(e));
    return false;
  }
}

// ---------- 8. INSTALLER UNE NOUVELLE ECOLE (le directeur) ----------
function changerAcademieEcole() {
  const sel = document.getElementById('ecole-academie');
  const dir = document.getElementById('ecole-direction');
  if (!sel || !dir) return;
  const liste = (typeof directionsAcademie === 'function') ? directionsAcademie(sel.value) : [];
  dir.innerHTML = '';
  liste.forEach(d => { const o = document.createElement('option'); o.value = d; o.textContent = d; dir.appendChild(o); });
}

function basculerPanneauEcole() {
  const p = document.getElementById('panneau-ecole');
  if (!p) return;
  const ouvert = !p.classList.contains('hidden');
  p.classList.toggle('hidden', ouvert);
  if (!ouvert) {
    const sel = document.getElementById('ecole-academie');
    if (sel && !sel.options.length && typeof ACADEMIES !== 'undefined') {
      ACADEMIES.forEach(a => { const o = document.createElement('option'); o.value = a.nom; o.textContent = a.nom; sel.appendChild(o); });
      changerAcademieEcole();
    }
    const annee = document.getElementById('ecole-annee');
    if (annee && !annee.value) annee.value = (typeof anneeScolaire !== 'undefined' && anneeScolaire.libelle) || '2026-2027';
  }
}

function valeurChamp(id) { const el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; }

async function installerEcoleDepuisFormulaire() {
  const infos = {
    code: valeurChamp('ecole-code'), nom: valeurChamp('ecole-nom'),
    academie: valeurChamp('ecole-academie'), direction: valeurChamp('ecole-direction'),
    annee: valeurChamp('ecole-annee') || '2026-2027',
    directeur: valeurChamp('ecole-directeur'), email: valeurChamp('ecole-email'),
    mdp: valeurChamp('ecole-mdp')
  };
  if (!infos.code || !infos.nom) { afficherToast("Indiquez le code et le nom de l'etablissement", 'error'); return; }
  if (!infos.directeur || !infos.email || !infos.mdp) { afficherToast('Renseignez le compte du directeur', 'error'); return; }
  if (infos.mdp.length < 6) { afficherToast('Le mot de passe doit faire au moins 6 caracteres', 'error'); return; }
  try {
    const etat = await atEtatCode(infos.code);
    if (etat === 'installe') {
      afficherToast('Cette ecole est deja installee : connectez-vous avec votre compte', 'warning');
      return;
    }
    if (etat === 'sans_directeur') {
      afficherToast('Une installation a ete commencee pour ce code : contactez le support', 'warning');
      return;
    }
    await atCreerCompte(infos.email, infos.mdp);
    await atInstallerEcole({
      code: infos.code, nom: infos.nom, directeur: infos.directeur,
      academie: infos.academie, direction: infos.direction, annee: infos.annee,
      semestres: (typeof anneeScolaire !== 'undefined' && anneeScolaire.semestres) || []
    });
    passerEnModeEcole();
    etablissement = { code: infos.code, nom: infos.nom, academie: infos.academie, direction: infos.direction };
    if (typeof sauvegarderParametres === 'function') sauvegarderParametres();
    const moi = await atQuiSuisJe();
    if (moi && moi.fiche) { ouvrirSessionDeLaBase(moi); afficherToast('Ecole installee — bienvenue !', 'success'); }
    else { direErreurLogin("L'ecole est creee, mais la fiche du directeur n'a pas ete lue. Connectez-vous."); }
  } catch (e) {
    afficherToast(traduireErreurBase(e), 'error');
  }
}

// ---------- 9. LE PERSONNEL DE LA BASE + LES MOTS DE PASSE DE L'APPLICATION ----------
// Le serveur ne peut PAS rendre un mot de passe (il les garde chiffres a sens unique).
// C'est donc l'APPLICATION qui fabrique les mots de passe et qui les garde ; elle les
// envoie le jour ou la personne cree son compte (sa premiere connexion).
async function atFichesPersonnel() {
  const jeton = await atJeton();
  if (!jeton) throw new Error('Connexion requise.');
  const rep = await fetch(AT_BASE + '/rest/v1/profils' +
    '?select=id,nom,role,matiere,email,code,auth_user_id,actif' +
    '&role=in.(enseignant,surveillant)&order=role,matiere,nom', { headers: atEntetes(jeton) });
  return (await atReponse(rep)) || [];
}

function motsDePasseEcole() {
  try { return JSON.parse(Depot.lire('identifiantsEcole', '{}')) || {}; } catch (e) { return {}; }
}

function retenirMotDePasseEcole(email, mdp) {
  const t = motsDePasseEcole();
  t[String(email).toLowerCase()] = mdp;
  Depot.ecrireJSON('identifiantsEcole', t);
}

// Le mot de passe d'une fiche : celui que l'application connait, sinon un mot de passe
// NEUF (la personne le creera en se connectant pour la premiere fois), sinon la mention
// « deja remis » pour un compte cree ailleurs (l'application ne peut pas le relire).
function motDePassePourFiche(fiche) {
  const email = String((fiche && fiche.email) || '').trim().toLowerCase();
  if (!email) return '';
  const connus = motsDePasseEcole();
  if (connus[email]) return connus[email];
  if (!fiche.auth_user_id && typeof genererMotDePasse === 'function') {
    const mdp = genererMotDePasse(8);
    retenirMotDePasseEcole(email, mdp);
    return mdp;
  }
  return 'deja remis';
}

// ---------- 10. « SUR QUOI JE TRAVAILLE ? » — LE TEMOIN VISIBLE ----------
// Un petit temoin dans la barre de titre, sur TOUTES les pages :
//   « serveur »  (vert)  : les comptes et l'ecole viennent de la base ;
//   « telephone » (gris) : application non reliee, tout est sur le telephone ;
//   « hors ligne » (ambre) : reliee, mais la base ne repond pas pour l'instant.
function etatTravail() {
  if (!estModeEcole()) return 'telephone';
  return (atChargerSession() && atChargerSession().access_token) ? 'serveur' : 'hors-ligne';
}

function libelleEtatTravail(etat) {
  if (etat === 'serveur') return 'serveur';
  if (etat === 'hors-ligne') return 'hors ligne';
  return 'telephone';
}

function majBadgeEtat() {
  const etat = etatTravail();
  const libelle = libelleEtatTravail(etat);
  document.querySelectorAll('.badge-etat').forEach(function (b) {
    b.className = 'badge-etat badge-' + etat;
    b.innerHTML = '<i class="fas ' + (etat === 'serveur' ? 'fa-cloud' : (etat === 'hors-ligne' ? 'fa-cloud-slash' : 'fa-mobile-alt')) + '"></i> ' + libelle;
    b.title = etat === 'serveur' ? 'Comptes et ecole lus sur le serveur' :
              (etat === 'hors-ligne' ? 'Serveur injoignable : on travaille sur le telephone' :
               'Application non reliee : tout est sur le telephone');
    b.onclick = function () { verifierEtatTravail(); };
  });
}

function poserBadgeEtat() {
  document.querySelectorAll('.appbar').forEach(function (barre) {
    if (barre.querySelector('.badge-etat')) return;
    const b = document.createElement('span');
    b.className = 'badge-etat';
    barre.appendChild(b);
  });
  majBadgeEtat();
}

// Au clic : on redemande au serveur qui je suis, et on dit clairement ce qui a ete vu.
async function verifierEtatTravail() {
  if (!estModeEcole()) {
    afficherToast('Application NON reliee : tout est sur le telephone', 'info');
    return;
  }
  try {
    const moi = await atQuiSuisJe();
    if (moi && moi.fiche) {
      majBadgeEtat();
      afficherToast('Serveur : ' + (moi.etablissement ? moi.etablissement.nom : 'ecole') +
                    ' · ' + moi.fiche.role + ' · ' + moi.fiche.nom, 'success');
    } else {
      afficherToast('Serveur joint, mais aucune fiche pour ce compte', 'warning');
    }
  } catch (e) {
    majBadgeEtat();
    afficherToast('Serveur injoignable : on continue sur le telephone', 'warning');
  }
}

// ---------- 11. au demarrage : une session ouverte se rouvre toute seule ----------
async function rouvrirSessionSiBesoin() {
  if (!estModeEcole()) return false;
  const jeton = await atJeton();
  if (!jeton) return false;
  try {
    const moi = await atQuiSuisJe();
    if (moi && moi.fiche) { ouvrirSessionDeLaBase(moi); return true; }
  } catch (e) { /* hors ligne : on garde ce qui est deja dans le telephone */ }
  return false;
}

// ---------- 12. CHANGER SON MOT DE PASSE (ecole reliee) ----------
async function changerMotDePasseServeur(prefixe) {
  const p = prefixe || 'profil';
  const champs = (typeof motDePasseSaisi === 'function' ? motDePasseSaisi(p) : {}) || {};
  const errDiv = document.getElementById(p + '-error');
  const sucDiv = document.getElementById(p + '-success');
  const dire = function (m) {
    if (errDiv) { errDiv.textContent = m; errDiv.classList.remove('hidden'); }
    if (sucDiv) sucDiv.classList.add('hidden');
  };
  if (errDiv) errDiv.classList.add('hidden');
  if (sucDiv) sucDiv.classList.add('hidden');
  if (!champs.ancien || !champs.nouveau || !champs.confirmer) return dire('Veuillez remplir tous les champs');
  if (champs.nouveau !== champs.confirmer) return dire('Les deux mots de passe ne correspondent pas');
  if (champs.nouveau === champs.ancien) return dire("Le nouveau mot de passe doit differer de l'ancien");
  if (typeof validerMotDePasse === 'function') {
    const e = validerMotDePasse(champs.nouveau);
    if (e) return dire(e);
  }
  const email = utilisateurConnecte && utilisateurConnecte.email;
  if (!email) return dire('Connectez-vous d\'abord.');
  try {
    await atConnecter(email, champs.ancien);          // l'ancien est verifie par le SERVEUR
    const jeton = await atJeton();
    const rep = await fetch(AT_BASE + '/auth/v1/user', {
      method: 'PUT', headers: atEntetes(jeton, true), body: JSON.stringify({ password: champs.nouveau })
    });
    await atReponse(rep);
    if (sucDiv) { sucDiv.textContent = 'Mot de passe change.'; sucDiv.classList.remove('hidden'); }
    if (typeof afficherToast === 'function') afficherToast('Mot de passe change', 'success');
  } catch (e) {
    const m = String((e && e.message) || '');
    if (/invalid|credential/i.test(m)) return dire("L'ancien mot de passe est incorrect");
    return dire('Changement impossible : ' + m);
  }
}

// ---------- 13. REPARTIR DU SERVEUR (effacer le telephone) ----------
// Efface TOUT ce qui est sur le telephone (listes, eleves, absences, comptes locaux) et
// ne garde que le lien avec l'ecole + la memoire des mots de passe remis au personnel.
function repartirDuServeur() {
  demanderConfirmation(
    "Tout effacer sur ce telephone et repartir du serveur ?\n\n" +
    "Vos listes, vos eleves et vos absences locales seront supprimes, et la connexion " +
    "passera uniquement par le serveur (votre ecole et vos comptes y sont deja).",
    function () {
      try {
        const garder = {
          installationServeur: Depot.lire('installationServeur', null),
          identifiantsEcole: Depot.lire('identifiantsEcole', null),
          prefTheme: Depot.lire('prefTheme', null)
        };
        Depot.effacerTout();          // on passe par la porte unique (Depot)
        if (garder.installationServeur) Depot.ecrire('installationServeur', garder.installationServeur);
        if (garder.identifiantsEcole) Depot.ecrire('identifiantsEcole', garder.identifiantsEcole);
        if (garder.prefTheme) Depot.ecrire('prefTheme', garder.prefTheme);
      } catch (e) {}
      atSeDeconnecter();
      location.reload();
    });
}

// DERNIER module charge : c'est ICI que l'application demarre. Lancer init() plus tot
// (dans 16-init.js) tombait avant que les fonctions du serveur existent : le temoin et
// la reouverture de session echouaient en mode ecole (defaut trouve par le banc v4.03).
if (typeof window !== 'undefined') {
  const demarrer = function () { try { poserBadgeEtat(); } catch (e) {} init(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
}

if (typeof window !== 'undefined') {
  window.estModeEcole = estModeEcole;
  window.connexionParLaBase = connexionParLaBase;
  window.installerEcoleDepuisFormulaire = installerEcoleDepuisFormulaire;
  window.basculerPanneauEcole = basculerPanneauEcole;
  window.changerAcademieEcole = changerAcademieEcole;
  window.changerMotDePasseServeur = changerMotDePasseServeur;
  window.repartirDuServeur = repartirDuServeur;
  window.rouvrirSessionSiBesoin = rouvrirSessionSiBesoin;
}
