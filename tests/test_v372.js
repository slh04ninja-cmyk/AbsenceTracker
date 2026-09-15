// Test jsdom : v3.72 — suppressions avec confirmation + import des fichiers FET (.fet)
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync('AbsenceTrack-v2.html', 'utf8');

const FET = `<?xml version="1.0" encoding="UTF-8"?>
<FET>
 <Institution_Name>Collège Test</Institution_Name>
 <Days_List><Number_of_Days>6</Number_of_Days>
  <Day><Name>Lundi</Name></Day><Day><Name>Mardi</Name></Day><Day><Name>Mercredi</Name></Day>
  <Day><Name>Jeudi</Name></Day><Day><Name>Vendredi</Name></Day><Day><Name>Samedi</Name></Day>
 </Days_List>
 <Hours_List><Number_of_Hours>4</Number_of_Hours>
  <Hour><Name>8:00</Name></Hour><Hour><Name>9:00</Name></Hour><Hour><Name>10:00</Name></Hour><Hour><Name>11:00</Name></Hour>
 </Hours_List>
 <Teachers_List><Teacher><Name>غزالي صالح</Name></Teacher><Teacher><Name>Prof Inconnu</Name></Teacher></Teachers_List>
 <Students_List><Students><Name>TCSF-9</Name></Students><Students><Name>TCSF-1</Name></Students></Students_List>
 <Activities_List>
  <Activity>
   <Teacher>غزالي صالح</Teacher><Subject>PC</Subject><Students>TCSF-9</Students>
   <Duration>2</Duration><Total_Duration>2</Total_Duration>
   <Activity_Group Id="1"><Day>Lundi</Day><Hour>8:00</Hour><Room>Salle 3</Room></Activity_Group>
  </Activity>
  <Activity>
   <Teacher>Prof Inconnu</Teacher><Subject>SVT</Subject><Students>TCSF-1</Students>
   <Duration>1</Duration><Total_Duration>1</Total_Duration>
   <Activity_Group Id="2"><Day>Mardi</Day><Hour>10:00</Hour><Room></Room></Activity_Group>
  </Activity>
 </Activities_List>
</FET>`;

const classes = [{ id: 1, nom: 'TCSF-1', eleves: [{ id: 1, nom: 'El Amrani', prenom: 'Ahmed' }] }];
const erreurs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => erreurs.push('jsdomError: ' + (e.message || e)));
const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(win) {
    win.localStorage.setItem('modeDemonstration', '1');   // ce banc teste l'application de DEMONSTRATION
    win.localStorage.setItem('absenceTrackVersion', 'v3.0');
    win.localStorage.setItem('testHistoGenere_v6', '1');
    win.localStorage.setItem('classes', JSON.stringify(classes));
    win.localStorage.setItem('absences', '[]');
    win.localStorage.setItem('fermeturesEtab', JSON.stringify([{ id: 'f1', type: 'Vacances', libelle: 'Aïd', debut: '2026-10-05', fin: '2026-10-09', portee: 'journee', par: 'Directeur', le: 'x' }]));
    win.localStorage.setItem('seancesAnnulees', JSON.stringify([{ id: 'a1', dateISO: '2026-09-14', classe: 'TCSF-1', debut: '08:00', fin: '10:00', motif: 'Examen', par: 'Directeur', le: 'x' }]));
  }
});
const win = dom.window, doc = win.document;
let ok = true;
const t = (n, c, e) => { console.log((c ? 'OK   ' : 'ECHEC') + ' ' + n + (e !== undefined ? '  [' + e + ']' : '')); if (!c) ok = false; };
const db = JSON.parse(win.eval("JSON.stringify(comptes.filter(function(c){return c.role==='directeur';})[0])"));
function txt(id) { return doc.getElementById(id).textContent; }

setTimeout(() => {
  doc.getElementById('login-email').value = db.email;
  doc.getElementById('login-password').value = db.password;
  win.connexion();
  win.switchDirPage('dir-gestion');

  // ---------- 1. Confirmations ----------
  win.supprimerFermeture('f1');
  t('supprimer une fermeture demande confirmation',
    !doc.getElementById('modal-confirmation').classList.contains('hidden') &&
    JSON.parse(win.localStorage.getItem('fermeturesEtab')).length === 1, txt('message-confirmation'));
  win.annulerConfirmation();
  t('confirmation annulée : fermeture conservée', JSON.parse(win.localStorage.getItem('fermeturesEtab')).length === 1);
  win.supprimerFermeture('f1');
  win.validerConfirmation();
  t('confirmation validée : fermeture supprimée', JSON.parse(win.localStorage.getItem('fermeturesEtab')).length === 0 &&
    doc.getElementById('ferm-liste').textContent.indexOf('Aucune fermeture') >= 0);
  win.retablirSeance('a1');
  t('rétablir une séance demande confirmation',
    !doc.getElementById('modal-confirmation').classList.contains('hidden') &&
    JSON.parse(win.localStorage.getItem('seancesAnnulees')).length === 1, txt('message-confirmation'));
  win.validerConfirmation();
  t('séance rétablie après confirmation', JSON.parse(win.localStorage.getItem('seancesAnnulees')).length === 0);

  // ---------- 2. Parser FET ----------
  const parse = JSON.parse(win.eval("JSON.stringify(parserFET(" + JSON.stringify(FET) + "))"));
  t('parserFET : institution + profs + classes',
    parse && parse.institution === 'Collège Test' && parse.profs.length === 2 && parse.classes.join(',') === 'TCSF-9,TCSF-1',
    parse ? parse.profs.join(',') : 'null');
  t('parserFET : 2 séances avec jour, heures, salle',
    parse.seances.length === 2 && parse.seances[0].jour === 1 && parse.seances[0].debut === '08:00' &&
    parse.seances[0].fin === '10:00' && parse.seances[0].salle === 'Salle 3',
    JSON.stringify(parse.seances[0]));
  t('parserFET : durée 1h -> 10:00-11:00 le mardi',
    parse.seances[1].jour === 2 && parse.seances[1].debut === '10:00' && parse.seances[1].fin === '11:00',
    JSON.stringify(parse.seances[1]));
  t('parserFET : fichier illisible -> null',
    win.eval("parserFET('<autre>pas un FET</autre>') === null") && win.eval("parserFET('') === null"));

  // ---------- 3. Import d'un fichier FET comme tableau de service ----------
  const fichier = new win.File([FET], 'emploi_du_temps.fet', { type: 'text/xml' });
  t('un .fet est reconnu comme fichier FET', win.eval("estFichierFET({name:'x.fet'})") === true &&
    win.eval("estFichierFET({name:'x.xlsx'})") === false);
  win.importerTableauxService({ files: [fichier], value: '' }).then(() => {
    const tables = JSON.parse(win.localStorage.getItem('tableauxService_v2') || '{}');
    const cle = 'pc-prof1@taalim.ma';
    t('séances du prof reconnu enregistrées',
      !!tables[cle] && tables[cle].length === 1 && tables[cle][0].jour === 1 && tables[cle][0].classe === 'TCSF-9' &&
      tables[cle][0].debut === '08:00' && tables[cle][0].fin === '10:00', JSON.stringify(tables[cle]));
    t('classe du fichier FET créée', JSON.parse(win.localStorage.getItem('classes')).some(c => c.nom === 'TCSF-9'));
    t('aperçu de l import FET (prof inconnu signalé)',
      txt('service-preview').indexOf('Fichier FET importé') >= 0 && txt('service-preview').indexOf('Prof Inconnu') >= 0,
      txt('service-preview').slice(0, 120));

    // ---------- 4. Import des élèves depuis un FET ----------
    const fichier2 = new win.File([FET], 'eleves.fet', { type: 'text/xml' });
    return win.importerTableauxEleves({ files: [fichier2], value: '' }).then(() => {
      t('import élèves FET : aucune classe en double créée',
        JSON.parse(win.localStorage.getItem('classes')).filter(c => c.nom === 'TCSF-9').length === 1);
      t('avertissement sur les codes MASSAR absents d un FET',
        txt('eleves-preview').indexOf('MASSAR') >= 0, txt('eleves-preview').slice(0, 120));

      t('aucune erreur JS', erreurs.length === 0, erreurs[0] || '');
      console.log(ok ? '=== TOUT OK ===' : '=== ECHECS ===');
      process.exit(ok ? 0 : 1);
    });
  }).catch(e => { console.log('ECHEC exception ' + e.message); process.exit(1); });
}, 500);
