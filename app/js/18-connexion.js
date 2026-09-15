// fichier: app/js/18-connexion.js
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
  // Quelle ecole est ouverte ? La reponse vient du SERVEUR (jamais du telephone, qui peut
  // garder les parametres d'une autre ecole). C'est la reference du cloisonnement.
  Depot.ecrire('ecoleOuverteId', String(f.etablissement_id || ''));
  Depot.ecrire('ecoleOuverteCode', (e && e.code) ? String(e.code) : '');
  if (typeof appliquerEcoleAuxListes === 'function') appliquerEcoleAuxListes();
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
    // Les donnees de travail (classes, eleves, absences, emplois du temps) appartiennent
    // a UNE ecole : installer une nouvelle ecole, c'est repartir de zero sur ce telephone.
    if (window.confirm("Installer « " + infos.nom + " » ?\n\n" +
        "Les donnees de travail de ce telephone (classes, eleves, absences, emplois du temps) " +
        "seront effacees : elles appartiennent a une autre ecole.\n\n" +
        "Vos donnees sur le serveur ne sont pas touchees.") !== true) return;
    ['classes', 'absences', 'tableauxService_v2', 'seancesAnnulees', 'fermeturesEtab',
     'indispoProfs', 'nomsProfs', 'motsDePasse', 'surveillantsRH', 'absenceTrackVersion',
     'etiquetteEcole', 'etabDonnees', 'espaceServeur', 'idsEcole', 'ecoleOuverteId', 'ecoleOuverteCode',
     'testHistoGenere_v1', 'testHistoGenere_v2', 'testHistoGenere_v3', 'testHistoGenere_v4',
     'testHistoGenere_v5', 'testHistoGenere_v6', 'etabDonnees', 'etiquetteEcole',
     'espaceServeur', 'idsEcole', 'ecoleOuverteId', 'ecoleOuverteCode',
     'etiquetteEcole'].forEach(function (cle) { Depot.effacer(cle); });

    await atCreerCompte(infos.email, infos.mdp);
    await atInstallerEcole({
      code: infos.code, nom: infos.nom, directeur: infos.directeur,
      academie: infos.academie, direction: infos.direction, annee: infos.annee,
      semestres: (typeof anneeScolaire !== 'undefined' && anneeScolaire.semestres) || []
    });
    passerEnModeEcole();
    Depot.ecrire('etabDonnees', infos.code);      // a quelle ecole appartiennent les donnees du telephone
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

// ---------- 12 bis. RESTAURER UNE SAUVEGARDE DU TELEPHONE ----------
// L'application n'efface jamais rien sans le dire : ici on REMET tout ce qu'une
// sauvegarde contient (classes, eleves, absences, tableaux de service...).
async function restaurerSauvegarde(input) {
  const fichier = (input && input.files && input.files[0]) || null;
  if (!fichier) return;
  try {
    const texte = await fichier.text();
    const donnees = JSON.parse(texte);
    const contenu = donnees && donnees.contenu ? donnees.contenu : donnees;
    if (!contenu || typeof contenu !== 'object') throw new Error('format inattendu');
    let n = 0;
    Object.keys(contenu).forEach(function (cle) {
      const valeur = contenu[cle];
      Depot.ecrire(cle, typeof valeur === 'string' ? valeur : JSON.stringify(valeur));
      n++;
    });
    afficherToast(n + ' element(s) restaure(s) — l application va se recharger', 'success');
    setTimeout(function () { location.reload(); }, 1400);
  } catch (e) {
    afficherToast('Fichier illisible : ' + (e && e.message ? e.message : e), 'error');
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
  window.restaurerSauvegarde = restaurerSauvegarde;
  window.ouvrirRenommageFicheBase = ouvrirRenommageFicheBase;
  window.rouvrirSessionSiBesoin = rouvrirSessionSiBesoin;
}
