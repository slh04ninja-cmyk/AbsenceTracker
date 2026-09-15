/* tests/test_v389_codes.js — l'outil « Codes MASSAR manquants ».
 *
 * Pourquoi : un eleve SANS code MASSAR ne peut etre ni reconnu a l'import, ni
 * propose comme « sorti » : il resterait melange aux vrais eleves.
 * v3.96 : le bouton ne fabrique plus de code — il RECHERCHE et LISTE les eleves
 * sans code, classe par classe, sans rien modifier (demande de l'utilisateur).
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const RACINE = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(RACINE, 'AbsenceTrack-v2.html'), 'utf8');
const dom = new JSDOM(html, {
  beforeParse(win) { win.localStorage.setItem('modeDemonstration', '1'); },   // banc de DEMONSTRATION
  runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true });
const win = dom.window, doc = win.document;
const ev = (c) => win.eval(c);
let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };
const liste = () => doc.getElementById('massar-manquants-liste');

setTimeout(() => {
  // trois eleves sans code (comme les classes de demonstration), deux avec code
  ev("classes = [{ id: 1, nom: 'TCSF-1', eleves: [" +
     "{ id: 1, massar: '',        nom: 'DEMO Un'   }," +
     "{ id: 2, massar: '   ',     nom: 'DEMO Deux' }," +
     "{ id: 3, massar: 'R130001', nom: 'VRAI Un'   } ] }," +
     "{ id: 2, nom: 'TCSF-2', eleves: [" +
     "{ id: 4, massar: '',        nom: 'DEMO Trois' }," +
     "{ id: 5, massar: 'R130002', nom: 'VRAI Deux' } ] }];");
  ev("localStorage.setItem('classes', JSON.stringify(classes));");

  t('l outil voit les eleves sans code (espaces comptes comme vides)',
    JSON.parse(ev('JSON.stringify(elevesSansCode())')).length === 3,
    ev('elevesSansCode().length') + ' sans code');
  t('la liste est cachee avant la recherche', liste().classList.contains('hidden'));

  ev('rechercherElevesSansCode()');

  const txt = liste().textContent;
  t('la recherche affiche la liste', !liste().classList.contains('hidden'));
  t('le nombre total est annonce', txt.indexOf('3 élève(s) sans code MASSAR') >= 0, txt.slice(0, 60));
  t('chaque classe est nommee avec son nombre',
    txt.indexOf('TCSF-1 · 2 élève(s)') >= 0 && txt.indexOf('TCSF-2 · 1 élève(s)') >= 0, txt.slice(0, 120));
  t('les 3 eleves sans code sont listes',
    txt.indexOf('DEMO Un') >= 0 && txt.indexOf('DEMO Deux') >= 0 && txt.indexOf('DEMO Trois') >= 0, txt);
  t('les eleves qui ONT un code ne sont pas listes',
    txt.indexOf('VRAI Un') < 0 && txt.indexOf('VRAI Deux') < 0, txt);
  t('chaque ligne est marquee « sans code »',
    doc.querySelectorAll('#massar-manquants-liste .text-xs').length >= 3);

  // le point important : la recherche ne modifie RIEN
  const etat = JSON.parse(ev("JSON.stringify(classes.map(function (c) { return c.eleves.map(function (e) { return e.massar; }); }))"));
  t('aucun code n a ete invente (donnees inchangees)',
    etat[0][0] === '' && etat[0][1] === '   ' && etat[0][2] === 'R130001' &&
    etat[1][0] === '' && etat[1][1] === 'R130002', JSON.stringify(etat));
  t('rien n a ete enregistre sur le telephone',
    (win.localStorage.getItem('classes') || '').indexOf('H99') < 0);
  t('plus aucune fonction de numerotation automatique',
    typeof ev('typeof numeroterElevesSansCode') === 'string' && ev('typeof numeroterElevesSansCode') === 'undefined',
    ev('typeof numeroterElevesSansCode'));

  // deuxieme passage : tout le monde a un code -> message clair, aucune ligne d eleve
  ev("classes = [{ id: 1, nom: 'TCSF-1', eleves: [{ id: 1, massar: 'R130001', nom: 'VRAI Un' }] }];");
  ev('rechercherElevesSansCode()');
  t('tous les eleves ont un code : message clair',
    liste().textContent.indexOf('Tous les élèves ont un code MASSAR') >= 0, liste().textContent.slice(0, 60));
  t('une notification le dit (comme « Rechercher les doublons »)',
    doc.getElementById('toast').textContent.indexOf('Aucun élève sans code MASSAR détecté') >= 0,
    doc.getElementById('toast').textContent);
  t('la notification est de nature information (ardoise)',
    Array.from(doc.getElementById('toast').classList).indexOf('ton-info') >= 0, doc.getElementById('toast').className);
  t('et aucune ligne d eleve n est affichee', liste().querySelectorAll('div').length === 0);

  console.log(ok ? '=== TOUT OK ===' : '=== ECHECS ===');
  process.exit(ok ? 0 : 1);
}, 500);
