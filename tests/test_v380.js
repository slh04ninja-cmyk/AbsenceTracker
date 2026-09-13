// test_v380.js — élèves « sortis » et suppression sans perte d'historique.
// 1. un élève qui quitte l'établissement : masqué de l'appel, historique conservé, rétablissable
// 2. supprimer un élève n'efface PLUS ses signalements (avant : perte de données silencieuse)
// 3. à l'import, les élèves qui ne figurent plus dans le fichier sont PROPOSÉS comme sortis
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('AbsenceTrack-v2.html', 'utf8');

const classes = [
  { id: 1, nom: 'TCSF-1', eleves: [
    { id: 1, massar: 'M001', nom: 'El Amrani', prenom: 'Ahmed' },
    { id: 2, massar: 'M002', nom: 'Berrada',   prenom: 'Imane' },
    { id: 3, massar: 'M003', nom: 'Ouazzani',  prenom: 'Karim' }
  ] },
  { id: 2, nom: 'TCSF-2', eleves: [
    { id: 4, massar: 'M004', nom: 'Fikri', prenom: 'Salma' }
  ] }
];
const absences = [
  { id: 1, eleveId: 1, nom: 'El Amrani Ahmed', classe: 'TCSF-1', dateISO: '2026-09-10', date: '10/09/2026',
    heure: '08:05', seance: 'matin', type: 'absence', statut: 'absent', enseignant: 'أيوب الكمرة', matiere: 'Maths' },
  { id: 2, eleveId: 1, nom: 'El Amrani Ahmed', classe: 'TCSF-1', dateISO: '2026-09-11', date: '11/09/2026',
    heure: '09:05', seance: 'matin', type: 'retard', statut: 'justifie_s', justifiePar: 'Surveillant 1',
    justifieLe: '2026-09-11 09:10', enseignant: 'أيوب الكمرة', matiere: 'Maths' }
];

const erreurs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => erreurs.push('jsdomError: ' + (e.message || e)));
const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(win) {
    win.localStorage.setItem('absenceTrackVersion', 'v3.0');
    win.localStorage.setItem('testHistoGenere_v6', '1');
    win.localStorage.setItem('classes', JSON.stringify(classes));
    win.localStorage.setItem('absences', JSON.stringify(absences));
  }
});
const win = dom.window, doc = win.document;
let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };
const nEleves = () => doc.querySelectorAll('#liste-eleves-enseignant .eleve-item, #liste-eleves-enseignant > div').length;
const nbAbsences = () => JSON.parse(win.localStorage.getItem('absences') || '[]').length;
const eleveDe = (classeId, eleveId) => JSON.parse(win.eval(
  "JSON.stringify(((classes.find(function(c){return c.id===" + classeId + ";})||{eleves:[]}).eleves||[])" +
  ".find(function(e){return e.id===" + eleveId + ";}) || null)"));

setTimeout(() => {
  const db = JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.role==='directeur';})[0])"));
  doc.getElementById('login-email').value = db.email;
  doc.getElementById('login-password').value = db.password;
  win.connexion();

  // ---------- 1. Le statut « sorti » ----------
  t('au départ : 3 élèves actifs dans TCSF-1', win.elevesActifs(JSON.parse(win.eval("JSON.stringify(classes[0])"))).length === 3);
  win.choisirClasse(1);
  const avant = nEleves();
  t('l appel affiche les 3 élèves', avant === 3, avant);

  win.marquerEleveSorti(1, 2, true);   // Berrada Imane quitte l'établissement
  t('l élève est marqué sorti', eleveDe(1, 2).actif === false);
  win.choisirClasse(1);
  const apres = nEleves();
  t('il DISPARAÎT de l appel du jour', apres === avant - 1, apres + ' au lieu de ' + avant);
  t('il n est plus compté comme actif',
    win.elevesActifs(JSON.parse(win.eval("JSON.stringify(classes[0])"))).length === 2);
  t('il reste dans la classe (visible dans Gestion)',
    JSON.parse(win.eval("JSON.stringify(classes[0].eleves)")).length === 3);
  t('SON HISTORIQUE EST INTACT', nbAbsences() === 2, nbAbsences());

  // la fiche de la classe le montre avec un badge et un bouton Rétablir
  win.ouvrirDetailClasse(1);
  const detail = doc.getElementById('detail-classe-eleves').innerHTML;
  t('Gestion : badge « sorti » sur son nom', detail.indexOf('sorti') >= 0 && detail.indexOf('Berrada Imane') >= 0);
  t('Gestion : bouton « Rétablir » proposé', detail.indexOf('Rétablir') >= 0);
  t('Gestion : compteur des actifs et des sortis', detail.indexOf('2 élève(s) actif') >= 0 && detail.indexOf('1 sorti') >= 0);
  win.fermerDetailClasse();

  // réversible
  win.marquerEleveSorti(1, 2, false);
  win.choisirClasse(1);
  t('RÉTABLI : il réapparaît dans l appel', nEleves() === 3, nEleves());
  t('et son historique est toujours là', nbAbsences() === 2);

  // ---------- 2. Supprimer un élève ne détruit plus son historique ----------
  const avantSuppression = nbAbsences();
  win.demanderSuppressionEleve(1, 1);      // El Amrani Ahmed, qui a 2 signalements
  t('la suppression demande confirmation', !doc.getElementById('modal-confirmation').classList.contains('hidden'));
  win.annulerConfirmation();
  t('annuler conserve l élève', eleveDe(1, 1) !== null && nbAbsences() === avantSuppression);

  win.demanderSuppressionEleve(1, 1);
  const msg = doc.getElementById('message-confirmation').textContent;
  t('le message prévient que l historique est conservé', /historique/i.test(msg), msg);
  t('le message propose « Marquer sorti »', /Marquer sorti/i.test(msg));
  win.validerConfirmation();
  t('l élève est bien retiré de la classe', eleveDe(1, 1) === null);
  t('SES 2 SIGNALEMENTS SONT CONSERVÉS (plus de perte de données)', nbAbsences() === avantSuppression,
    nbAbsences() + ' au lieu de ' + avantSuppression);

  // ---------- 3. Import : les élèves absents du fichier sont proposés comme sortis ----------
  // le fichier ne contient que Karim (M003) pour TCSF-1 -> Imane (M002) ne figure plus
  win.eval("importEleves = " + JSON.stringify({ classes: [
    { classe: 'TCSF-1', eleves: [{ massar: 'M003', nom: 'Ouazzani', prenom: 'Karim' }] }
  ], erreurs: [] }));
  win.confirmerImportEleves();
  const msgImport = doc.getElementById('message-confirmation').textContent;
  t('l import PROPOSE de marquer les absents du fichier (confirmation)',
    !doc.getElementById('modal-confirmation').classList.contains('hidden') && /ne figurent plus/i.test(msgImport), msgImport);
  t('il nomme l élève concerné', msgImport.indexOf('Berrada Imane') >= 0, msgImport);
  win.annulerConfirmation();
  t('si je refuse : l élève reste actif', eleveDe(1, 2).actif !== false);

  // on recommence et on accepte
  win.eval("importEleves = " + JSON.stringify({ classes: [
    { classe: 'TCSF-1', eleves: [{ massar: 'M003', nom: 'Ouazzani', prenom: 'Karim' }] }
  ], erreurs: [] }));
  win.confirmerImportEleves();
  win.validerConfirmation();
  t('si j accepte : l élève est marqué sorti', eleveDe(1, 2).actif === false);
  t('l autre classe n est PAS touchée (import partiel)', eleveDe(2, 4).actif !== false);
  t('aucun doublon créé', JSON.parse(win.eval("JSON.stringify(classes[0].eleves)")).length === 2,
    win.eval("classes[0].eleves.length"));
  t('l historique est toujours intact', nbAbsences() === avantSuppression);

  t('aucune erreur JS', erreurs.length === 0, erreurs[0] || '');
  console.log(ok ? '=== TOUT OK ===' : '=== ECHECS ===');
  process.exit(ok ? 0 : 1);
}, 900);
