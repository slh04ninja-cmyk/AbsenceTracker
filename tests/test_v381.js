// test_v381.js — LE BUG SIGNALE PAR L'UTILISATEUR :
//   fichier MASSAR de 28 eleves -> 1 eleve supprime dans l'app -> reimport du MEME
//   fichier -> l'app fusionnait les deux (28 + 27 = 55 eleves dupliques).
// Ici on rejoue exactement ce scenario, plus ce qui va avec :
//   - 2e import du meme fichier sans suppression (28 restent 28)
//   - nom corrige dans MASSAR (applique, sans doublon, historique conserve)
//   - eleve disparu du fichier -> proposition « sorti »
//   - eleve supprime puis reimporte -> ses signalements sont rattaches
//   - outil de reparation pour les donnees DEJA abimees (28 + 28 -> 28)
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('AbsenceTrack-v2.html', 'utf8');

const erreurs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => erreurs.push('jsdomError: ' + (e.message || e)));
const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(win) {
    win.localStorage.setItem('absenceTrackVersion', 'v3.0');
    win.localStorage.setItem('testHistoGenere_v6', '1');
  }
});
const win = dom.window, doc = win.document;
let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };
const attendre = ms => new Promise(r => setTimeout(r, ms));
const ELEVES = () => JSON.parse(win.eval("JSON.stringify(classes[0].eleves)"));
const codes = () => ELEVES().map(e => String(e.massar));
const nbAbsences = () => JSON.parse(win.localStorage.getItem('absences') || '[]').length;
const opts = () => JSON.parse(win.eval("JSON.stringify({ classes: classes.length, suivants: nextEleveId })"));

// le fichier MASSAR : 28 eleves, codes M001..M028
function fichier(n) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    out.push({ id: 5000 + i, massar: 'M' + String(i).padStart(3, '0'), nomArabe: 'تلميذ ' + i,
               nomFr: 'Eleve ' + i, nom: 'Eleve ' + i, prenom: '' });
  }
  return out;
}
function importer(liste) {
  win.XLSX = { read: function () { return { SheetNames: ['feuille'], Sheets: { feuille: {} } }; } };
  win.analyserFeuilleMASSAR = function () { return { nom: 'TCSF-1', eleves: liste }; };
  win.importerMassar({ files: [new win.File([new Uint8Array([1, 2])], 'massar.xlsx')], value: '' });
}

setTimeout(async () => {
  await attendre(900);
  const db = JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.role==='directeur';})[0])"));
  doc.getElementById('login-email').value = db.email;
  doc.getElementById('login-password').value = db.password;
  win.connexion();

  // depart propre : aucune classe, aucun signalement
  win.eval("classes = []; absences = []; sauvegarderClasses(); localStorage.setItem('absences','[]');");

  // ---------- 1. premier import : le fichier de 28 eleves ----------
  importer(fichier(28));
  await attendre(150);
  t('apercu : « 28 élève(s) au total »',
    doc.getElementById('preview-eleves-count').textContent.indexOf('28 élève(s) au total') >= 0,
    doc.getElementById('preview-eleves-count').textContent);
  t('apercu : la classe est annoncee comme nouvelle',
    doc.getElementById('preview-eleves-list').textContent.indexOf('nouvelle classe') >= 0,
    doc.getElementById('preview-eleves-list').textContent);
  win.confirmerImport();
  t('import 1 : 28 eleves', ELEVES().length === 28, ELEVES().length);
  t('import 1 : 28 codes MASSAR uniques', new Set(codes()).size === 28);

  // un signalement sur l'eleve M007
  const id7 = ELEVES().find(e => e.massar === 'M007').id;
  const sig7 = { id: 1, eleveId: id7, nom: 'Eleve 7', classe: 'TCSF-1', dateISO: '2026-09-10',
    date: '10/09/2026', heure: '08:05', seance: 'matin', type: 'absence', statut: 'absent',
    enseignant: 'أيوب الكمرة', matiere: 'Maths' };
  win.eval("absences = " + JSON.stringify([sig7]) + "; localStorage.setItem('absences', JSON.stringify(absences));");

  // ---------- 2. reimport du meme fichier, sans rien supprimer ----------
  importer(fichier(28));
  await attendre(150);
  t('apercu : « tous déjà présents » annonce avant validation',
    doc.getElementById('preview-eleves-list').textContent.indexOf('tous déjà présents') >= 0,
    doc.getElementById('preview-eleves-list').textContent);
  win.confirmerImport();
  t('REIMPORT : toujours 28 eleves (et non 56)', ELEVES().length === 28, ELEVES().length);
  t('REIMPORT : le message compte les 28 deja presents',
    doc.getElementById('toast').textContent.indexOf('28 déjà présent(s)') >= 0,
    doc.getElementById('toast').textContent);
  t('REIMPORT : aucun code en double', new Set(codes()).size === codes().length, codes().join(',').slice(0, 70));

  // ---------- 3. LE SCENARIO SIGNALE : suppression puis reimport ----------
  const clId = JSON.parse(win.eval("classes[0].id"));
  win.supprimerEleve(clId, id7);
  t('apres suppression : 27 eleves', ELEVES().length === 27, ELEVES().length);
  t('M007 n est plus dans la classe', !ELEVES().some(e => e.massar === 'M007'));
  t('la suppression ne detruit pas le signalement', nbAbsences() === 1, nbAbsences());
  importer(fichier(28));
  await attendre(150);
  win.confirmerImport();
  t('SCENARIO : reimport du meme fichier -> 28 eleves, PAS 55', ELEVES().length === 28, ELEVES().length);
  t('SCENARIO : aucun code MASSAR en double', new Set(codes()).size === 28, codes().join(','));
  t('SCENARIO : chaque nom n apparait qu une fois', new Set(ELEVES().map(e => e.nom)).size === 28);
  const m7 = ELEVES().find(e => e.massar === 'M007');
  const sigApres = JSON.parse(win.eval("JSON.stringify(absences)"));
  t('SCENARIO : le signalement de l eleve reimporte est rattache a sa fiche',
    sigApres.length === 1 && sigApres[0].eleveId === m7.id, sigApres[0] && sigApres[0].eleveId + ' / ' + m7.id);
  t('SCENARIO : le message le dit',
    doc.getElementById('toast').textContent.indexOf('signalement(s) rattaché(s)') >= 0,
    doc.getElementById('toast').textContent);

  // ---------- 4. un nom corrige dans MASSAR ----------
  const id5 = ELEVES().find(e => e.massar === 'M005').id;
  const corrige = fichier(28);
  corrige[4].nom = 'Eleve 5 CORRIGE';
  corrige[4].nomFr = 'Eleve 5 CORRIGE';
  importer(corrige);
  await attendre(150);
  win.confirmerImport();
  const e5 = ELEVES().find(e => e.massar === 'M005');
  t('nom corrige dans MASSAR : applique dans l app', e5 && e5.nom === 'Eleve 5 CORRIGE', e5 && e5.nom);
  t('nom corrige : aucun doublon cree', ELEVES().length === 28, ELEVES().length);
  t('nom corrige : l identifiant interne ne change pas (historique attache)', e5 && e5.id === id5, e5 && e5.id + ' / ' + id5);
  t('nom corrige : annonce dans le message',
    doc.getElementById('toast').textContent.indexOf('1 nom(s) corrigé(s)') >= 0,
    doc.getElementById('toast').textContent);

  // ---------- 5. un eleve ne figure plus dans le fichier ----------
  importer(fichier(28).filter(e => e.massar !== 'M007'));
  await attendre(150);
  win.confirmerImport();
  const msg = doc.getElementById('message-confirmation').textContent;
  t('fichier sans M007 : l app PROPOSE de le marquer sorti',
    !doc.getElementById('modal-confirmation').classList.contains('hidden') && /ne figurent plus/.test(msg), msg);
  t('il nomme l eleve concerne', msg.indexOf('Eleve 7') >= 0, msg);
  win.validerConfirmation();
  t('M007 est marque sorti', ELEVES().find(e => e.massar === 'M007').actif === false);
  t('aucun eleve perdu : toujours 28', ELEVES().length === 28, ELEVES().length);

  // ---------- 6. reparation des doublons DEJA crees par l'ancien bug ----------
  // on reconstitue l'etat abime : 28 copies sans historique ajoutees a la suite
  win.eval("(function(){ var cl = classes[0]; var copies = cl.eleves.map(function(e,i){ " +
    "return { id: 9000 + i, massar: e.massar, nom: e.nom, prenom: '', nomArabe: e.nomArabe, nomFr: e.nomFr }; }); " +
    "copies.forEach(function(c){ cl.eleves.push(c); }); sauvegarderClasses(); })()");
  t('etat abime reconstitue : 56 eleves', ELEVES().length === 56, ELEVES().length);
  const avantFusion = nbAbsences();
  win.verifierDoublonsEleves();
  const msg2 = doc.getElementById('message-confirmation').textContent;
  t('l outil detecte les 28 doublons', /28 doublon\(s\)/.test(msg2), msg2.slice(0, 130));
  t('il nomme la classe et le nombre', msg2.indexOf('TCSF-1 ×2') >= 0, msg2.slice(0, 130));
  win.validerConfirmation();
  t('fusion : retour a 28 eleves', ELEVES().length === 28, ELEVES().length);
  t('fusion : codes uniques', new Set(codes()).size === 28);
  t('fusion : l historique est conserve', nbAbsences() === avantFusion, nbAbsences() + ' / ' + avantFusion);
  t('fusion : chaque signalement pointe un eleve existant',
    JSON.parse(win.eval("JSON.stringify(absences)")).every(a => ELEVES().some(e => e.id === a.eleveId)));
  win.verifierDoublonsEleves();
  t('2e passage : « Aucun doublon d élève détecté »',
    doc.getElementById('toast').textContent.indexOf('Aucun doublon') >= 0,
    doc.getElementById('toast').textContent);

  // ---------- 7. un import partiel ne touche pas les autres classes ----------
  win.eval("classes.push({ id: 99, nom: 'TCSF-9', eleves: [{ id: 990, massar: 'Z001', nom: 'Autre' }] }); sauvegarderClasses();");
  importer(fichier(28).filter(e => e.massar !== 'M001'));
  await attendre(150);
  win.confirmerImport();
  win.validerConfirmation();
  t('la classe absente du fichier n est pas touchee',
    JSON.parse(win.eval("JSON.stringify(classes.find(c => c.id === 99).eleves)")).length === 1);
  t('la classe presente garde ses 28 eleves', ELEVES().length === 28, ELEVES().length);

  t('aucune erreur JS', erreurs.length === 0, erreurs[0] || '');
  console.log(ok ? '=== TOUT OK ===' : '=== ECHECS ===');
  process.exit(ok ? 0 : 1);
}, 900);
