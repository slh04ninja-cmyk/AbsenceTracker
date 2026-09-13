// Test jsdom : import des tableaux xlsx (services + eleves) — v3.47
// Les tableaux de test viennent de VRAIS fichiers xlsx (openpyxl) : _aoa_service.json (tableau de
// service TCSLHF1 au format de l'etablissement) et _aoa_eleves.json (2 feuilles de classes en arabe).
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('AbsenceTrack-v2.html', 'utf8');
const AOA_SERVICE = JSON.parse(fs.readFileSync('tests/fixtures/_aoa_service.json', 'utf8'));
const AOA_ELEVES = JSON.parse(fs.readFileSync('tests/fixtures/_aoa_eleves.json', 'utf8'));

// classe existante avec un eleve deja present (pour tester le dedoublonnage par code MASSAR)
const classesPerso = [
  { id: 1, nom: 'TCSF-4', eleves: [{ id: 1, nom: 'Berrada Souad', prenom: '', massar: 'J130012349', nomArabe: 'برادة سعاد', nomFr: 'Berrada Souad' }] }
];
const erreurs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => erreurs.push('jsdomError: ' + (e.message || e)));
const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(win) {
    win.localStorage.setItem('classes', JSON.stringify(classesPerso));
    win.localStorage.setItem('absenceTrackVersion', 'v3.0');
    win.localStorage.setItem('absences', '[]');
    win.localStorage.setItem('testHistoGenere_v1', '1');
    win.localStorage.setItem('testHistoGenere_v2', '1');
    win.localStorage.setItem('testHistoGenere_v3', '1');
    win.localStorage.setItem('testHistoGenere_v6', '1');
  }
});
const win = dom.window, doc = win.document;
let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };
const attendre = ms => new Promise(r => setTimeout(r, ms));
const VraiDate = win.Date;
function figer(jourISO, jourJS, h, m) {
  win.Date = class extends VraiDate {
    constructor(...a) { super(...(a.length ? a : [jourISO + 'T' + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':00'])); }
    getDay() { return jourJS; }
    getHours() { return h; }
    getMinutes() { return m; }
  };
}
// stubs SheetJS : read() renvoie un classeur fabrique a partir d'un AOA de test
function stubXLSX(source) {
  const noms = Object.keys(source);
  const sheets = {};
  noms.forEach(n => { sheets[n] = { aoa: source[n].aoa, '!merges': source[n].merges || [] }; });
  win.XLSX = {
    read: function () { return { SheetNames: noms, Sheets: sheets }; },
    utils: { sheet_to_json: function (ws) { return ws.aoa; } }
  };
}
const lire = () => win.localStorage.getItem('tableauxService_v2');
const classesMem = () => JSON.parse(win.eval('JSON.stringify(classes)'));

(async () => {
  await attendre(300);
  doc.getElementById('login-email').value = 'd@taalim.ma';
  doc.getElementById('login-password').value = '12345';
  win.connexion();

  // 1. la carte d'import existe dans Gestion
  win.switchDirPage('dir-gestion');
  const page = doc.getElementById('page-dir-gestion');
  // v3.72 : une seule carte "Importation des fichiers" avec 3 sous-titres
  t('carte « Importation des fichiers » avec ses 3 sous-titres',
    !!doc.getElementById('import-card') && page.innerHTML.indexOf('Importation des fichiers') > 0 &&
    page.innerHTML.indexOf('Importer les listes MASSAR') > 0 &&
    page.innerHTML.indexOf('Importer les tableaux de services') > 0 &&
    page.innerHTML.indexOf("Importer les tableaux d'élèves") > 0 &&
    !!doc.getElementById('file-service') && !!doc.getElementById('file-eleves') && !!doc.getElementById('file-massar'));
  t('les imports services / élèves acceptent xlsx ou FET',
    doc.getElementById('file-service').getAttribute('accept').indexOf('.fet') > 0 &&
    doc.getElementById('file-eleves').getAttribute('accept').indexOf('.fet') > 0 &&
    doc.getElementById('file-massar').getAttribute('accept').indexOf('.fet') < 0);
  t('les deux zones sont en mode multiple',
    doc.getElementById('file-service').hasAttribute('multiple') && doc.getElementById('file-eleves').hasAttribute('multiple'));
  t('deux zones de previsualisation', !!doc.getElementById('service-preview') && !!doc.getElementById('eleves-preview'));

  // 2. import des tableaux de service (fichier reel TCSLHF1)
  stubXLSX(AOA_SERVICE);
  win.importerTableauxService({ files: [new win.File([new Uint8Array([1])], 'tab_service_TCSLHF1.xlsx')], value: '' });
  await attendre(150);
  const apercu = doc.getElementById('service-preview');
  const txtApercu = apercu.textContent;
  t('apercu : 1 tableau lisible', txtApercu.indexOf('1 tableau(x) lisible(s)') > 0, txtApercu.slice(0, 90));
  t('apercu : 23 seances lues (dont 3 de 2 h)', txtApercu.indexOf('23 séance(s)') > 0, txtApercu.slice(0, 120));
  t('apercu : 9 professeurs', txtApercu.indexOf('9 professeur(s)') > 0);
  t('apercu : le prof de maths est relie a son compte',
    txtApercu.indexOf('أيوب الكمرة (Maths)') > 0 && txtApercu.indexOf('2 h') > 0, txtApercu.slice(0, 200));
  t('apercu : le prof d EPS est enregistre sous son nom arabe', txtApercu.indexOf('يسرى البوسعيدي') > 0);
  t('apercu : bouton de confirmation present', !!apercu.querySelector('button'));

  win.confirmerImportTableauxService();
  await attendre(50);
  const cleMath = 'math-prof1@taalim.ma';
  const service = JSON.parse(lire());
  t('tableauxService enregistre dans localStorage', !!service && !!service[cleMath], Object.keys(service).length + ' cle(s)');
  t('maths : 2 creneaux importes (lundi 08:30-09:30, mardi 14:00-15:00)',
    service[cleMath].length === 2 &&
    service[cleMath][0].debut === '08:30' && service[cleMath][0].jour === 1 && service[cleMath][0].classe === 'TCSLHF1' &&
    service[cleMath][1].debut === '14:00' && service[cleMath][1].jour === 2,
    JSON.stringify(service[cleMath]));
  t('les comptes arabe / francais / SVT aussi relies',
    !!service['ar-prof1@taalim.ma'] && !!service['fr-prof1@taalim.ma'] && !!service['svt-prof1@taalim.ma']);
  t('EPS relie a son compte (2 creneaux)', !!service['eps-prof1@taalim.ma'] && service['eps-prof1@taalim.ma'].length === 2,
    !!service['eps-prof1@taalim.ma'] ? service['eps-prof1@taalim.ma'].length + ' creneau(x)' : 'absent');
  // une matiere sans compte garde le nom du prof comme cle (repli)
  const cleInconnue = win.eval("JSON.stringify(repartirParProfesseur([{classe:'X', profs:{'Arts plastiques':'Jean Dupont'}, creneaux:[{jour:1, debut:'08:00', fin:'10:00', matiere:'Arts plastiques', salle:''}]}]))");
  t('matiere sans compte : cle = nom du prof', !!JSON.parse(cleInconnue)['Jean Dupont'] && JSON.parse(cleInconnue)['Jean Dupont'].length === 1,
    cleInconnue.slice(0, 100));
  t('previsualisation refermee apres validation', apercu.classList.contains('hidden'));

  // 3. import des tableaux d'eleves
  stubXLSX(AOA_ELEVES);
  win.importerTableauxEleves({ files: [new win.File([new Uint8Array([2])], 'eleves.xlsx')], value: '' });
  await attendre(150);
  const apercuE = doc.getElementById('eleves-preview');
  const txtE = apercuE.textContent;
  t('eleves : 2 classes lues', txtE.indexOf('2 classe(s)') > 0, txtE.slice(0, 110));
  t('eleves : 6 eleves au total, 5 a ajouter (1 deja present)', txtE.indexOf('6 élève(s)') > 0 && txtE.indexOf('5 à ajouter') > 0, txtE.slice(0, 140));
  t('eleves : la classe existante est signalee', txtE.indexOf('TCSF-4') > 0 && txtE.indexOf('(existante)') > 0);
  t('eleves : la nouvelle classe est signalee', txtE.indexOf('TCSLHF1') > 0 && txtE.indexOf('(nouvelle classe)') > 0);

  win.confirmerImportEleves();
  await attendre(50);
  const cl = classesMem();
  const tcs = cl.find(c => c.nom === 'TCSLHF1');
  const tcsf = cl.find(c => c.nom === 'TCSF-4');
  t('classe TCSLHF1 creee avec 4 eleves', !!tcs && tcs.eleves.length === 4, tcs ? tcs.eleves.length : 'absente');
  t('TCSF-4 : 1 seul eleve ajoute (pas de doublon par code MASSAR)', tcsf.eleves.length === 2, tcsf.eleves.length);
  t('la ligne « ملاحظة » n a pas ete importee comme eleve',
    !tcs.eleves.some(e => (e.nom || '').indexOf('ملاحظ') >= 0));
  t('eleves enregistres dans localStorage', JSON.parse(win.localStorage.getItem('classes')).some(c => c.nom === 'TCSLHF1'));
  t('previsualisation eleves refermee', apercuE.classList.contains('hidden'));

  // re-import : aucun doublon
  win.importerTableauxEleves({ files: [new win.File([new Uint8Array([3])], 'eleves.xlsx')], value: '' });
  await attendre(150);
  t('re-import : 0 eleve a ajouter (dedoublonnage)', doc.getElementById('eleves-preview').textContent.indexOf('0 à ajouter') > 0,
    doc.getElementById('eleves-preview').textContent.slice(0, 120));
  win.confirmerImportEleves();
  await attendre(30);
  t('re-import : total inchange', classesMem().find(c => c.nom === 'TCSLHF1').eleves.length === 4);

  // 4. integration : le tableau importe pilote le Dashboard du prof de maths
  figer('2026-09-14', 1, 8, 45);       // lundi 08:45 -> maths : TCSLHF1 (08:30-09:30)
  doc.getElementById('login-email').value = 'math-prof1@taalim.ma';
  doc.getElementById('login-password').value = '12345';
  win.connexion();
  t('tableau importe actif : le prof de maths a TCSLHF1 preselectionnee',
    win.eval('classeSelectionnee ? classeSelectionnee.nom : null') === 'TCSLHF1',
    String(win.eval('classeSelectionnee ? classeSelectionnee.nom : null')));
  t('la liste des eleves de TCSLHF1 est affichee',
    doc.getElementById('liste-eleves-enseignant').children.length === 4,
    doc.getElementById('liste-eleves-enseignant').children.length);
  t('menu de classe bloque avec l horaire du creneau',
    doc.getElementById('select-classe').disabled === true &&
    doc.getElementById('select-classe').options[0].textContent.indexOf('08:30–09:30') > 0,
    doc.getElementById('select-classe').options[0] ? doc.getElementById('select-classe').options[0].textContent : '');
  figer('2026-09-14', 1, 12, 30);      // lundi 12:30 -> fin de creneau : repos
  win.appliquerTableauService();
  t('hors creneau : aucune classe et bloc repos',
    win.eval('classeSelectionnee') === null && !doc.getElementById('ens-repos').classList.contains('hidden'));

  if (erreurs.length) { console.log('--- erreurs jsdom ---'); erreurs.slice(0, 5).forEach(e => console.log('   ' + e)); }
  console.log('\n=== ' + ((ok && !erreurs.length) ? 'TOUT OK' : 'PROBLEME') + ' ===');
  process.exit((ok && !erreurs.length) ? 0 : 1);
})();
