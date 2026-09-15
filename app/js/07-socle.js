// fichier: app/js/07-socle.js
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

