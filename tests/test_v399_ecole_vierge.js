/* tests/test_v399_ecole_vierge.js — une ECOLE commence VIDE.
 *
 * Demande de l'utilisateur : l'application sera livree a d'autres etablissements
 * dont les directeurs ne connaissent rien a l'informatique ; ils doivent partir
 * d'une version SANS donnees de test.
 *
 * Deux cas, chacun verifie :
 *   1. defaut (installation neuve, ecole) : AUCUNE classe, AUCUNE absence,
 *      AUCUN historique de demonstration ;
 *   2. telephone de demonstration (modeDemonstration = '1') : la demonstration
 *      est bien la, comme avant (c'est ce que testent les autres bancs).
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const RACINE = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(RACINE, 'AbsenceTrack-v2.html'), 'utf8');
let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };

function ouvrir(avant) {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true,
    beforeParse(win) { if (avant) avant(win); }
  });
  return dom.window;
}

const pause = ms => new Promise(r => setTimeout(r, ms));

// ---------- 1. installation neuve : rien du tout ----------
setTimeout(async () => {
  const win = ouvrir(null);
  await pause(150);                        // l'application demarre quand la page est prete
  const doc = win.document;
  t('aucune classe de demonstration', win.eval('classes.length') === 0, win.eval('classes.length') + ' classe(s)');
  t('aucune absence', win.eval('absences.length') === 0, win.eval('absences.length') + ' absence(s)');
  t('aucun tableau de service de demonstration', win.eval('Object.keys(tableauxService).length') === 0);
  t('aucun historique fabrique', win.localStorage.getItem('testHistoGenere_v6') === null);
  t('rien de range dans le telephone', win.localStorage.getItem('classes') === null);
  t('le mode ecole n est pas encore pose', win.eval('estModeEcole()') === false);

  // ---------- 2. le formulaire « installer une nouvelle ecole » ----------
  const panneau = doc.getElementById('panneau-ecole');
  t('le panneau d installation existe et est ferme', !!panneau && panneau.classList.contains('hidden'));
  win.basculerPanneauEcole();
  t('il s ouvre au clic', !panneau.classList.contains('hidden'));
  t('le code, le nom et le compte du directeur sont demandes',
    !!doc.getElementById('ecole-code') && !!doc.getElementById('ecole-nom') &&
    !!doc.getElementById('ecole-directeur') && !!doc.getElementById('ecole-email') && !!doc.getElementById('ecole-mdp'));
  t('les academies sont proposees', doc.getElementById('ecole-academie').options.length > 5,
    doc.getElementById('ecole-academie').options.length + ' choix');
  t('les directions suivent l academie', doc.getElementById('ecole-direction').options.length > 0,
    doc.getElementById('ecole-direction').options.length + ' choix');
  t('l annee scolaire est pre-remplie', String(doc.getElementById('ecole-annee').value).length >= 8,
    doc.getElementById('ecole-annee').value);

  // ---------- 3. en mode ecole : les comptes du telephone sont caches, et la
  //                 connexion passe par le serveur (jamais par le telephone) ----------
  const win2 = ouvrir(w => w.localStorage.setItem('installationServeur', '1'));
  await pause(150);
  const doc2 = win2.document;
  t('mode ecole actif', win2.eval('estModeEcole()') === true);
  t('la liste des comptes du telephone est cachee', doc2.getElementById('bloc-comptes-test').classList.contains('hidden'));
  doc2.getElementById('login-email').value = 'd@taalim.ma';
  doc2.getElementById('login-password').value = '12345';
  win2.connexion();                       // doit passer par la base, pas par le telephone
  t('un compte du telephone ne donne plus acces en mode ecole',
    win2.eval('utilisateurConnecte') === null && !doc2.getElementById('page-directeur').classList.contains('active'),
    win2.eval('utilisateurConnecte') === null ? 'refuse' : 'CONNECTE');
  t('aucune classe de demonstration non plus', win2.eval('classes.length') === 0);

  // ---------- 4. telephone de demonstration : la demo reste disponible ----------
  const win3 = ouvrir(w => w.localStorage.setItem('modeDemonstration', '1'));
  await pause(150);
  t('mode demonstration actif', win3.eval('modeDemonstration()') === true);
  t('les classes de demonstration sont la', win3.eval('classes.length') === 3, win3.eval('classes.length') + ' classe(s)');
  t('les eleves de demonstration aussi', win3.eval('classes[0].eleves.length') === 12, win3.eval('classes[0].eleves.length'));
  t('les tableaux de service de demonstration aussi', win3.eval('Object.keys(tableauxService).length') > 3,
    win3.eval('Object.keys(tableauxService).length') + ' prof(s)');
  t('l historique de demonstration est fabrique', win3.localStorage.getItem('testHistoGenere_v6') === '1');

  // ---------- 5. ce qui est enregistre n est JAMAIS perdu ----------
  const win4 = ouvrir(w => {
    w.localStorage.setItem('classes', JSON.stringify([{ id: 1, nom: '2BACSPF-1', eleves: [{ id: 5, massar: 'H1', nom: 'vrai eleve' }] }]));
    w.localStorage.setItem('absenceTrackVersion', 'v3.0');
  });
  await pause(150);
  t('une classe enregistree est reprise telle quelle', win4.eval('classes.length') === 1 && win4.eval('classes[0].nom') === '2BACSPF-1',
    win4.eval('classes.length') + ' classe(s)');
  t('son eleve aussi', win4.eval('classes[0].eleves.length') === 1 && win4.eval('classes[0].eleves[0].nom') === 'vrai eleve');

  console.log(ok ? '=== TOUT OK ===' : '=== ECHECS ===');
  process.exit(ok ? 0 : 1);
}, 700);
