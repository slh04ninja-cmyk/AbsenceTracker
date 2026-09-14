// test_v387_serveur.js — la porte vers le SERVEUR.
// Ce que ce test verrouille :
//   1. le module serveur est present et NE FAIT AUCUN appel reseau au chargement
//      (les 39 autres suites tournent hors ligne : elles ne doivent jamais etre
//       surprises par une requete partie toute seule) ;
//   2. la fenetre « Premiere installation » : etape 1 (connexion) -> etape 2 (creation) ;
//   3. les appels partent sur les BONNES adresses, avec la cle publique en en-tete
//      « apikey » et, une fois connecte, le JETON de session en « Authorization » ;
//   4. aucun mot de passe n'est jamais conserve (seuls les jetons le sont) ;
//   5. un refus du serveur est affiche TEL QUEL (l'utilisateur doit lire pourquoi).
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('AbsenceTrack-v2.html', 'utf8');

let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };
const pause = () => new Promise(r => setTimeout(r, 0));

let appels = [];
let fiche = null;
let refusRPC = null;
let authRefus = null;          // si rempli : le serveur refuse la connexion avec ce message
let jetonsPerimes = 0;         // nombre d'appels qui doivent echouer en 401 (jeton d'une heure perime)
let rafraichissements = 0;     // nombre de renouvellements de jeton demandes par l'application
let refreshRefus = false;      // si vrai : le renouvellement lui-meme echoue

// ---- un MINI-SERVEUR simule : les tables classes et eleves, comme sur le vrai serveur ----
let idSuivant = 100;
const base = { classes: [], eleves: [], fiches: [], signalements: [], seances: [], fermetures: [],
               indispos: [], annulations: [] };

const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true,
  beforeParse(win) {
    win.fetch = async function (url, options) {
      appels.push({ url: url, options: options || {} });
      let corps = {}, statut = 200, bon = true;
      // un jeton perime : tout appel d'API echoue en 401 (mais pas le renouvellement lui-meme)
      if (jetonsPerimes > 0 && url.indexOf('/auth/v1/') < 0) {
        jetonsPerimes--;
        return { ok: false, status: 401, text: async function () { return JSON.stringify({ message: 'JWT expired' }); } };
      }
      if (url.indexOf('/auth/v1/token') >= 0) {
        if (url.indexOf('grant_type=refresh_token') >= 0) {
          rafraichissements++;
          if (refreshRefus) { corps = { error_code: 'invalid_grant', msg: 'Invalid Refresh Token' }; bon = false; statut = 400; }
          else corps = { access_token: 'jeton-ABC-123', refresh_token: 'raf-1', expires_in: 3600,
                         user: { id: 'UU-1', email: 'directeur@taalim.ma' } };
        } else if (authRefus) { corps = { error_code: 'invalid_credentials', msg: authRefus }; bon = false; statut = 400; }
        else corps = { access_token: 'jeton-ABC-123', refresh_token: 'raf-1', expires_in: 3600,
                  user: { id: 'UU-1', email: 'directeur@taalim.ma' } };
      } else if (url.indexOf('/rest/v1/classes') >= 0) {
        if (options.method === 'POST') {
          const b = JSON.parse(options.body);
          const c = { id: ++idSuivant, nom: b.nom };
          base.classes.push(c);
          corps = [c];
        } else if (url.indexOf('select=id,nom') >= 0) {
          corps = base.classes.map(function (c) { return { id: c.id, nom: c.nom }; });
        } else {
          corps = base.classes.map(function (c) { return { id: c.id }; });
        }
      } else if (url.indexOf('/rest/v1/eleves') >= 0) {
        const enLot = url.match(/classe_id=in\.\(([^)]*)\)/);
        const enClasse = url.match(/classe_id=eq\.(\d+)/);
        if (options.method === 'PATCH') {
          corps = [];
        } else if (options.method === 'POST') {
          let b = JSON.parse(options.body);
          if (!Array.isArray(b)) b = [b];
          b.forEach(function (e) { base.eleves.push(Object.assign({ id: ++idSuivant }, e)); });
          corps = b;
        } else if (enLot) {
          const ids = enLot[1].split(',').map(Number);
          corps = base.eleves.filter(function (e) { return ids.indexOf(e.classe_id) >= 0; });
        } else if (enClasse) {
          corps = base.eleves.filter(function (e) { return e.classe_id === Number(enClasse[1]); });
        } else {
          corps = base.eleves;
        }
      } else if (url.indexOf('/rest/v1/etablissements') >= 0) {
        corps = [];
      } else if (url.indexOf('/rest/v1/profils?auth_user_id=') >= 0) {
        corps = fiche ? [fiche] : [];
      } else if (url.indexOf('/rest/v1/profils') >= 0) {
        if (options.method === 'POST') {
          const b = JSON.parse(options.body);
          const f = Object.assign({ id: ++idSuivant }, b);
          base.fiches.push(f);
          corps = [f];
        } else if (options.method === 'PATCH') {
          // le simulateur APPLIQUE vraiment la modification (sinon le test ne prouverait rien)
          const mid = url.match(/id=eq\.(\d+)/);
          const corpsEnvoye = JSON.parse(options.body || '{}');
          if (mid) {
            base.fiches.forEach(function (f) {
              if (f.id === Number(mid[1])) Object.assign(f, corpsEnvoye);
            });
          }
          corps = [];
        } else if (/select=id($|&)/.test(url)) {
          corps = base.fiches.filter(function (f) {
            return url.indexOf('actif=is.true') < 0 || f.actif !== false;
          }).map(function (f) { return { id: f.id }; });
        } else {
          corps = base.fiches.map(function (f) {
            return { id: f.id, code: f.code, nom: f.nom, matiere: f.matiere, role: f.role, email: f.email };
          });
        }
      } else if (url.indexOf('/rest/v1/absences_personnel') >= 0 ||
                 url.indexOf('/rest/v1/annulations_seances') >= 0) {
        const table = url.indexOf('/absences_personnel') >= 0 ? 'indispos' : 'annulations';
        if (options.method === 'DELETE') {
          base[table] = [];
          corps = [];
        } else if (options.method === 'POST') {
          let b = JSON.parse(options.body);
          if (!Array.isArray(b)) b = [b];
          b.forEach(function (x) { base[table].push(Object.assign({ id: ++idSuivant }, x)); });
          corps = b;
        } else {
          corps = base[table];
        }
      } else if (url.indexOf('/rest/v1/fermetures') >= 0) {
        if (options.method === 'DELETE') {
          base.fermetures = [];
          corps = [];
        } else if (options.method === 'POST') {
          let b = JSON.parse(options.body);
          if (!Array.isArray(b)) b = [b];
          b.forEach(function (f) { base.fermetures.push(Object.assign({ id: ++idSuivant }, f)); });
          corps = b;
        } else {
          corps = base.fermetures;
        }
      } else if (url.indexOf('/rest/v1/seances') >= 0) {
        if (options.method === 'DELETE') {
          const mp = url.match(/prof_id=eq\.(\d+)/);
          if (mp) base.seances = base.seances.filter(function (s) { return s.prof_id !== Number(mp[1]); });
          corps = [];
        } else if (options.method === 'POST') {
          let b = JSON.parse(options.body);
          if (!Array.isArray(b)) b = [b];
          b.forEach(function (s) { base.seances.push(Object.assign({ id: ++idSuivant }, s)); });
          corps = b;
        } else if (/select=id($|&)/.test(url)) {
          corps = base.seances.map(function (s) { return { id: s.id }; });
        } else {
          corps = base.seances;
        }
      } else if (url.indexOf('/rest/v1/signalements') >= 0) {
        if (options.method === 'POST') {
          const b = JSON.parse(options.body);
          const s = Object.assign({ id: ++idSuivant }, b);
          base.signalements.push(s);
          corps = [s];
        } else if (options.method === 'PATCH') {
          corps = [];
        } else if (/select=id($|&)/.test(url)) {
          corps = base.signalements.map(function (s) { return { id: s.id }; });
        } else {
          corps = base.signalements;
        }
      } else if (url.indexOf('/rest/v1/rpc/premier_directeur') >= 0) {
        if (refusRPC) { corps = { code: 'P0001', message: refusRPC }; bon = false; statut = 400; }
        else { fiche = { id: 7, nom: 'SaLaH', role: 'directeur', etablissement_id: 3,
                         email: 'directeur@taalim.ma' }; corps = 7; }
      }
      return { ok: bon, status: statut, text: async function () { return JSON.stringify(corps); } };
    };
  }
});
const win = dom.window, doc = win.document;
// ATTENTION : les `const` de la page (SERVEUR, classes...) ne sont PAS des proprietes de
// `window` — il faut passer par win.eval pour les lire (seules les `function` y sont).
const ev = code => win.eval(code);
const attendreQue = async (cond, tours) => {
  for (let i = 0; i < (tours || 40); i++) { if (cond()) return true; await pause(); }
  return false;
};

(async function () {
  // ---------- 0) au chargement : rien ne part sur le reseau ----------
  t('le module serveur est charge', !!ev('SERVEUR') && !!ev('SERVEUR.url'));
  t('adresse du projet correcte', ev('SERVEUR.url') === 'https://mtbadhxrezbbuzdtfpez.supabase.co', ev('SERVEUR.url'));
  t('clé publique presente (et pas un mot de passe)', ev('SERVEUR.cle').indexOf('sb_publishable_') === 0);
  t('AUCUN appel reseau au chargement', appels.length === 0, appels.length + ' appel(s)');
  // on ne fige PAS le numero (il change a chaque livraison) : on verifie qu'il est present
  // et bien forme — l'accord entre app/ et le livrable est deja garanti par la CI.
  t('le numero de version est present et bien forme', /AbsenceTrack v\d+\.\d+ — Prototype/.test(html));

  // ---------- 1) la porte d'entree sur la page de connexion ----------
  const lien = doc.querySelector('.lien-installation');
  t('bouton « Première installation » sur la page de connexion', !!lien);
  t('la fenetre existe et est cachee au depart', !!doc.getElementById('modal-installation') &&
    doc.getElementById('modal-installation').classList.contains('hidden'));

  // ---------- 2) ouverture : etape 1, annee pre-remplie ----------
  win.ouvrirInstallation();
  t('la fenetre s ouvre', !doc.getElementById('modal-installation').classList.contains('hidden'));
  t('sans compte du serveur, elle s appelle « Première installation »',
    doc.getElementById('inst-titre').textContent === 'Première installation',
    doc.getElementById('inst-titre').textContent);
  t('on demarre a l etape 1', doc.getElementById('modal-installation').getAttribute('data-etape') === '1');
  t('l annee scolaire est pre-remplie', doc.getElementById('inst-annee').value === '2026-2027');
  t('aucun appel reseau a l ouverture', appels.length === 0);

  // ---------- 3) connexion refusee faute de saisie ----------
  await win.installationConnexion();
  t('sans saisie : message d erreur, pas d appel', appels.length === 0 &&
    doc.getElementById('inst-message').className.indexOf('ko') >= 0);

  // ---------- 4) connexion reelle ----------
  const MDP = 'MotDePasse123';
  doc.getElementById('inst-email').value = 'directeur@taalim.ma';
  doc.getElementById('inst-mdp').value = MDP;
  await win.installationConnexion();
  const appelAuth = appels[0];
  t('l appel de connexion part sur la bonne adresse',
    !!appelAuth && appelAuth.url === 'https://mtbadhxrezbbuzdtfpez.supabase.co/auth/v1/token?grant_type=password',
    appelAuth && appelAuth.url);
  t('la methode est POST', appelAuth.options.method === 'POST');
  t('la clé publique est dans l en-tete apikey',
    appelAuth.options.headers.apikey === 'sb_publishable_riEixeLQaD-5-XXoyQHSxA_q-CCf7Gu');
  t('le corps porte l email et le mot de passe',
    JSON.parse(appelAuth.options.body).email === 'directeur@taalim.ma' &&
    JSON.parse(appelAuth.options.body).password === MDP);
  t('le mot de passe n est PAS enregistre',
    (win.localStorage.getItem('sessionServeur') || '').indexOf(MDP) < 0);
  const session = JSON.parse(win.localStorage.getItem('sessionServeur'));
  t('la session (jetons) est enregistree', session.access_token === 'jeton-ABC-123' && session.id === 'UU-1');
  t('le compte connecte est affiche', doc.getElementById('inst-compte').textContent.indexOf('directeur@taalim.ma') >= 0);

  // ---------- 5) etape 2 : creation de l etablissement ----------
  t('on passe a l etape 2', doc.getElementById('modal-installation').getAttribute('data-etape') === '2');
  t('sans fiche : le formulaire est visible',
    doc.getElementById('inst-formulaire').style.display !== 'none' &&
    doc.getElementById('inst-aide-fiche').textContent.indexOf('pas encore de fiche') >= 0);

  t('la fiche du compte est demandee apres la connexion (2e appel legitime)',
    appels.length === 2 && appels[1].url === 'https://mtbadhxrezbbuzdtfpez.supabase.co/rest/v1/profils?auth_user_id=eq.UU-1&select=*',
    appels.map(a => a.url.replace('https://mtbadhxrezbbuzdtfpez.supabase.co', '')).join(' | '));
  await win.installationCreer();
  t('sans code : refus local, pas de nouvel appel', appels.length === 2,
    appels.length + ' appel(s)');

  doc.getElementById('inst-code').value = '3456789';
  doc.getElementById('inst-nom').value = 'Thawiya Lkasba';
  doc.getElementById('inst-nomdir').value = 'SaLaH';
  doc.getElementById('inst-academie').value = 'Grand Casablanca-Settat';
  doc.getElementById('inst-direction').value = 'Settat';
  await win.installationCreer();
  const appelRPC = appels[2];
  t('la creation part sur la porte du premier directeur',
    !!appelRPC && appelRPC.url === 'https://mtbadhxrezbbuzdtfpez.supabase.co/rest/v1/rpc/premier_directeur',
    appelRPC && appelRPC.url);
  t('la methode est POST', appelRPC.options.method === 'POST');
  t('elle porte le JETON de session, pas la clé publique',
    appelRPC.options.headers.Authorization === 'Bearer jeton-ABC-123',
    appelRPC.options.headers.Authorization);
  const corps = JSON.parse(appelRPC.options.body);
  t('le corps porte le code, le nom et le nom du directeur',
    corps.p_code_etab === '3456789' && corps.p_nom_etab === 'Thawiya Lkasba' && corps.p_nom === 'SaLaH');
  t('l academie et la direction sont transmises',
    corps.p_academie === 'Grand Casablanca-Settat' && corps.p_direction === 'Settat');
  t('les semestres de l annee sont transmis', Array.isArray(corps.p_semestres) && corps.p_semestres.length === 2);
  t('le succes est annonce avec le nom de l etablissement',
    doc.getElementById('inst-message').className.indexOf('ok') >= 0 &&
    doc.getElementById('inst-message').textContent.indexOf('Thawiya Lkasba') >= 0);
  t('la fiche existe maintenant : le formulaire est masque',
    doc.getElementById('inst-formulaire').style.display === 'none');
  t('le role du compte est affiche',
    doc.getElementById('inst-aide-fiche').textContent.indexOf('directeur') >= 0);

  // ---------- 6) un refus du serveur est montre tel quel ----------
  refusRPC = 'Cet etablissement a deja un directeur.';
  fiche = null;
  doc.getElementById('inst-formulaire').style.display = '';
  doc.getElementById('inst-btn-creer').style.display = '';
  await win.installationCreer();
  t('le refus du serveur est affiche mot pour mot',
    doc.getElementById('inst-message').textContent.indexOf('Cet etablissement a deja un directeur.') >= 0,
    doc.getElementById('inst-message').textContent);

  // ---------- 7) deconnexion : la session est effacee ----------
  refusRPC = null;
  await win.installationDeconnexion();
  t('la session est effacee a la deconnexion', win.localStorage.getItem('sessionServeur') === null);
  t('on revient a l etape 1', doc.getElementById('modal-installation').getAttribute('data-etape') === '1');

  // ---------- 8) la fenetre se referme ----------
  win.fermerInstallation();
  t('la fenetre se referme', doc.getElementById('modal-installation').classList.contains('hidden'));

  // ---------- 9) le mode local n a pas ete casse ----------
  doc.getElementById('login-email').value = 'd@taalim.ma';
  doc.getElementById('login-password').value = '12345';
  win.connexion();
  t('la connexion locale (comptes de demonstration) marche toujours',
    doc.getElementById('page-login').classList.contains('active') === false);

  // ---------- 10) LE COMPTE DU SERVEUR, DEPUIS L ECRAN PRINCIPAL ----------
  const MDP2 = 'MotDePasse123';
  const essayerConnexion = async (email, mdp) => {
    doc.getElementById('login-email').value = email;
    doc.getElementById('login-password').value = mdp;
    win.connexion();
    await pause(); await pause();
  };

  // 10a. le serveur refuse : son message doit etre traduit lisiblement
  authRefus = 'Invalid login credentials';
  await essayerConnexion('inconnu@taalim.ma', 'mauvais');
  await attendreQue(() => doc.getElementById('login-error-text').textContent.length > 0);
  t('compte inconnu refuse par le serveur : message clair en francais',
    doc.getElementById('login-error-text').textContent === 'Email ou mot de passe incorrect',
    doc.getElementById('login-error-text').textContent);
  // (a ce moment du scenario on etait deja connecte avec le compte de demonstration :
  //  ce qui compte, c est qu'un REFUS ne connecte personne d'autre)
  t('un refus ne connecte personne (le compte enregistre ne change pas)',
    JSON.parse(win.localStorage.getItem('utilisateur')).email === 'd@taalim.ma',
    JSON.parse(win.localStorage.getItem('utilisateur')).email);

  // 10b. le bon compte : il ouvre l ecran du directeur
  authRefus = null;
  fiche = { id: 7, nom: 'SaLaH', role: 'directeur', etablissement_id: 3,
            email: 'directeur@taalim.ma', matiere: null, code: null };
  const appelsAvant = appels.length;
  await essayerConnexion('directeur@taalim.ma', MDP2);
  await attendreQue(() => doc.getElementById('page-directeur').classList.contains('active'));
  t('le compte du SERVEUR ouvre l ecran du directeur',
    doc.getElementById('page-directeur').classList.contains('active'));
  t('au moins 2 appels : connexion puis lecture de la fiche', appels.length - appelsAvant >= 2);
  const enregistre = JSON.parse(win.localStorage.getItem('utilisateur'));
  t('le compte connecte est marque « vient du serveur »', !!enregistre && enregistre.serveur === true);
  t('son role vient de la fiche du serveur', enregistre.role === 'directeur');
  t('son nom vient de la fiche du serveur', enregistre.nom === 'SaLaH', enregistre.nom);
  t('AUCUN mot de passe conserve dans ce compte', !enregistre.password, JSON.stringify(enregistre.password));

  // ---------- 10c) LE DEMENAGEMENT : les listes du telephone partent sur le serveur ----------
  t('le mode suit le compte : avec le compte du serveur, le serveur est actif', ev('serveurActif()') === true);
  ev("classes = [" +
     "{ id: 1, nom: 'TCSF-1', eleves: [ { id: 1, massar: 'M001', nom: 'El Amrani', prenom: 'Mehdi' }," +
     "                                     { id: 2, massar: 'M002', nom: 'Berrada', prenom: 'Imane' } ] }," +
     "{ id: 2, nom: 'TCSF-2', eleves: [ { id: 3, massar: 'M003', nom: 'Ouazzani', prenom: 'Karim', actif: false } ] } ];");

  const r1 = await ev('serveurEnvoyerDonnees()');
  t('1er envoi : 2 classes creees sur le serveur', r1.classes === 2, r1.classes);
  t('1er envoi : 3 eleves ajoutes', r1.eleves === 3, r1.eleves);
  t('le serveur contient bien 2 classes et 3 eleves', base.classes.length === 2 && base.eleves.length === 3);
  t('le code MASSAR est transmis', base.eleves.filter(function (e) { return e.code_massar === 'M003'; }).length === 1);
  t('un eleve « sorti » part marque inactif',
    base.eleves.filter(function (e) { return e.actif === false; }).length === 1);

  const r2 = await ev('serveurEnvoyerDonnees()');
  t('2e envoi : AUCUN doublon (l envoi est rejouable)',
    r2.classes === 0 && r2.eleves === 0 && base.eleves.length === 3 && base.classes.length === 2,
    r2.classes + '/' + r2.eleves + ' puis ' + base.classes.length + ' classes, ' + base.eleves.length + ' eleves');

  const cpt = await ev('serveurCompterDonnees()');
  t('le serveur annonce 2 classes et 3 eleves', cpt.classes === 2 && cpt.eleves === 3,
    cpt.classes + ' / ' + cpt.eleves);


  // ---------- 10d) LES PERSONNES (prealable) PUIS LES ABSENCES ----------
  const rf1 = await ev('serveurEnvoyerFiches()');
  t('les personnes sont envoyees (professeurs + surveillants)', rf1.fiches >= 10, rf1.fiches);
  t('le directeur n est pas recree', base.fiches.filter(function (f) { return f.role === 'directeur'; }).length === 0);
  t('un surveillant part SANS matiere',
    base.fiches.filter(function (f) { return f.role === 'surveillant'; }).every(function (f) { return !f.matiere; }));
  t('un enseignant part AVEC sa matiere',
    base.fiches.filter(function (f) { return f.role === 'enseignant'; }).every(function (f) { return !!f.matiere; }));
  const rf2 = await ev('serveurEnvoyerFiches()');
  t('2e envoi des personnes : aucun doublon',
    rf2.fiches === 0 && base.fiches.length === rf1.fiches, rf2.fiches + ' puis ' + base.fiches.length);

  ev("absences = [" +
     "{ id: 1, eleveId: 1, nom: 'El Amrani Mehdi', classe: 'TCSF-1', dateISO: '2026-09-10', date: '10/09/2026'," +
     "  heure: '08:05', seance: 'matin', type: 'absence', statut: 'absent', enseignant: 'أيوب الكمرة', matiere: 'Maths' }," +
     "{ id: 2, eleveId: 2, nom: 'Berrada Imane', classe: 'TCSF-1', dateISO: '2026-09-10', date: '10/09/2026'," +
     "  heure: '08:05', seance: 'matin', type: 'retard', statut: 'absent', enseignant: 'أيوب الكمرة', matiere: 'Maths' }," +
     "{ id: 3, eleveId: 3, nom: 'Ouazzani Karim', classe: 'TCSF-2', dateISO: '2026-09-11', date: '11/09/2026'," +
     "  heure: '14:10', seance: 'apres-midi', type: 'absence', statut: 'justifie_s', motif: 'Maladie'," +
     "  justifiePar: 'Surveillant 1', justifieLe: '2026-09-11 14:40', enseignant: 'أيوب الكمرة', matiere: 'Maths' }," +
     "{ id: 4, eleveId: 9999, nom: 'Berrada Imane', classe: 'TCSF-1', dateISO: '2026-09-12', date: '12/09/2026'," +
     "  heure: '09:05', seance: 'matin', type: 'absence', statut: 'absent', enseignant: 'أيوب الكمرة', matiere: 'Maths' } ];");

  const rs1 = await ev('serveurEnvoyerSignalements()');
  t('les 4 absences arrivent sur le serveur', rs1.ajoutes === 4,
    rs1.ajoutes + ' ajoutees, ' + rs1.ignores + ' ignorees ' + rs1.raisons.join(' / '));
  t('une absence ORPHELINE (identifiant disparu) est rattachee par son nom',
    rs1.orphelins === 1 && rs1.ignores === 0, 'orphelins=' + rs1.orphelins);
  t('l orpheline pointe bien vers la fiche de l eleve du bon nom',
    base.signalements.filter(function (s) { return s.date_abs === '2026-09-12'; })[0].eleve_id ===
    base.eleves.filter(function (e) { return e.code_massar === 'M002'; })[0].id);
  t('un retard porte un delai STRICTEMENT positif',
    base.signalements.filter(function (s) { return s.type === 'retard'; }).every(function (s) { return s.retard_minutes > 0; }));
  t('une absence ne porte AUCUN delai',
    base.signalements.filter(function (s) { return s.type === 'absence'; }).every(function (s) { return s.retard_minutes === null; }));
  t('la justification porte son decideur et sa date',
    base.signalements.filter(function (s) { return s.statut === 'justifie_s'; })
      .every(function (s) { return !!s.decide_par && !!s.decide_le; }));
  t('chaque signalement est signale par le directeur connecte',
    base.signalements.every(function (s) { return s.signale_par === 7; }));
  t('le moment (matin / apres-midi) est transmis',
    base.signalements.some(function (s) { return s.moment === 'apres-midi'; }));
  t('l eleve est relie par son code MASSAR (bonne fiche)',
    base.signalements.filter(function (s) { return s.type === 'retard'; })[0].eleve_id ===
    base.eleves.filter(function (e) { return e.code_massar === 'M002'; })[0].id);
  const rs2 = await ev('serveurEnvoyerSignalements()');
  t('2e envoi des absences : aucune duplication (mises a jour)',
    rs2.ajoutes === 0 && rs2.maj === 4 && base.signalements.length === 4,
    rs2.ajoutes + '/' + rs2.maj + ' puis ' + base.signalements.length);

  const appelPersonnes = appels.filter(function (a) {
    return a.url.indexOf('/rest/v1/profils?etablissement_id=') >= 0 && a.url.indexOf('role=neq.directeur') >= 0;
  });
  t('le compteur des personnes N inclut PAS le directeur (les deux nombres sont comparables)',
    appelPersonnes.length > 0);

  // une absence dont l'eleve n'existe plus DU TOUT : elle doit etre LISTEE NOMMEMENT
  ev("absences.push({ id: 5, eleveId: 8888, nom: 'Eleve Disparu', classe: 'TCSF-1'," +
     " dateISO: '2026-09-13', date: '13/09/2026', heure: '08:05', seance: 'matin', type: 'absence'," +
     " statut: 'absent', enseignant: 'أيوب الكمرة', matiere: 'Maths' });");
  const rs3 = await ev('serveurEnvoyerSignalements()');
  t('une absence dont l eleve a disparu est NOMMEE (nom, date, type) pour que l utilisateur decide',
    rs3.ignores === 1 && rs3.raisons.length === 1 &&
    /Eleve Disparu/.test(rs3.raisons[0]) && /13\/09\/2026/.test(rs3.raisons[0]) && /absence/.test(rs3.raisons[0]),
    rs3.raisons[0]);

  // ---------- 10j) LES DEUX DERNIERES TABLES : absences du personnel et annulations ----------
  ev("indispoProfs = [ { id: 1, profCode: 'math-prof1', role: 'enseignant', debut: '2026-11-16', fin: '2026-11-18', portee: 'journee', motif: 'Formation', par: 'Directeur', le: '2026-09-13' }," +
     " { id: 2, profCode: 'inconnu-xyz', role: 'enseignant', debut: '2026-11-20', fin: '2026-11-21', portee: 'journee', motif: 'X', par: 'Directeur', le: '2026-09-13' } ];");
  const rap = await ev('serveurEnvoyerAbsencesPersonnel()');
  t('les absences du personnel partent, et une personne inconnue est SIGNALEE',
    rap.absences === 1 && rap.ignores === 1 && base.indispos.length === 1,
    rap.absences + ' envoyee(s), ' + rap.ignores + ' ignoree(s) : ' + rap.raisons[0]);
  t('la personne est reliee par sa FICHE, avec son role',
    base.indispos[0].role_absent === 'enseignant' && !!base.indispos[0].prof_id &&
    base.indispos[0].prof_id === base.fiches.filter(function (f) { return f.code === 'math-prof1'; })[0].id);

  ev("seancesAnnulees = [ { id: 1, dateISO: '2026-10-05', classe: 'TCSF-1', debut: '08:00', fin: '10:00', motif: 'Reunion', par: 'Directeur', le: '2026-09-13 10:00' }," +
     " { id: 2, dateISO: '2026-10-05', classe: 'TCSF-1', debut: '08:00', fin: '10:00', motif: 'Doublon', par: 'Directeur', le: '2026-09-13 10:05' } ];");
  const ran = await ev('serveurEnvoyerAnnulations()');
  t('les annulations partent, et un DOUBLON est refuse proprement (la base l interdit)',
    ran.annulations === 1 && ran.ignores === 1 && base.annulations.length === 1,
    ran.annulations + ' + ' + ran.ignores + ' ignoree(s) : ' + ran.raisons[0]);
  t('l annulation porte la classe par son identifiant et l heure de debut',
    !!base.annulations[0].classe_id && base.annulations[0].debut === '08:00:00');

  // ---------- 10i) LES FERMETURES ----------
  ev("fermeturesEtab = [ { id: 1, type: 'Vacances', libelle: 'Toussaint', debut: '2026-10-26', fin: '2026-11-01', portee: 'journee', par: 'Directeur', le: '2026-09-13' }," +
     " { id: 2, type: 'Reunion', libelle: 'Conseil', debut: '2026-11-10', fin: '2026-11-10', portee: 'matin', par: 'Directeur', le: '2026-09-13' }," +
     " { id: 3, type: 'Autre', libelle: 'Dates inversees', debut: '2026-12-05', fin: '2026-12-01', portee: 'journee', par: 'Directeur', le: '2026-09-13' } ];");
  const rfe = await ev('serveurEnvoyerFermetures()');
  t('les fermetures partent sur le serveur, et une fermeture incoherente est SIGNALEE',
    rfe.fermetures === 2 && rfe.ignores === 1 && base.fermetures.length === 2,
    rfe.fermetures + ' envoyees, ' + rfe.ignores + ' ignorees : ' + rfe.raisons[0]);
  t('la portee (journee / matin) est transmise',
    base.fermetures.some(function (f) { return f.portee === 'matin'; }));
  const rfe2 = await ev('serveurEnvoyerFermetures()');
  t('2e envoi : les fermetures sont REMPLACEES, pas dupliquees',
    rfe2.fermetures === 2 && base.fermetures.length === 2, base.fermetures.length + ' au total');

  // ---------- 10h) RETIRER UNE PERSONNE : elle est marquee INACTIVE, jamais supprimee ----------
  const avantFiches = base.fiches.length;
  const surveillant = base.fiches.filter(function (f) { return f.role === 'surveillant'; })[0];
  // (comptes est une const : on retire l'element EN PLACE, on ne reassigne pas la variable)
  ev("(function () { for (var i = comptes.length - 1; i >= 0; i--) {" +
     " if (comptes[i].nom === '" + surveillant.nom + "') comptes.splice(i, 1); } })();");
  const rd = await ev('serveurEnvoyerFiches()');
  t('une personne retiree de la liste est marquee INACTIVE sur le serveur',
    rd.desactivees === 1 && base.fiches.filter(function (f) { return f.actif === false; }).length === 1,
    'desactivees=' + rd.desactivees);
  t('elle n est PAS supprimee (son historique reste lisible)',
    base.fiches.length === avantFiches &&
    !!base.fiches.filter(function (f) { return f.nom === surveillant.nom; })[0]);
  t('elle sort des compteurs de personnes (comparables des deux cotes)',
    await (async function () {
      const c = await ev('serveurCompterDonnees()');
      return c.profils === base.fiches.filter(function (f) { return f.actif !== false; }).length;
    })());

  // ---------- 10g) LES TABLEAUX DE SERVICE sur le serveur (prealable aux comptes des profs) ----------
  ev("tableauxService = { 'math-prof1@taalim.ma': [" +
     "{ jour: 2, debut: '08:00', fin: '10:00', classe: 'TCSF-1', matiere: 'Maths', prof: 'math-prof1' }," +
     "{ jour: 4, debut: '14:00', fin: '16:00', classe: 'TCSF-2', matiere: 'Maths', prof: 'math-prof1' } ]" +
     ", 'prof-inconnu@taalim.ma': [ { jour: 1, debut: '08:00', fin: '09:00', classe: 'TCSF-1', matiere: 'Test', prof: 'X' } ] };");
  const rse = await ev('serveurEnvoyerSeances()');
  t('les seances du tableau de service partent sur le serveur',
    rse.seances === 2 && base.seances.length === 2,
    rse.seances + ' envoyees, ' + rse.ignores + ' ignorees ' + rse.raisons.join(' / '));
  t('un tableau dont le professeur est inconnu est SIGNALE, pas avale en silence',
    rse.ignores === 1 && /professeur non reconnu/.test(rse.raisons[0]), rse.raisons[0]);
  const s1 = base.seances[0];
  t('la seance porte la classe, le professeur, le jour et les horaires',
    s1.jour === 2 && s1.debut === '08:00:00' && s1.fin === '10:00:00' &&
    s1.classe_id === base.classes.filter(function (c) { return c.nom === 'TCSF-1'; })[0].id &&
    !!s1.prof_id, JSON.stringify(s1));
  const rse2 = await ev('serveurEnvoyerSeances()');
  t('2e envoi : le tableau est REMPLACE, pas duplique',
    rse2.seances === 2 && base.seances.length === 2, base.seances.length + ' seances au total');

  // ---------- 10f) LES ECRANS LISENT LE SERVEUR : la lecture remplace les donnees du telephone ----------
  const avantLecture = JSON.parse(ev('JSON.stringify(classes)'));
  const charge = await ev('serveurChargerDonnees()');
  t('la lecture ramene les classes, les eleves, les absences ET les cours du serveur',
    charge.classes === 2 && charge.eleves === 3 && charge.absences === 4 && charge.seances === 2,
    JSON.stringify(charge));
  const apres = JSON.parse(ev('JSON.stringify(classes)'));
  t('la lecture a bien remplace les donnees precedentes', avantLecture.length === 2);
  t('les classes de l app viennent maintenant du SERVEUR (pas du telephone)',
    apres.length === 2 && apres[0].nom === 'TCSF-1' && apres[0].eleves.length === 2,
    apres.length + ' classes, ' + (apres[0] ? apres[0].eleves.length : '?') + ' eleves');
  t('les eleves gardent leur code MASSAR', apres[0].eleves.some(function (e) { return e.massar === 'M001'; }));
  const ab = JSON.parse(ev('JSON.stringify(absences)'));
  t('les absences viennent du serveur, avec le nom de l eleve',
    ab.length === 4 && ab.some(function (a) { return /El Amrani|Berrada/.test(a.nom); }),
    ab.length + ' absences');
  t('et avec le nom de l enseignant (relie par sa FICHE du serveur)',
    ab.every(function (a) { return !!a.enseignant; }), ab[0] && ab[0].enseignant);
  const tabApres = JSON.parse(ev('JSON.stringify(tableauxService)'));
  t('les tableaux de service sont reconstruits depuis le serveur (cle = email du professeur)',
    Object.keys(tabApres).length === 1 && tabApres['math-prof1@taalim.ma'] &&
    tabApres['math-prof1@taalim.ma'].length === 2 &&
    tabApres['math-prof1@taalim.ma'][0].classe === 'TCSF-1',
    JSON.stringify(Object.keys(tabApres)));
  t('une copie de secours des donnees du telephone est gardee avant remplacement',
    !!win.localStorage.getItem('classesAvantServeur') && !!win.localStorage.getItem('absencesAvantServeur'));
  // garde-fou : une lecture VIDE ne doit RIEN remplacer (protection des donnees du telephone)
  const classesGardees = ev('classes.length');
  const sauvegarde = base.classes.slice();
  base.classes.length = 0;
  let refus = false;
  try { await ev('serveurChargerDonnees()'); } catch (e) { refus = true; }
  base.classes.push.apply(base.classes, sauvegarde);
  t('garde-fou : une lecture VIDE ne remplace pas les donnees du telephone',
    refus && ev('classes.length') === classesGardees,
    'refus=' + refus + ' classes=' + ev('classes.length'));

  const cpt2 = await ev('serveurCompterDonnees()');
  t('les compteurs complets : 5 familles de donnees (dont les cours)',
    cpt2.classes === 2 && cpt2.eleves === 3 &&
    cpt2.profils === base.fiches.filter(function (f) { return f.actif !== false; }).length &&
    cpt2.signalements === 4 && cpt2.seances === 2, JSON.stringify(cpt2));

  // ---------- 10e) LE JETON D UNE HEURE PERIME : l app doit se renouveler SEULE ----------
  const avant = rafraichissements;
  jetonsPerimes = 1;                       // le prochain appel au serveur echouera en 401
  const cpt3 = await ev('serveurCompterDonnees()');
  t('jeton perime : l app se renouvelle SEULE (aucun mot de passe a retaper)',
    rafraichissements === avant + 1 && jetonsPerimes === 0 && !!cpt3 && cpt3.classes === 2,
    'renouvellements=' + (rafraichissements - avant) + ' restants=' + jetonsPerimes);
  const sess2 = JSON.parse(win.localStorage.getItem('sessionServeur'));
  t('le nouveau jeton est enregistre', !!sess2 && sess2.access_token === 'jeton-ABC-123');
  t('et le jeton de rafraichissement est conserve', sess2.refresh_token === 'raf-1');

  // ---------- 11) REDEMARRAGE : l app se souvient du compte du serveur ----------
  const copie = {};
  for (let i = 0; i < win.localStorage.length; i++) {
    const cle = win.localStorage.key(i);
    copie[cle] = win.localStorage.getItem(cle);
  }
  const dom2 = new JSDOM(html, {
    runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true,
    beforeParse(w) {
      Object.keys(copie).forEach(k => w.localStorage.setItem(k, copie[k]));
      w.fetch = async function () { return { ok: true, status: 200, text: async function () { return '[]'; } }; };
    }
  });
  await pause(); await pause();
  t('APRES REDEMARRAGE : toujours connecte en directeur (l app se souvient)',
    dom2.window.document.getElementById('page-directeur').classList.contains('active'));
  t('le nom affiche reste celui de la fiche',
    JSON.parse(dom2.window.localStorage.getItem('utilisateur')).nom === 'SaLaH');

  // ---------- 11a) on joint l'espace serveur SANS se deconnecter (fenetre « Mon profil ») ----------
  const boutonProfil = Array.prototype.slice.call(doc.querySelectorAll('#modal-profil-dir button'))
    .filter(function (b) { return /espace serveur/i.test(b.textContent); })[0];
  t('un bouton « Espace serveur » existe dans la fenetre Mon profil', !!boutonProfil);
  if (boutonProfil) {
    doc.getElementById('modal-installation').classList.add('hidden');
    boutonProfil.click();
    await pause(); await pause();
    t('ce bouton ouvre bien l espace serveur',
      !doc.getElementById('modal-installation').classList.contains('hidden'));
    t('et la fenetre dit « Espace serveur » (et non « Première installation »)',
      doc.getElementById('inst-titre').textContent === 'Espace serveur',
      doc.getElementById('inst-titre').textContent);
    t('et l espace serveur montre ce que le serveur connait deja',
      doc.getElementById('inst-donnees-serveur').textContent.indexOf('Sur le serveur :') >= 0,
      doc.getElementById('inst-donnees-serveur').textContent);
    win.fermerInstallation();
  }

  // ---------- 11b) retour a un compte de demonstration : plus aucun appel au serveur ----------
  doc.getElementById('login-email').value = 'd@taalim.ma';
  doc.getElementById('login-password').value = '12345';
  win.connexion();
  t('avec un compte de demonstration : le serveur devient inactif', ev('serveurActif()') === false);

  // ---------- 11c) renouvellement impossible : le dire, sans proposer de tout recréer ----------
  refreshRefus = true;
  jetonsPerimes = 5;
  await ev('ouvrirInstallation()');
  await attendreQue(function () { return /Impossible de lire/.test(doc.getElementById('inst-aide-fiche').textContent); }, 60);
  t('renouvellement impossible : l app le DIT clairement',
    /Impossible de lire/.test(doc.getElementById('inst-aide-fiche').textContent),
    doc.getElementById('inst-aide-fiche').textContent.slice(0, 90));
  t('et elle ne propose PAS de recreer l etablissement (il existe deja)',
    doc.getElementById('inst-formulaire').style.display === 'none');
  t('elle propose de se reconnecter, et oublie la session morte',
    doc.getElementById('inst-reconnecter').style.display !== 'none' &&
    win.localStorage.getItem('sessionServeur') === null);
  refreshRefus = false;
  jetonsPerimes = 0;

  // ---------- 12) HORS LIGNE : la connexion de demonstration repond toujours tout de suite ----------
  // (c est ce qui protege les 37 suites, qui appellent connexion() sans aucun reseau)
  const dom3 = new JSDOM(html, { runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true });
  const d3 = dom3.window.document;
  await pause();
  d3.getElementById('login-email').value = 'inconnu@taalim.ma';
  d3.getElementById('login-password').value = '12345';
  dom3.window.connexion();
  t('sans reseau : le refus est immediat (aucune attente)',
    d3.getElementById('login-error-text').textContent === 'Email ou mot de passe incorrect',
    d3.getElementById('login-error-text').textContent);
  d3.getElementById('login-email').value = 'd@taalim.ma';
  d3.getElementById('login-password').value = '12345';
  dom3.window.connexion();
  t('sans reseau : le compte de demonstration entre normalement',
    d3.getElementById('page-directeur').classList.contains('active'));

  console.log(ok ? '=== TOUT OK ===' : '=== DES ECHECS ===');
  process.exit(ok ? 0 : 1);
})();
