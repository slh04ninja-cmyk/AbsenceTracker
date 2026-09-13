// fichier: app/js/02-tableaux-service.js
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
    const sauve = JSON.parse(localStorage.getItem('tableauxService_v2') || 'null');
    if (sauve && typeof sauve === 'object' && !Array.isArray(sauve)) return sauve;
  } catch (e) {}
  return JSON.parse(JSON.stringify(TABLEAUX_SERVICE_DEFAUT));
}
function sauvegarderTableauxService() {
  localStorage.setItem('tableauxService_v2', JSON.stringify(tableauxService));
}

const NOMS_JOURS = { 1: 'lundi', 2: 'mardi', 3: 'mercredi', 4: 'jeudi', 5: 'vendredi', 6: 'samedi', 7: 'dimanche' };
let tableauxService = chargerTableauxService();
const CLASSES_TABLEAUX_SERVICE = ['TCSF-1', 'TCSF-2', 'TCSF-3'];
const NB_ELEVES_CLASSE_SERVICE = 12;

// Ajout des classes des tableaux de service : jamais destructif, on saute celles qui existent
function ajouterClassesTableauxService() {
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

